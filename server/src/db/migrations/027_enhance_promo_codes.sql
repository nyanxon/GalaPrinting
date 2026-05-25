-- Migration 023: Enhance promo_codes table with new constraint columns
-- Adds: daily_limit, min_purchase, max_discount, description, is_active

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS description  VARCHAR(255)  DEFAULT NULL AFTER code,
  ADD COLUMN IF NOT EXISTS daily_limit  INT           DEFAULT NULL AFTER max_uses,
  ADD COLUMN IF NOT EXISTS min_purchase DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER daily_limit,
  ADD COLUMN IF NOT EXISTS max_discount DECIMAL(15,2) DEFAULT NULL AFTER min_purchase,
  ADD COLUMN IF NOT EXISTS is_active    TINYINT(1)    NOT NULL DEFAULT 1 AFTER max_discount,
  ADD COLUMN IF NOT EXISTS updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
