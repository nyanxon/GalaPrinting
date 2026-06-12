-- Migration 030: Add hidden_by_admin flag to conversations
-- Allows admin to "close" (hide) a chat from the list without deleting messages.
-- The conversation and all its history remain accessible via search.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS hidden_by_admin TINYINT(1) NOT NULL DEFAULT 0
    AFTER last_at;
