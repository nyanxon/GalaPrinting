-- ============================================================
-- 043_fix_invoices_created_by_nullable.sql
-- Fix: autoCreateInvoice gagal karena created_by NOT NULL
-- tapi function mengisi null (auto-generated, no creator).
-- ============================================================

-- 1. Drop foreign key constraint
SET @fk_name = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'created_by'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);
SET @sql = IF(@fk_name IS NOT NULL, CONCAT('ALTER TABLE invoices DROP FOREIGN KEY `', @fk_name, '`'), 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Make created_by nullable
ALTER TABLE invoices MODIFY COLUMN created_by CHAR(36) DEFAULT NULL COMMENT 'cashier user_id (null for auto-generated)';
