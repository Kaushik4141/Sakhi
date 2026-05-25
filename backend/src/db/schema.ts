import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const artisans = sqliteTable('artisans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  region: text('region').notNull(),
  uinNumber: text('uin_number').notNull(),
  shopSlug: text('shop_slug').notNull(),
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  artisanId: text('artisan_id')
    .notNull()
    .references(() => artisans.id),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  stock: integer('stock').notNull(),
  imageUrl: text('image_url').notNull(),
  isGiVerified: integer('is_gi_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
});

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('pending'),
});
