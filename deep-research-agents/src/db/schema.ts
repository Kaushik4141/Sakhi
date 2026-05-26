import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const marketInsights = sqliteTable('market_insights', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  artisanId: text('artisan_id').notNull(),
  rawTavilyData: text('raw_tavily_data').notNull(), // stringified JSON
  structuredJson: text('structured_json').notNull(), // stringified JSON
  kannadaDigest: text('kannada_digest').notNull(),
  roadmapKannada: text('roadmap_kannada').notNull(),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
});
