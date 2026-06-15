/**
 * chat.routes.js — Conversation and message routes.
 *
 * Requirements: 9.1–9.9
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadChat } from '../middleware/upload.js';
import * as ctrl from '../controllers/chat.controller.js';

const router = Router();

// GET /api/conversations/unread-count (customer only — unread messages from admin)
router.get(
  '/unread-count',
  authenticate,
  requireRole('customer'),
  ctrl.getCustomerUnreadCount
);

// List all conversations (staff only)
router.get(
  '/',
  authenticate,
  requireRole('admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'),
  ctrl.listConversations
);

// Customer gets or creates their own conversation
router.post(
  '/',
  authenticate,
  ctrl.getOrCreateConversation
);

// List DM conversations for the authenticated staff member (Req 2.9, 5.3)
// MUST be registered before GET /:id/messages to avoid Express treating "dm" as a conversation ID
router.get(
  '/dm',
  authenticate,
  requireRole('admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'),
  ctrl.listDMConversations
);

// Get or create a DM conversation between two staff members (Req 2.2, 5.2)
router.post(
  '/dm',
  authenticate,
  requireRole('admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'),
  ctrl.getOrCreateDMConversation
);

// Get messages (customer own + staff)
router.get('/:id/messages', authenticate, ctrl.getMessages);

// Send text message
router.post('/:id/messages', authenticate, ctrl.sendMessage);

// Send file message
router.post(
  '/:id/messages/file',
  authenticate,
  uploadChat.single('file'),
  ctrl.sendFileMessage
);

// Mark admin messages as read (customer opens widget)
router.post(
  '/mark-read',
  authenticate,
  requireRole('customer'),
  ctrl.markAdminMessagesRead
);

// Mark messages as read (staff)
router.patch(
  '/:id/read',
  authenticate,
  requireRole('admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'),
  ctrl.markAsRead
);

// Hide a conversation (admin only) — removes from list but keeps all history
router.patch(
  '/:id/hide',
  authenticate,
  requireRole('admin'),
  ctrl.hideConversation
);

// Delete a conversation (admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  ctrl.deleteConversation
);

export default router;
