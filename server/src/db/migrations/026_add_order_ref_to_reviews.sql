-- Migration 026: Add order_id and order_item_id to reviews for spam prevention
-- Enforces one review per order item (1 order = 1 review per item)

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS order_id      CHAR(36) DEFAULT NULL AFTER product_id,
  ADD COLUMN IF NOT EXISTS order_item_id CHAR(36) DEFAULT NULL AFTER order_id;

-- Conditionally add unique key using a stored procedure (safe to re-run)
DROP PROCEDURE IF EXISTS add_review_unique_key;

CREATE PROCEDURE add_review_unique_key()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'reviews'
      AND INDEX_NAME   = 'uq_review_customer_order_item'
  ) THEN
    ALTER TABLE reviews
      ADD UNIQUE KEY uq_review_customer_order_item (customer_id, order_item_id);
  END IF;
END;

CALL add_review_unique_key();

DROP PROCEDURE IF EXISTS add_review_unique_key;
