-- Migration 056: Add must_change_password boolean to users_admin.
--
-- When Owner creates a new staff account with a known password, the staff
-- member is forced to change it on first login. The frontend checks the
-- flag in the login response; the backend enforces it via the authenticate
-- middleware (blocks all protected routes except /auth/change-password and
-- /auth/me).

ALTER TABLE users_admin
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0
    AFTER is_promoted_admin;
