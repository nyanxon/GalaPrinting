-- Migration 055: Drop the legacy `users` table.
--
-- Prerequisites:
--   - 053: users_customer and users_admin tables created and fully backfilled
--   - 054: ALL foreign keys referencing users(id) have been dropped
--   - All app-layer queries have been migrated to query users_customer / users_admin
--     (verified: zero FROM users queries remain in production code)
--
-- This is a destructive migration — once applied, the old `users` table is gone.
-- Run a backup before applying in production.

-- Guard: only drop if the old table still exists and the new tables exist
SET @has_old  = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users');
SET @has_cust = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users_customer');
SET @has_adm  = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users_admin');

-- Proceed only if all three conditions are met
-- (We use a prepared DROP — no IF in DDL outside stored procedures in MySQL 5.7)
SET @sql = IF(
  @has_old = 1 AND @has_cust = 1 AND @has_adm = 1,
  'DROP TABLE IF EXISTS users',
  'SELECT 1 AS skip_drop'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
