-- Migration 058: Per-reader read-state for the Activity Log (Fitur Activity Log, Fase 5).
--
-- Tracks which admin/owner has already seen each log row, so each reader gets
-- their own unread badge. This is a junction table keyed by (log_id, reader).
-- No FK to activity_logs on purpose: if the log table is ever pruned, orphan
-- read rows are harmless and cheap to ignore.

CREATE TABLE IF NOT EXISTS activity_log_reads (
  log_id          BIGINT      NOT NULL,
  reader_user_id  CHAR(36)    NOT NULL,
  read_at         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id, reader_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
