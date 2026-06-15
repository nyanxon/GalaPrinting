-- Migration 031: Expand image_path from VARCHAR(500) to TEXT
-- Reason: image_path stores a JSON array of up to 8 URLs.
-- 8 URLs × ~60 chars each = ~480 chars minimum, but with longer UUIDs
-- and full paths the JSON string can easily exceed 500 chars, causing
-- truncation and only the first image being recoverable.
ALTER TABLE products
  MODIFY COLUMN image_path TEXT DEFAULT NULL;
