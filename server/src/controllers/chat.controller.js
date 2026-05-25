/**
 * chat.controller.js — Request handlers for chat/conversation endpoints.
 *
 * Requirements: 9.1–9.9
 */

import * as svc from '../services/chat.service.js';
import { StorageService } from '../utils/storage.js';
import { getIO } from '../socket/index.js';
import { query } from '../db/connection.js';

/**
 * Escapes HTML special characters to prevent XSS when content is rendered.
 * Req 9.5
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

function emitMessageNew(conversationId, message) {
  try {
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('message:new', message);
    io.to('staff').emit('message:new', message);
  } catch { /* ignore */ }
}

// GET /api/conversations
export async function listConversations(req, res, next) {
  try {
    const conversations = await svc.listConversations();
    return res.json({ ok: true, data: conversations });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations — customer gets or creates their conversation
// Also callable by staff (CS) to create/get a conversation for a specific customer
export async function getOrCreateConversation(req, res, next) {
  try {
    // If staff sends { customerId, customerName }, use those
    // Otherwise use the authenticated user's own ID (customer calling for themselves)
    const isStaff = STAFF_ROLES.includes(req.user.role);

    if (isStaff && req.body.customerId) {
      // Validate that the provided customerId belongs to a user with role = 'customer' (Req 3.5, 5.5)
      const [userRows] = await query('SELECT id, role FROM users WHERE id = ?', [req.body.customerId]);
      if (userRows.length === 0 || userRows[0].role !== 'customer') {
        return res.status(422).json({ ok: false, message: 'User bukan customer.' });
      }
    }

    const customerId   = req.body.customerId   || req.user.id;
    const customerName = req.body.customerName || req.user.name || '';
    const { conv, created } = await svc.getOrCreateConversation(customerId, customerName);

    // If a new conversation was created, notify all connected staff and add them to the room (Req 1.8, 3.7, 6.4)
    if (created) {
      try {
        const io = getIO();
        const staffSockets = await io.in('staff').fetchSockets();
        staffSockets.forEach((s) => s.join(`conversation:${conv.id}`));
        io.to('staff').emit('conversation:new', conv);
      } catch { /* ignore */ }
    }

    return res.status(201).json({ ok: true, data: conv });
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/:id/messages
export async function getMessages(req, res, next) {
  try {
    const conv = await svc.getConversationById(req.params.id);
    if (!conv) {
      return res.status(404).json({ ok: false, message: 'Percakapan tidak ditemukan.' });
    }

    // Ownership check: customer can only access their own conversation
    if (req.user.role === 'customer' && conv.customer_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Akses ditolak.' });
    }

    const messages = await svc.getMessages(req.params.id);
    return res.json({ ok: true, data: messages });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/messages — text message
export async function sendMessage(req, res, next) {
  try {
    const { content } = req.body;

    // Req 9.1: reject empty / whitespace-only messages
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (trimmed.length === 0) {
      return res.status(422).json({ ok: false, message: 'Pesan tidak boleh kosong.' });
    }

    // Req 9.2: reject messages exceeding 1000 characters
    if (trimmed.length > 1000) {
      return res.status(422).json({ ok: false, message: 'Pesan maksimal 1000 karakter.' });
    }

    const conv = await svc.getConversationById(req.params.id);
    if (!conv) {
      return res.status(404).json({ ok: false, message: 'Percakapan tidak ditemukan.' });
    }
    if (req.user.role === 'customer' && conv.customer_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Akses ditolak.' });
    }

    // Req 9.5: escape HTML special characters before persisting
    const safeContent = escapeHtml(trimmed);

    const message = await svc.saveMessage({
      conversationId: req.params.id,
      senderId:       req.user.id,
      senderRole:     req.user.role,
      type:           'text',
      content:        safeContent,
    });

    emitMessageNew(req.params.id, message);
    return res.status(201).json({ ok: true, data: message });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/:id/messages/file — file message
export async function sendFileMessage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(422).json({ ok: false, message: 'File wajib diunggah.' });
    }

    const conv = await svc.getConversationById(req.params.id);
    if (!conv) {
      return res.status(404).json({ ok: false, message: 'Percakapan tidak ditemukan.' });
    }
    if (req.user.role === 'customer' && conv.customer_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Akses ditolak.' });
    }

    const { url, fileName } = await StorageService.save(req.file, 'chat');

    const message = await svc.saveMessage({
      conversationId: req.params.id,
      senderId:       req.user.id,
      senderRole:     req.user.role,
      type:           'file',
      filePath:       url,
      fileName:       req.file.originalname || fileName,
      fileSize:       req.file.size,
      mimeType:       req.file.mimetype,
    });

    emitMessageNew(req.params.id, message);
    return res.status(201).json({ ok: true, data: message });
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/dm — list DM conversations for the authenticated staff member (Req 2.9, 5.3)
export async function listDMConversations(req, res, next) {
  try {
    const conversations = await svc.listDMConversations(req.user.id);
    return res.json({ ok: true, data: conversations });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations/dm — get or create a DM conversation between two staff members (Req 2.2, 2.4, 2.5, 6.5)
export async function getOrCreateDMConversation(req, res, next) {
  try {
    const { recipientId } = req.body;

    // Validate not self-DM (Req 2.5)
    if (!recipientId || recipientId === req.user.id) {
      return res.status(422).json({ ok: false, message: 'Tidak dapat membuat DM dengan diri sendiri.' });
    }

    // Validate both participants are staff (not customer) (Req 2.4)
    const [recipientRows] = await query('SELECT id, role FROM users WHERE id = ?', [recipientId]);
    if (recipientRows.length === 0 || recipientRows[0].role === 'customer') {
      return res.status(422).json({ ok: false, message: 'Peserta DM harus memiliki role staff.' });
    }

    const conv = await svc.getOrCreateDMConversation(req.user.id, recipientId);

    // Emit dm:new to both participants' personal rooms (Req 6.5)
    try {
      const io = getIO();
      io.to(`staff:${conv.dm_participant_a}`).emit('dm:new', conv);
      io.to(`staff:${conv.dm_participant_b}`).emit('dm:new', conv);
    } catch { /* ignore */ }

    return res.status(201).json({ ok: true, data: conv });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/conversations/:id/read
export async function markAsRead(req, res, next) {
  try {
    const conv = await svc.getConversationById(req.params.id);
    if (conv && conv.conversation_type === 'staff_dm') {
      // For DM conversations, mark messages from the other participant as read (Req 5.8, 2.10)
      await svc.markDMAsRead(req.params.id, req.user.id);
    } else {
      await svc.markAsRead(req.params.id);
    }
    try {
      getIO().to(`conversation:${req.params.id}`).emit('conversation:read', {
        conversationId: req.params.id,
        readAt: new Date().toISOString(),
      });
    } catch { /* ignore */ }
    return res.json({ ok: true, message: 'Pesan ditandai sudah dibaca.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/conversations/:id — admin only
export async function deleteConversation(req, res, next) {
  try {
    // Role guard: admin only
    if (req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, message: 'Akses ditolak. Hanya admin yang dapat menghapus percakapan.' });
    }

    const conv = await svc.getConversationById(req.params.id);
    if (!conv) {
      // Treat 404 as success (already deleted or never existed)
      return res.json({ ok: true });
    }

    const { deletedFilePaths } = await svc.deleteConversation(req.params.id);

    // Delete uploaded files from disk (silently ignores missing files)
    await Promise.all(deletedFilePaths.map((p) => StorageService.delete(p)));

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
