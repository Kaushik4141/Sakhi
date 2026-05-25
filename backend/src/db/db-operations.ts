import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, lt } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { Redis } from '@upstash/redis';
import * as schema from './schema';

/**
 * Resolves the Drizzle ORM database instance.
 * Accepts either a raw Cloudflare D1 D1Database binding or an already initialized DrizzleD1Database instance.
 */
export function getDrizzle(
  db: D1Database | DrizzleD1Database<typeof schema>
): DrizzleD1Database<typeof schema> {
  // If the passed object has drizzle-specific query/select methods, it is already initialized
  if (db && 'select' in db && typeof (db as any).select === 'function') {
    return db as DrizzleD1Database<typeof schema>;
  }
  // Otherwise, it's the raw D1Database binding, so we initialize drizzle with our schema
  return drizzle(db as D1Database, { schema });
}

/**
 * Inserts a new product into the products table.
 * 
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 * @param artisanId The ID of the artisan owning the product
 * @param name The name of the product
 * @param price The price of the product in INR (usually represented in the smallest currency unit, e.g. paise)
 * @param stock The initial stock quantity of the product
 * @param imageUrl Optional image URL (defaults to empty string to satisfy schema's .notNull() constraint)
 */
export async function insertProduct(
  db: D1Database | DrizzleD1Database<typeof schema>,
  artisanId: string,
  name: string,
  price: number,
  stock: number,
  imageUrl: string = ''
) {
  try {
    const drizzleDb = getDrizzle(db);

    const result = await drizzleDb
      .insert(schema.products)
      .values({
        artisanId,
        name,
        priceInr: price,
        stock,
        imageUrl,
      })
      .returning();

    if (!result || result.length === 0) {
      throw new Error('Failed to create product: No database records were returned.');
    }

    return {
      success: true,
      product: result[0],
    };
  } catch (error: any) {
    console.error('Error in insertProduct:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Alias for compatibility
export { insertProduct as createProduct };

/**
 * Instantly retrieves the business telemetry snapshot from Upstash Redis.
 * Falls back to a default empty state if the key is null.
 * 
 * @param redisClient The Upstash Redis client instance
 * @param artisanId The ID of the artisan
 * @returns A compact snapshot JSON object containing the total revenue and low stock products
 */
export async function getBusinessSnapshot(
  redisClient: Redis,
  artisanId: string
) {
  try {
    const key = `telemetry:${artisanId}`;
    const cached = await redisClient.get(key);

    if (!cached) {
      // Default empty state if the key is null
      return {
        success: true,
        snapshot: {
          artisanId,
          totalRevenue: 0,
          lowStockProducts: [],
        },
      };
    }

    // Upstash Redis may automatically parse the stringified JSON or return the raw string.
    // We safely parse it if it is a string, otherwise return directly.
    const snapshot = typeof cached === 'string' ? JSON.parse(cached) : cached;

    return {
      success: true,
      snapshot,
    };
  } catch (error: any) {
    console.error('Error in getBusinessSnapshot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Synchronizes telemetry data (total revenue and low-stock products) from D1 to Upstash Redis.
 * Saves the JSON stringified telemetry snapshot to a key: telemetry:{artisanId}
 * 
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 * @param redisClient The Upstash Redis client instance
 * @param artisanId The ID of the artisan to sync
 */
export async function syncTelemetryToRedis(
  db: D1Database | DrizzleD1Database<typeof schema>,
  redisClient: Redis,
  artisanId: string
) {
  try {
    const drizzleDb = getDrizzle(db);

    // 1. Calculate total revenue from 'paid' orders for this artisan
    const paidOrders = await drizzleDb
      .select({
        amount: schema.orders.amount,
        priceInr: schema.products.priceInr,
      })
      .from(schema.orders)
      .innerJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .where(
        and(
          eq(schema.products.artisanId, artisanId),
          eq(schema.orders.status, 'paid')
        )
      );

    const totalRevenue = paidOrders.reduce((sum, order) => {
      return sum + (order.amount * order.priceInr);
    }, 0);

    // 2. Query products where stock is less than 3 for this artisan
    const lowStockProducts = await drizzleDb
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.artisanId, artisanId),
          lt(schema.products.stock, 3)
        )
      );

    const snapshot = {
      artisanId,
      totalRevenue,
      lowStockProducts,
    };

    // 3. Save resulting JSON string to telemetry:{artisanId} key
    const key = `telemetry:${artisanId}`;
    await redisClient.set(key, JSON.stringify(snapshot));

    return {
      success: true,
      snapshot,
    };
  } catch (error: any) {
    console.error('Error in syncTelemetryToRedis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Processes payment for an order atomically inside a database transaction.
 * Updates order status to 'paid' and decrements associated product stock by the order amount.
 * 
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 * @param orderId The ID of the order to process
 * @returns Object indicating success status, updated product name, and remaining stock
 */
export async function processOrderPayment(
  db: D1Database | DrizzleD1Database<typeof schema>,
  orderId: string
) {
  try {
    const drizzleDb = getDrizzle(db);

    // 1. Find the order by ID
    const orderResult = await drizzleDb
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!orderResult || orderResult.length === 0) {
      throw new Error(`Order with ID '${orderId}' not found.`);
    }

    const order = orderResult[0];

    // If already paid, return early with success status to prevent double-decrement
    if (order.status === 'paid') {
      const productResult = await drizzleDb
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, order.productId));
      
      if (!productResult || productResult.length === 0) {
        throw new Error(`Associated product not found for already paid order.`);
      }
      
      return {
        success: true,
        productName: productResult[0].name,
        remainingStock: productResult[0].stock,
      };
    }

    // 2. Find the associated product to check stock availability
    const productResult = await drizzleDb
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, order.productId));

    if (!productResult || productResult.length === 0) {
      throw new Error(`Associated product with ID '${order.productId}' not found.`);
    }

    const product = productResult[0];

    // Verify sufficient stock is available
    if (product.stock < order.amount) {
      throw new Error(
        `Insufficient stock for product '${product.name}'. Requested: ${order.amount}, Available: ${product.stock}`
      );
    }

    // 3. Atomically update the order and decrement product stock using D1 Batch.
    // D1 guarantees that batch queries are executed in a single atomic SQL transaction.
    const batchResult = await drizzleDb.batch([
      drizzleDb
        .update(schema.orders)
        .set({ status: 'paid' })
        .where(eq(schema.orders.id, orderId))
        .returning(),
      drizzleDb
        .update(schema.products)
        .set({ stock: product.stock - order.amount })
        .where(eq(schema.products.id, order.productId))
        .returning(),
    ]);

    const updatedProduct = batchResult[1];

    if (!updatedProduct || updatedProduct.length === 0) {
      throw new Error('Failed to update product stock.');
    }

    return {
      success: true,
      productName: updatedProduct[0].name,
      remainingStock: updatedProduct[0].stock,
    };
  } catch (error: any) {
    console.error('Error in processOrderPayment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Automatically ensures an artisan exists by phone number.
 * If the artisan exists, returns their ID and shop slug.
 * If not, generates a URL-friendly shop slug, hardcodes a mock UIN, and creates a new artisan.
 * 
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 * @param name The name of the artisan
 * @param phone The unique phone number of the artisan
 * @param region Optional region name (defaults to 'Demo Region' to satisfy notNull constraint)
 */
export async function ensureArtisanExists(
  db: D1Database | DrizzleD1Database<typeof schema>,
  name: string,
  phone: string,
  region: string = 'Demo Region'
) {
  try {
    const drizzleDb = getDrizzle(db);

    // 1. Check if an artisan with this phone number already exists
    const existing = await drizzleDb
      .select()
      .from(schema.artisans)
      .where(eq(schema.artisans.phone, phone));

    if (existing && existing.length > 0) {
      return {
        success: true,
        id: existing[0].id,
        shopSlug: existing[0].shopSlug,
      };
    }

    // 2. Automatically generate a URL-friendly shop slug based on their name
    const shopSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')  // replace spaces and special characters with hyphens
      .replace(/(^-|-$)/g, '');    // trim leading and trailing hyphens

    // 3. Insert new artisan with a mock UIN number
    const result = await drizzleDb
      .insert(schema.artisans)
      .values({
        name,
        phone,
        region,
        shopSlug,
        uinNumber: 'UIN-MOCK-2024', // mock UIN to bypass regulatory checks for the demo
      })
      .returning();

    if (!result || result.length === 0) {
      throw new Error('Failed to create new artisan: No records returned.');
    }

    return {
      success: true,
      id: result[0].id,
      shopSlug: result[0].shopSlug,
    };
  } catch (error: any) {
    console.error('Error in ensureArtisanExists:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

