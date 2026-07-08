-- ============================================================
-- 038_create_order_approvals.sql
-- Fitur 1: Tabel approval per tahap order supaya status bisa di-lock
-- setelah di-ACC oleh admin yang berwenang.
-- ============================================================

CREATE TABLE IF NOT EXISTS order_approvals (
  id            CHAR(36)      NOT NULL PRIMARY KEY,
  order_id      CHAR(36)      NOT NULL,
  stage         VARCHAR(60)   NOT NULL COMMENT 'Status yang di-approve, e.g. Payment Accepted',
  approved_by   CHAR(36)      NOT NULL COMMENT 'user_id yang meng-approve',
  approved_role VARCHAR(40)   NOT NULL COMMENT 'role saat approve, e.g. cashier',
  approved_name VARCHAR(120)  NOT NULL DEFAULT '' COMMENT 'Nama admin snapshot saat approve',
  approved_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_stage (order_id, stage),
  CONSTRAINT fk_approval_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_approval_user  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
