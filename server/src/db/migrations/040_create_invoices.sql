-- ============================================================
-- 040_create_invoices.sql
-- Fitur 2: Tabel invoices untuk cashier
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id              CHAR(36)      NOT NULL PRIMARY KEY,
  invoice_number  VARCHAR(50)   NOT NULL UNIQUE
                  COMMENT 'Format: INV/YYYY/MM/NNNNNN',
  order_id        CHAR(36)      NOT NULL,
  customer_id     CHAR(36)      DEFAULT NULL,
  subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
  total           DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_status  ENUM('unpaid','paid','partial') NOT NULL DEFAULT 'unpaid',
  payment_method  VARCHAR(60)   DEFAULT NULL,
  notes           TEXT          DEFAULT NULL,
  created_by      CHAR(36)      DEFAULT NULL COMMENT 'cashier user_id (null for auto-generated)',
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at         DATETIME      DEFAULT NULL,
  pdf_path        VARCHAR(500)  DEFAULT NULL COMMENT 'Path ke file PDF jika disimpan',
  locked          TINYINT(1)    NOT NULL DEFAULT 0
                  COMMENT '1 = invoice sudah paid & locked, tidak bisa diedit',
  CONSTRAINT fk_invoice_order    FOREIGN KEY (order_id)    REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sequence untuk nomor invoice
CREATE TABLE IF NOT EXISTS invoice_sequence (
  id       INT  NOT NULL PRIMARY KEY DEFAULT 1,
  last_seq INT  NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO invoice_sequence (id, last_seq) VALUES (1, 0);
