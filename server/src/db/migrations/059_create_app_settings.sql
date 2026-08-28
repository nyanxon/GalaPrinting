-- Migration 059: Simple key/value app settings table (Fitur Activity Log, Fase 5).
--
-- Backs the configurable auto-retention for the activity log (and is generic
-- enough for future settings). Values stored as short VARCHAR strings.

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(100) NOT NULL,
  setting_value VARCHAR(255) NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
