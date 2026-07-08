-- Migration 037: Add email verification and password reset fields to users table
-- Adds 5 new columns (all nullable, backward-compatible with existing rows)

ALTER TABLE users
  ADD COLUMN is_email_verified        TINYINT(1)   NOT NULL DEFAULT 0        AFTER email,
  ADD COLUMN email_verification_token VARCHAR(255) DEFAULT NULL               AFTER is_email_verified,
  ADD COLUMN email_verification_expires DATETIME   DEFAULT NULL               AFTER email_verification_token,
  ADD COLUMN reset_password_token     VARCHAR(255) DEFAULT NULL               AFTER email_verification_expires,
  ADD COLUMN reset_password_expires   DATETIME     DEFAULT NULL               AFTER reset_password_token;

-- Index for fast token lookups (token columns are hashed so VARCHAR(255) is fine)
CREATE INDEX idx_users_verification_token ON users (email_verification_token(191));
CREATE INDEX idx_users_reset_token        ON users (reset_password_token(191));
