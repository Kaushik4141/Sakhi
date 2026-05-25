-- Neon PostgreSQL: artisans table for onboarding
-- Run this against your Neon database via the Neon console or psql

CREATE TABLE IF NOT EXISTS artisans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  district    TEXT NOT NULL,
  craft_type  TEXT NOT NULL,
  shop_slug   TEXT NOT NULL UNIQUE,
  language    TEXT NOT NULL DEFAULT 'english',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast shop URL lookups
CREATE INDEX IF NOT EXISTS idx_artisans_shop_slug ON artisans (shop_slug);
