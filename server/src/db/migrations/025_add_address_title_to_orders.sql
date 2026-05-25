-- Migration 025: Add customer_address_title to orders table
-- Stores the address label (e.g. "Rumah", "Kantor") from the customer's saved address

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_address_title VARCHAR(100) DEFAULT NULL AFTER customer_address;
