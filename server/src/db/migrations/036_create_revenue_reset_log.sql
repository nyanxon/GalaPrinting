-- 036_create_revenue_reset_log.sql
-- Audit table: records every time an owner performs a revenue data reset.
-- This is the only permanent record of the action after the data is gone.

CREATE TABLE IF NOT EXISTS revenue_reset_log (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  performed_by CHAR(36)     DEFAULT NULL COMMENT 'user.id of the owner who triggered the reset',
  performed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  orders_deleted   INT      NOT NULL DEFAULT 0  COMMENT 'number of order rows removed',
  visits_deleted   INT      NOT NULL DEFAULT 0  COMMENT 'number of analytics_visits rows removed',
  views_deleted    INT      NOT NULL DEFAULT 0  COMMENT 'number of analytics_product_views rows removed',
  note         TEXT         DEFAULT NULL        COMMENT 'optional reason entered by owner',
  CONSTRAINT fk_reset_actor FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
