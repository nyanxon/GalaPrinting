-- Migration 045: Create user_permissions table for granular access control.
-- Many-to-many: each row grants one permission key to one user.

CREATE TABLE IF NOT EXISTS user_permissions (
  id              INT          AUTO_INCREMENT PRIMARY KEY,
  user_id         CHAR(36)     NOT NULL,
  permission_key  VARCHAR(50)  NOT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_permission (user_id, permission_key),
  CONSTRAINT fk_userperm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
