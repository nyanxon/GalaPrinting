CREATE TABLE IF NOT EXISTS products (
  id                CHAR(36)       NOT NULL PRIMARY KEY,
  category_id       CHAR(36)       DEFAULT NULL,
  name              VARCHAR(191)   NOT NULL,
  slug              VARCHAR(191)   NOT NULL UNIQUE,
  price             DECIMAL(15,2)  NOT NULL DEFAULT 0,
  short_description VARCHAR(500),
  requires_design   TINYINT(1)     NOT NULL DEFAULT 0,
  colors            JSON,
  sizes             JSON,
  materials         JSON,
  image_path        VARCHAR(500),
  created_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
