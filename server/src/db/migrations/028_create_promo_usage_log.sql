-- Migration 024: Create promo_usage_log table
-- Tracks every time a promo code is used: who used it, when, and on which order

CREATE TABLE IF NOT EXISTS promo_usage_log (
  id            CHAR(36)      NOT NULL PRIMARY KEY,
  promo_code_id CHAR(36)      NOT NULL,
  order_id      CHAR(36)      NOT NULL,
  user_id       CHAR(36)      DEFAULT NULL,
  customer_name VARCHAR(120)  DEFAULT NULL,
  customer_email VARCHAR(120) DEFAULT NULL,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  order_subtotal  DECIMAL(15,2) NOT NULL DEFAULT 0,
  used_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pul_promo_code_id (promo_code_id),
  INDEX idx_pul_used_at       (used_at),
  INDEX idx_pul_user_id       (user_id),
  CONSTRAINT fk_pul_promo FOREIGN KEY (promo_code_id)
    REFERENCES promo_codes(id) ON DELETE CASCADE,
  CONSTRAINT fk_pul_order FOREIGN KEY (order_id)
    REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
