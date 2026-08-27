-- 054_drop_users_fk_constraints.sql
-- Drops all FOREIGN KEY constraints that reference the old `users` table.
-- After this migration, application code is responsible for validating
-- that referenced user IDs exist in the correct table (users_customer or users_admin).

-- orders.customer_id
ALTER TABLE orders DROP FOREIGN KEY fk_order_customer;

-- order_history.actor_id
ALTER TABLE order_history DROP FOREIGN KEY fk_history_actor;

-- cart_items.user_id
ALTER TABLE cart_items DROP FOREIGN KEY fk_cart_user;

-- conversations.customer_id + assigned_admin_id
ALTER TABLE conversations DROP FOREIGN KEY fk_conv_customer;
ALTER TABLE conversations DROP FOREIGN KEY fk_conv_admin;

-- messages.sender_id
ALTER TABLE messages DROP FOREIGN KEY fk_msg_sender;

-- reviews.customer_id
ALTER TABLE reviews DROP FOREIGN KEY fk_review_customer;

-- addresses.user_id
ALTER TABLE addresses DROP FOREIGN KEY fk_address_user;

-- notification_preferences.user_id
ALTER TABLE notification_preferences DROP FOREIGN KEY fk_notif_pref_user;

-- revenue_reset_log.performed_by
ALTER TABLE revenue_reset_log DROP FOREIGN KEY fk_reset_actor;

-- order_approvals.approved_by
ALTER TABLE order_approvals DROP FOREIGN KEY fk_approval_user;

-- invoices.customer_id
ALTER TABLE invoices DROP FOREIGN KEY fk_invoice_customer;

-- manual_revenue_transactions.created_by + updated_by
ALTER TABLE manual_revenue_transactions DROP FOREIGN KEY fk_mrt_created_by;
ALTER TABLE manual_revenue_transactions DROP FOREIGN KEY fk_mrt_updated_by;

-- admin_permissions.user_id
ALTER TABLE admin_permissions DROP FOREIGN KEY fk_adminperm_user;

-- user_permissions.user_id
ALTER TABLE user_permissions DROP FOREIGN KEY fk_userperm_user;
