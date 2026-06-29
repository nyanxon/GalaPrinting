-- ============================================================
-- 034_add_financials_to_orders.sql
-- Adds financial tracking columns to the orders table.
-- shipping_cost  — what the customer paid for delivery
-- tax_amount     — any tax applied to the order
-- refund_amount  — amount refunded (partial or full)
-- payment_method — e.g. "Transfer Bank", "QRIS", "COD"
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_cost  DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount  DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)   DEFAULT NULL;
