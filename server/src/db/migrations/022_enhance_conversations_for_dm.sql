-- Migration 022: Enhance conversations table for staff DM support
-- Idempotent: uses IF NOT EXISTS for columns and a stored procedure for the unique index.
-- Compatible with MySQL 8.0+ and MariaDB.

-- Make customer_id nullable so DM conversations (which have no customer) can be stored
ALTER TABLE conversations
  MODIFY COLUMN customer_id CHAR(36) NULL;

-- Add conversation_type discriminator column (idempotent)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_type ENUM('customer_chat', 'staff_dm') NOT NULL DEFAULT 'customer_chat'
    AFTER assigned_admin_id;

-- Add DM participant columns (idempotent)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS dm_participant_a CHAR(36) NULL AFTER conversation_type,
  ADD COLUMN IF NOT EXISTS dm_participant_b CHAR(36) NULL AFTER dm_participant_a;

-- Backfill all existing rows with conversation_type = 'customer_chat'
UPDATE conversations SET conversation_type = 'customer_chat'
  WHERE conversation_type IS NULL OR conversation_type = '';

-- Create unique index only if it does not already exist (idempotent, MariaDB-compatible)
DROP PROCEDURE IF EXISTS migration_022_create_dm_index;

CREATE PROCEDURE migration_022_create_dm_index()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'conversations'
      AND INDEX_NAME   = 'uq_dm_participants'
  ) THEN
    CREATE UNIQUE INDEX uq_dm_participants
      ON conversations (dm_participant_a, dm_participant_b);
  END IF;
END;

CALL migration_022_create_dm_index();

DROP PROCEDURE IF EXISTS migration_022_create_dm_index;
