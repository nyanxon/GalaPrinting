-- Migration 016: Add CHECK constraint to orders.status
-- Ensures only valid status values can be written to orders.status at the DB level.
-- Idempotent: uses a stored procedure to drop the constraint only if it exists,
-- compatible with both MySQL 8.0+ and MariaDB.

DROP PROCEDURE IF EXISTS migration_016_add_status_check;

CREATE PROCEDURE migration_016_add_status_check()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME        = 'orders'
      AND CONSTRAINT_NAME   = 'chk_orders_status'
      AND CONSTRAINT_TYPE   = 'CHECK'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT chk_orders_status;
  END IF;

  ALTER TABLE orders
    MODIFY COLUMN status VARCHAR(60) NOT NULL DEFAULT 'Waiting for Payment',
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
END;

CALL migration_016_add_status_check();

DROP PROCEDURE IF EXISTS migration_016_add_status_check;
