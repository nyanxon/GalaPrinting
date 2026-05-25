ALTER TABLE order_history ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL;
