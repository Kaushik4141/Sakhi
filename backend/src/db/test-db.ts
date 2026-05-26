import type { D1Database } from '@cloudflare/workers-types';
import type { Redis } from '@upstash/redis';
import { 
  ensureArtisanExists, 
  insertProduct, 
  syncTelemetryToRedis, 
  processOrderPayment, 
  getBusinessSnapshot, 
  getDrizzle 
} from './db-operations';
import { orders } from './schema';

/**
 * Runs the end-to-end telemetry and transaction test sequence:
 * 1. onboarding (ensureArtisanExists) -> creates Laxmi
 * 2. insertProduct -> adds a Saree with 5 stock
 * 3. syncTelemetryToRedis -> pushes state to Upstash Redis cache
 * 4. processOrderPayment -> simulates buying 2 sarees
 * 5. syncTelemetryToRedis again -> updates cache to show 3 stock remaining
 * 6. getBusinessSnapshot -> prints the final cached snapshot
 */
export async function runTestFlow(db: D1Database, redisClient: Redis) {
  const log: string[] = [];
  const logMsg = (msg: string) => {
    console.log(msg);
    log.push(msg);
  };

  try {
    logMsg("=== STARTING END-TO-END TELEMETRY & TRANSACTION TEST ===");

    // Step 1: onboarding (ensureArtisanExists)
    logMsg("\nStep 1: Onboarding Artisan 'Laxmi' via ensureArtisanExists...");
    const artisanResult = await ensureArtisanExists(db, "Laxmi Crafts", "9876543210");
    if (!artisanResult.success) throw new Error(`Onboarding failed: ${artisanResult.error}`);
    const artisanId = artisanResult.id!;
    logMsg(`-> Success! Artisan ID: ${artisanId}, Shop Slug: ${artisanResult.shopSlug}`);

    // Step 2: insertProduct
    logMsg("\nStep 2: Adding 'Handcrafted Silk Saree' with 5 stock via insertProduct...");
    const productResult = await insertProduct(db, artisanId, "Handcrafted Silk Saree", 450000, 5, "https://example.com/saree.png");
    if (!productResult.success) throw new Error(`Product insertion failed: ${productResult.error}`);
    const product = productResult.product!;
    logMsg(`-> Success! Product ID: ${product.id}, Price: ${product.priceInr} Paise, Stock: ${product.stock}`);

    // Step 3: syncTelemetryToRedis
    logMsg("\nStep 3: Synchronizing telemetry to Upstash Redis via syncTelemetryToRedis...");
    const sync1 = await syncTelemetryToRedis(db, redisClient, artisanId);
    if (!sync1.success) throw new Error(`Sync 1 failed: ${sync1.error}`);
    logMsg(`-> Success! Cache updated. Initial Revenue: ${sync1.snapshot?.totalRevenue}, Low-Stock Products Count: ${sync1.snapshot?.lowStockProducts.length}`);

    // Step 4: processOrderPayment (Simulates a buyer purchasing 2 sarees, creating a paid order and decrementing stock)
    logMsg(`\nStep 4: Simulating buyer purchasing 2 sarees via processOrderPayment...`);
    const paymentResult = await processOrderPayment(db, product.id, 2);
    if (!paymentResult.success) throw new Error(`Payment processing failed: ${paymentResult.error}`);
    logMsg(`-> Success! Order recorded as 'paid'. Remaining Stock: ${paymentResult.remainingStock}`);

    // Step 5: syncTelemetryToRedis again
    logMsg("\nStep 5: Synchronizing telemetry again via syncTelemetryToRedis...");
    const sync2 = await syncTelemetryToRedis(db, redisClient, artisanId);
    if (!sync2.success) throw new Error(`Sync 2 failed: ${sync2.error}`);
    logMsg(`-> Success! Cache updated. New Revenue: ${sync2.snapshot?.totalRevenue}, Top Selling Product: ${sync2.snapshot?.topSellingItem}, Low-Stock Products Count: ${sync2.snapshot?.lowStockProducts.length}`);

    // Step 6: getBusinessSnapshot
    logMsg("\nStep 6: Retrieving instant snapshot via getBusinessSnapshot...");
    const snapshotResult = await getBusinessSnapshot(redisClient, artisanId);
    if (!snapshotResult.success) throw new Error(`Snapshot fetch failed: ${snapshotResult.error}`);
    logMsg(`-> Success! instant cached snapshot retrieved:\n${JSON.stringify(snapshotResult.snapshot, null, 2)}`);

    logMsg("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
    return { success: true, log };
  } catch (error: any) {
    logMsg(`\n[FATAL ERROR] Test sequence failed: ${error.message}`);
    return { success: false, log, error: error.message };
  }
}
