CREATE TABLE IF NOT EXISTS promo_codes (
  id          CHAR(36)      NOT NULL PRIMARY KEY,
  code        VARCHAR(50)   NOT NULL UNIQUE,
  type        ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
  value       DECIMAL(10,2) NOT NULL,
  max_uses    INT           DEFAULT NULL,
  usage_count INT           NOT NULL DEFAULT 0,
  expires_at  DATETIME      DEFAULT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
