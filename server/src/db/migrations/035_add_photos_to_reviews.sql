-- Add photo_url column to reviews for customer review photo uploads
ALTER TABLE reviews
  ADD COLUMN photo_url TEXT DEFAULT NULL
  COMMENT 'Optional photo uploaded by customer with their review';
