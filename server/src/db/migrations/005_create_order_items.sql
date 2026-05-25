CREATE TABLE IF NOT EXISTS order_items (
  id               CHAR(36)      NOT NULL PRIMARY KEY,
  order_id         CHAR(36)      NOT NULL,
  product_id       CHAR(36)      DEFAULT NULL,
  name             VARCHAR(191)  NOT NULL,
  price            DECIMAL(15,2) NOT NULL,
  quantity         INT           NOT NULL DEFAULT 1,
  color            VARCHAR(60),
  size             VARCHAR(60),
  material         VARCHAR(100),
  notes            TEXT,
  design_file_path VARCHAR(500),
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_item_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
