-- Migration 026: Add order_id and order_item_id to reviews for spam prevention
-- Enforces one review per order item (1 order = 1 review per item)

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS order_id      CHAR(36) DEFAULT NULL AFTER product_id,
  ADD COLUMN IF NOT EXISTS order_item_id CHAR(36) DEFAULT NULL AFTER order_id;

-- MariaDB/PHPMyAdmin: avoid stored procedures; use dynamic SQL instead
SET @create_key_stmt := (
  SELECT CONCAT('ALTER TABLE reviews ADD UNIQUE KEY uq_review_customer_order_item (customer_id, order_item_id)')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'reviews'
    AND INDEX_NAME   = 'uq_review_customer_order_item'
  LIMIT 1
);

-- If index exists -> create_stmt will be non-null -> run SELECT 1 (no-op)
-- If index doesn't exist -> create_stmt null -> run ALTER ...
SET @sql := IF(@create_key_stmt IS NOT NULL, 'SELECT 1', 'ALTER TABLE reviews ADD UNIQUE KEY uq_review_customer_order_item (customer_id, order_item_id)');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

