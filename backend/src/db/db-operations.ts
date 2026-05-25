import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, lt } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
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
 * @param price The price of the product (usually represented in the smallest currency unit, e.g. cents/paise)
 * @param stock The initial stock quantity of the product
 * @param imageUrl Optional image URL (defaults to empty string to satisfy schema's .notNull() constraint)
 */
export async function createProduct(
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
        price,
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
    console.error('Error in createProduct:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Runs a query to calculate the total revenue from 'paid' orders for this artisan,
 * and finds any products where stock is less than 3.
 * 
 * @param db The raw D1 Database binding or an initialized Drizzle DB instance
 * @param artisanId The ID of the artisan
 * @returns A compact snapshot JSON object containing the total revenue and low stock products
 */
export async function getBusinessSnapshot(
  db: D1Database | DrizzleD1Database<typeof schema>,
  artisanId: string
) {
  try {
    const drizzleDb = getDrizzle(db);

    // 1. Query to retrieve all 'paid' orders for products owned by this artisan.
    // We join the orders table with products to filter by artisanId and status.
    const paidOrders = await drizzleDb
      .select({
        amount: schema.orders.amount,
        price: schema.products.price,
      })
      .from(schema.orders)
      .innerJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .where(
        and(
          eq(schema.products.artisanId, artisanId),
          eq(schema.orders.status, 'paid')
        )
      );

    // Calculate total revenue.
    // Note: Since amount in the orders table represents the quantity purchased,
    // total revenue is calculated by summing (amount * price) for each paid order.
    const totalRevenue = paidOrders.reduce((sum, order) => {
      return sum + (order.amount * order.price);
    }, 0);

    // 2. Query to retrieve products where stock is less than 3 for this artisan.
    const lowStockProducts = await drizzleDb
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.artisanId, artisanId),
          lt(schema.products.stock, 3)
        )
      );

    return {
      success: true,
      snapshot: {
        artisanId,
        totalRevenue,
        lowStockProducts,
      },
    };
  } catch (error: any) {
    console.error('Error in getBusinessSnapshot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
