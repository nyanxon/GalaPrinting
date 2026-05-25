CREATE TABLE IF NOT EXISTS conversations (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  customer_id       CHAR(36)     NOT NULL,
  customer_name     VARCHAR(120) NOT NULL,
  assigned_admin_id CHAR(36)     DEFAULT NULL,
  last_at           DATETIME     DEFAULT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conv_customer FOREIGN KEY (customer_id)       REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_admin    FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
