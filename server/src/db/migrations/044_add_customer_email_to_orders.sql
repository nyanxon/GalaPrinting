-- Add customer_email column to orders table for offline order email support
ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255) NULL AFTER customer_address;
