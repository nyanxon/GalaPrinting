CREATE TABLE IF NOT EXISTS analytics_product_views (
  id         BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  view_date  DATE     NOT NULL,
  count      INT      NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_date (product_id, view_date),
  CONSTRAINT fk_view_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
