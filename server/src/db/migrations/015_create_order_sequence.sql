CREATE TABLE IF NOT EXISTS order_sequence (
  id          INT          NOT NULL DEFAULT 1 PRIMARY KEY,
  last_seq    INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed the single row if it doesn't exist
INSERT IGNORE INTO order_sequence (id, last_seq) VALUES (1, 0);
