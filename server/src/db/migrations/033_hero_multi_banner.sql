-- ============================================================
-- 033_hero_multi_banner.sql
-- Converts homepage_hero from a single-row table to a
-- multi-row carousel table (up to 8 slides).
-- ============================================================

-- 1. Add sort_order column if it doesn't exist yet
ALTER TABLE homepage_hero
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 2. Update the seeded default row to have explicit sort_order = 0
UPDATE homepage_hero
SET sort_order = 0
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Note: is_active per-slide allows hiding individual slides without deletion.
-- The LIMIT 1 in getHero() is now replaced by listHeroBanners()
-- which returns all active rows ordered by sort_order ASC.
