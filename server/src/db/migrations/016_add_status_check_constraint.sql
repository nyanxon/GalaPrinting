-- Migration 016: Add CHECK constraint to orders.status
-- NOTE (MariaDB): Avoid stored procedures because PHPMyAdmin often fails with "near ''" for CREATE PROCEDURE blocks.
-- Idempotent-ish: if constraint exists, attempt to drop it using dynamic SQL.

-- Ensure status column shape first (safe to re-run)
ALTER TABLE orders
  MODIFY COLUMN status VARCHAR(60) NOT NULL DEFAULT 'Waiting for Payment';

-- Try to drop constraint if it exists (dynamic SQL; harmless if it doesn't)
SET @drop_stmt := (
  SELECT CONCAT('ALTER TABLE orders DROP CONSTRAINT chk_orders_status')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND CONSTRAINT_NAME = 'chk_orders_status'
    AND CONSTRAINT_TYPE = 'CHECK'
  LIMIT 1
);

SET @does_exist := (@drop_stmt IS NOT NULL);

SET @sql := IF(@does_exist, @drop_stmt, 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add constraint (if it exists already, this may fail; but the drop attempt above should handle it)
ALTER TABLE orders
  ADD CONSTRAINT chk_orders_status CHECK (
    status IN (
      'Waiting for Payment',
      'Payment Accepted',
      'Waiting for Design Approval',
      'Design Accepted',
      'On Progress',
      'Quality Checking',
      'In Delivery',
      'Finished',
      'Cancelled'
    )
  );

