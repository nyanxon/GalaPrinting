CREATE TABLE IF NOT EXISTS messages (
  id              CHAR(36)    NOT NULL PRIMARY KEY,
  conversation_id CHAR(36)    NOT NULL,
  sender_id       CHAR(36)    NOT NULL,
  sender_role     VARCHAR(20) NOT NULL,
  type            ENUM('text','file') NOT NULL DEFAULT 'text',
  content         TEXT,
  file_path       VARCHAR(500),
  file_name       VARCHAR(255),
  file_size       BIGINT,
  mime_type       VARCHAR(100),
  read_at         DATETIME    DEFAULT NULL,
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conv   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id)       REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
