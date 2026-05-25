CREATE TABLE IF NOT EXISTS reviews (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  product_id    CHAR(36)     DEFAULT NULL,
  customer_id   CHAR(36)     NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  rating        TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_product  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_review_customer FOREIGN KEY (customer_id) REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
