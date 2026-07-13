-- ============================================================
-- 042_create_manual_revenue_transactions.sql
-- Fitur: Rekap Data Harian — tabel untuk transaksi pendapatan manual
-- ============================================================

CREATE TABLE IF NOT EXISTS manual_revenue_transactions (
  id               CHAR(36)        NOT NULL,
  transaction_date DATE            NOT NULL,
  source_category  ENUM(
    'offline_store',
    'shopee',
    'tokopedia',
    'tiktok_shop'
  )                                NOT NULL,
  amount           DECIMAL(15, 2)  NOT NULL,
  notes            TEXT            DEFAULT NULL,
  created_by       CHAR(36)        NOT NULL,
  updated_by       CHAR(36)        DEFAULT NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME        DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_mrt_date_category (transaction_date, source_category),
  CONSTRAINT fk_mrt_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_mrt_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
