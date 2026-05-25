CREATE TABLE IF NOT EXISTS orders (
  id                  CHAR(36)      NOT NULL PRIMARY KEY,
  order_number        VARCHAR(50)   NOT NULL UNIQUE,
  order_type          ENUM('standard','custom') NOT NULL DEFAULT 'standard',
  source              ENUM('online','offline','custom') NOT NULL DEFAULT 'online',
  customer_id         CHAR(36)      DEFAULT NULL,
  customer_name       VARCHAR(120),
  customer_phone      VARCHAR(30),
  customer_address    TEXT,
  status              VARCHAR(60)   NOT NULL DEFAULT 'Waiting for Payment',
  subtotal            DECIMAL(15,2) NOT NULL DEFAULT 0,
  admin_note          TEXT,
  tracking_number     VARCHAR(100),
  courier_name        VARCHAR(100),
  payment_proof_path  VARCHAR(500),
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
