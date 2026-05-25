import { drizzle } from "drizzle-orm/d1";
import { getRequestContext } from "@cloudflare/next-on-pages";
import * as schema from "./schema";

/**
 * Create a Drizzle client bound to a Cloudflare D1 database.
 *
 * In the Next.js App Router on Cloudflare Pages, the D1 binding is
 * available via `getRequestContext()` from `@cloudflare/next-on-pages`.
 *
 * Usage in a Server Component or Route Handler:
 *
 *   import { getDb } from "@/db";
 *   const db = getDb();
 *   const rows = await db.select().from(schema.artisans);
 */
export function getDb() {
  const { env } = getRequestContext();

  return drizzle(env.DB, { schema });
}

export { schema };
