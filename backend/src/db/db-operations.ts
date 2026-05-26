import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, lt, desc, gt, like } from 'drizzle-orm';
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
  imageUrl: string = '',
  descriptionSeo: string | null = null,
  material: string | null = null,
  color: string | null = null,
  seoKeywords: string | null = null
) {
  try {
    const drizzleDb = getDrizzle(db);

    const result = await drizzleDb
      .insert(schema.products)
      .values({
        artisanId,
        titleOriginal: name,
        titleEn: name,
        priceInr: price,
        stock,
        imageUrl,
        descriptionSeo,
        material,
        color,
        seoKeywords,
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
 * Retrieves the business telemetry snapshot from D1.
 * 
 * @param db The D1 database instance
 * @param artisanId The ID of the artisan
 * @returns A compact snapshot JSON string containing the total revenue, top selling item, dead stock, and pending payments
 */
export async function getBusinessSnapshot(
  db: D1Database | DrizzleD1Database<typeof schema>,
  artisanId: string
) {
  try {
    const drizzleDb = getDrizzle(db);

    // 1. Calculate 7-day revenue
    const paidOrders = await drizzleDb
      .select({
        productId: schema.orders.productId,
        productName: schema.products.titleEn,
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

    const week_revenue_inr = paidOrders.reduce((sum, order) => sum + (order.amount * order.priceInr), 0);

    // 2. Top-selling product
    const productSales: Record<string, { name: string; quantity: number }> = {};
    paidOrders.forEach((order) => {
      if (!productSales[order.productId]) {
        productSales[order.productId] = { name: order.productName, quantity: 0 };
      }
      productSales[order.productId].quantity += order.amount;
    });

    let top_seller = null;
    let maxQuantity = 0;
    Object.values(productSales).forEach((sale) => {
      if (sale.quantity > maxQuantity) {
        maxQuantity = sale.quantity;
        top_seller = sale.name;
      }
    });

    // 3. Pending payments
    const pendingOrders = await drizzleDb
      .select({
        amount: schema.orders.amount,
        priceInr: schema.products.priceInr,
      })
      .from(schema.orders)
      .innerJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .where(
        and(
          eq(schema.products.artisanId, artisanId),
          eq(schema.orders.status, 'pending')
        )
      );
    const pending_payment_inr = pendingOrders.reduce((sum, order) => sum + (order.amount * order.priceInr), 0);

    // 4. Dead stock (items with stock > 0 but no recent sales)
    const allProducts = await drizzleDb
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.artisanId, artisanId), gt(schema.products.stock, 0)));
      
    const soldProductIds = new Set(paidOrders.map(o => o.productId));
    const deadStockItems = allProducts.filter(p => !soldProductIds.has(p.id));
    const dead_stock_item = deadStockItems.length > 0 ? deadStockItems[0].titleEn : null;

    const snapshot = {
      week_revenue_inr,
      top_seller,
      dead_stock_item,
      pending_payment_inr
    };

    return JSON.stringify(snapshot);
  } catch (error: any) {
    console.error('Error in getBusinessSnapshot:', error);
    return JSON.stringify({ error: 'Failed to fetch snapshot' });
  }
}

/**
 * Synchronizes telemetry data (total revenue, top-selling product, and low-stock products) from D1 to Upstash Redis.
 * Saves the JSON stringified telemetry snapshot to a key: telemetry:{artisanId} with a 1-hour expiration TTL.
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

    // 1. Calculate total revenue and aggregate sales for top selling item from 'paid' orders
    const paidOrders = await drizzleDb
      .select({
        productId: schema.orders.productId,
        productName: schema.products.titleEn,
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

    // Aggregate sales quantities per product to find the top selling item
    const productSales: Record<string, { name: string; quantity: number }> = {};
    paidOrders.forEach((order) => {
      if (!productSales[order.productId]) {
        productSales[order.productId] = { name: order.productName, quantity: 0 };
      }
      productSales[order.productId].quantity += order.amount;
    });

    let topSellingItem = "None";
    let maxQuantity = 0;

    Object.values(productSales).forEach((sale) => {
      if (sale.quantity > maxQuantity) {
        maxQuantity = sale.quantity;
        topSellingItem = sale.name;
      }
    });

    // 2. Query products where stock is less than 3 for this artisan (low stock items)
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
      topSellingItem,
      lowStockProducts,
    };

    // 3. Save resulting JSON string to telemetry:{artisanId} key with a 1-hour TTL (3600 seconds)
    const key = `telemetry:${artisanId}`;
    await redisClient.set(key, JSON.stringify(snapshot), { ex: 3600 });

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
/**
 * Handles e-commerce checkout flow securely inside an atomic D1 batch transaction.
 * Verifies product stock, inserts a new 'paid' order, and decrements product stock.
 * 
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 * @param productId The ID of the product being purchased
 * @param quantityBought The quantity being purchased
 * @returns Object indicating success and updated remaining stock
 */
export async function processOrderPayment(
  db: D1Database | DrizzleD1Database<typeof schema>,
  productId: string,
  quantityBought: number
) {
  try {
    const drizzleDb = getDrizzle(db);

    // 1. Verify the product exists and has sufficient stock
    const productResult = await drizzleDb
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId));

    if (!productResult || productResult.length === 0) {
      throw new Error(`Product with ID '${productId}' not found.`);
    }

    const product = productResult[0];

    if (product.stock < quantityBought) {
      throw new Error(
        `Insufficient stock for product '${product.titleEn}'. Requested: ${quantityBought}, Available: ${product.stock}`
      );
    }

    const remainingStock = product.stock - quantityBought;

    // 2. Perform atomic batch writes: insert 'paid' order and decrement stock
    // Cloudflare D1 guarantees batch statements are executed in a single atomic SQL transaction.
    const batchResult = await drizzleDb.batch([
      drizzleDb
        .insert(schema.orders)
        .values({
          productId: productId,
          amount: quantityBought,
          status: 'paid',
        })
        .returning(),
      drizzleDb
        .update(schema.products)
        .set({ stock: remainingStock })
        .where(eq(schema.products.id, productId))
        .returning(),
    ]);

    const updatedProduct = batchResult[1];

    if (!updatedProduct || updatedProduct.length === 0) {
      throw new Error('Failed to update product stock.');
    }

    return {
      success: true,
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

/**
 * Retrieves storefront data: artisan profile and all their associated products.
 * 
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 * @param artisanSlug The shop slug of the artisan
 */
export async function getStorefrontData(
  db: D1Database | DrizzleD1Database<typeof schema>,
  artisanSlug: string
) {
  try {
    const drizzleDb = getDrizzle(db);

    // 1. Query the artisans table by shopSlug
    const artisanResult = await drizzleDb
      .select()
      .from(schema.artisans)
      .where(eq(schema.artisans.shopSlug, artisanSlug));

    if (!artisanResult || artisanResult.length === 0) {
      return {
        success: false,
        error: `Artisan with shop slug '${artisanSlug}' not found.`,
      };
    }

    const artisan = artisanResult[0];

    // 2. Query the products table for all live items matching that artisanId
    const productsResult = await drizzleDb
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.artisanId, artisan.id),
          eq(schema.products.isLive, true)
        )
      );

    return {
      success: true,
      artisan,
      products: productsResult,
    };
  } catch (error: any) {
    console.error('Error in getStorefrontData:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Queries all products where stock is greater than 0, performing a SQL JOIN
 * to include the artisan name, ordered newly created first (by primary key descending fallback).
 * 
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 */
export async function getMarketplaceFeed(
  db: D1Database | DrizzleD1Database<typeof schema>
) {
  try {
    const drizzleDb = getDrizzle(db);

    const productsResult = await drizzleDb
      .select({
        id: schema.products.id,
        name: schema.products.titleEn,
        priceInr: schema.products.priceInr,
        stock: schema.products.stock,
        imageUrl: schema.products.imageUrl,
        artisanId: schema.products.artisanId,
        artisanName: schema.artisans.name,
      })
      .from(schema.products)
      .innerJoin(schema.artisans, eq(schema.products.artisanId, schema.artisans.id))
      .where(gt(schema.products.stock, 0))
      .orderBy(desc(schema.products.id));

    return {
      success: true,
      products: productsResult,
    };
  } catch (error: any) {
    console.error('Error in getMarketplaceFeed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Updates a product's stock by adding additionalStock to the current value.
 * Performs a case-insensitive exact or LIKE match to find the product belonging to the artisan.
 * 
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 * @param artisanId The ID of the artisan owning the product
 * @param productName The name of the product to match (case-insensitive exact or fuzzy)
 * @param additionalStock The quantity to add to the current stock
 */
export async function updateProductStock(
  db: D1Database | DrizzleD1Database<typeof schema>,
  artisanId: string,
  productName: string,
  additionalStock: number
) {
  try {
    const drizzleDb = getDrizzle(db);

    // 1. Query products belonging to the artisan matching the productName using LIKE
    const products = await drizzleDb
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.artisanId, artisanId),
          like(schema.products.titleEn, `%${productName}%`)
        )
      );

    if (!products || products.length === 0) {
      throw new Error(`Product matching '${productName}' not found.`);
    }

    // Try to find an exact case-insensitive name match first
    let product = products.find(
      (p) => p.titleEn.toLowerCase() === productName.toLowerCase()
    );

    // If no exact match is found, fallback to the first LIKE matched product
    if (!product) {
      product = products[0];
    }

    const newStock = product.stock + additionalStock;

    // 2. Perform the update query
    const result = await drizzleDb
      .update(schema.products)
      .set({ stock: newStock })
      .where(eq(schema.products.id, product.id))
      .returning();

    if (!result || result.length === 0) {
      throw new Error('Failed to update product stock.');
    }

    return {
      success: true,
      productName: product.titleEn,
      newStock: result[0].stock,
    };
  } catch (error: any) {
    console.error('Error in updateProductStock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
/**
 * Creates a new artisan profile during the onboarding flow.
 * Generates a shop slug from the name, and uses placeholder values for phone and UIN.
 *
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 * @param name The name of the artisan
 * @param village The village/region of the artisan
 * @param craftType The type of craft the artisan practices
 * @param experienceYears The number of years of experience (as text)
 */
export async function createArtisanProfile(
  db: D1Database | DrizzleD1Database<typeof schema>,
  name: string,
  village: string,
  craftType: string,
  experienceYears: string
) {
  try {
    const drizzleDb = getDrizzle(db);

    // Generate a URL-friendly shop slug from the name with 4 random digits
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const shopSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + randomSuffix;

    const result = await drizzleDb
      .insert(schema.artisans)
      .values({
        name,
        region: village,
        shopSlug,
        phone: `onboarding_${Date.now()}`,
        uinNumber: 'PENDING',
        craftType,
        experienceYears,
      })
      .returning();

    if (!result || result.length === 0) {
      throw new Error('Failed to create artisan profile: No database records were returned.');
    }

    return {
      success: true,
      artisan: result[0],
    };
  } catch (error: any) {
    console.error('Error in createArtisanProfile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Creates a new product listing.
 */
export async function createProductListing(
  db: D1Database | DrizzleD1Database<typeof schema>,
  artisanId: string,
  titleOriginal: string,
  titleEn: string,
  descriptionSeo: string,
  priceInr: number
) {
  try {
    const drizzleDb = getDrizzle(db);

    const result = await drizzleDb
      .insert(schema.products)
      .values({
        artisanId,
        titleOriginal,
        titleEn,
        descriptionSeo,
        priceInr,
        stock: 0,
        imageUrl: '',
      })
      .returning();

    if (!result || result.length === 0) {
      throw new Error('Failed to create product listing: No database records were returned.');
    }

    // Fetch the shopSlug to construct the URL
    const artisanResult = await drizzleDb
      .select({ shopSlug: schema.artisans.shopSlug })
      .from(schema.artisans)
      .where(eq(schema.artisans.id, artisanId));

    const shopSlug = artisanResult.length > 0 ? artisanResult[0].shopSlug : 'unknown-shop';

    return {
      success: true,
      product: result[0],
      shopSlug,
    };
  } catch (error: any) {
    console.error('Error in createProductListing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Inserts a new market research synthesis row into the SQLite `market_insights` table in D1.
 */
export async function insertMarketInsight(
  db: D1Database | DrizzleD1Database<typeof schema>,
  artisanId: string,
  rawTavilyData: any,
  structuredJson: any,
  kannadaDigest: string,
  roadmapKannada: string
) {
  try {
    const drizzleDb = getDrizzle(db);

    const result = await drizzleDb
      .insert(schema.marketInsights)
      .values({
        artisanId,
        rawTavilyData: typeof rawTavilyData === 'string' ? rawTavilyData : JSON.stringify(rawTavilyData),
        structuredJson: typeof structuredJson === 'string' ? structuredJson : JSON.stringify(structuredJson),
        kannadaDigest,
        roadmapKannada,
      })
      .returning();

    if (!result || result.length === 0) {
      throw new Error('Failed to insert market insight: No SQLite records returned.');
    }

    return {
      success: true,
      insight: result[0],
    };
  } catch (error: any) {
    console.error('Error in insertMarketInsight:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
