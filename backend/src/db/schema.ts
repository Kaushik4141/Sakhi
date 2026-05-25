import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const artisans = sqliteTable('artisans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  region: text('region').notNull(),
  shopSlug: text('shop_slug').notNull(),
  phone: text('phone').notNull().unique(),
  uinNumber: text('uin_number').notNull(),
  craftType: text('craft_type'),
  experienceYears: text('experience_years'),
});

import { sql } from 'drizzle-orm';

export const products = sqliteTable('products', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  artisanId: text('artisan_id')
    .notNull()
    .references(() => artisans.id),
  titleOriginal: text('title_original').notNull(),
  titleEn: text('title_en').notNull(),
  descriptionSeo: text('description_seo'),
  priceInr: integer('price_inr').notNull(),
  stock: integer('stock').notNull(),
  imageUrl: text('image_url').notNull(),
  isLive: integer('is_live', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const marketInsights = sqliteTable('market_insights', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  artisanId: text('artisan_id').notNull(),
  rawTavilyData: text('raw_tavily_data').notNull(), // stored as JSON string in SQLite
  structuredJson: text('structured_json').notNull(), // stored as JSON string in SQLite
  kannadaDigest: text('kannada_digest').notNull(),
  roadmapKannada: text('roadmap_kannada').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
});
