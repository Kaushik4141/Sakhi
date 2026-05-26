import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ── Artisans ────────────────────────────────────────────────────────────────
export const artisans = sqliteTable("artisans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio"),
});

// ── Products ────────────────────────────────────────────────────────────────
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  artisanId: integer("artisan_id")
    .notNull()
    .references(() => artisans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: real("price").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  category: text("category").notNull().default("All Crafts"),
  isGiVerified: integer("is_gi_verified", { mode: "boolean" })
    .notNull()
    .default(false),
});

// ── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
});
