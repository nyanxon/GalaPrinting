/**
 * chat.service.js — Chat and conversation business logic.
 *
 * Requirements: 9.1–9.8
 */

import { randomUUID } from 'crypto';
import { query } from '../db/connection.js';

const STAFF_ROLES = new Set(['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline']);

/**
 * List all customer conversations with lastMessage and unreadCount, sorted by last_at DESC.
 * DM conversations are excluded (Req 1.1).
 * Conversations hidden by admin are excluded from the default list — they can still be
 * re-opened via the customer search panel (handleCustomerSelect → createOrGetConversation).
 */
export async function listConversations() {
  const [rows] = await query(
    `SELECT
       c.*,
       (SELECT COUNT(*) FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_role = 'customer'
          AND m.read_at IS NULL) AS unread_count,
       (SELECT JSON_OBJECT(
          'id', m2.id,
          'type', m2.type,
          'content', m2.content,
          'file_name', m2.file_name,
          'sender_role', m2.sender_role,
          'created_at', m2.created_at
        )
        FROM messages m2
        WHERE m2.conversation_id = c.id
        ORDER BY m2.created_at DESC
        LIMIT 1) AS last_message
     FROM conversations c
     WHERE c.conversation_type = 'customer_chat'
       AND (c.hidden_by_admin = 0 OR c.hidden_by_admin IS NULL)
     ORDER BY c.last_at DESC`
  );
  return rows.map((r) => ({
    ...r,
    unreadCount: r.unread_count,
    lastMessage: r.last_message ? (typeof r.last_message === 'string' ? JSON.parse(r.last_message) : r.last_message) : null,
  }));
}

/**
 * Get or create a customer conversation.
 * Explicitly sets conversation_type = 'customer_chat' on INSERT (Req 4.1).
 * If the conversation was hidden by admin, it is automatically un-hidden on access.
 * Returns { conv, created } where created is true if a new conversation was inserted.
 */
export async function getOrCreateConversation(customerId, customerName) {
  const [existing] = await query(
    "SELECT * FROM conversations WHERE customer_id = ? AND conversation_type = 'customer_chat'",
    [customerId]
  );
  if (existing.length > 0) {
    // Un-hide the conversation if it was hidden — accessing it again means admin wants to see it
    if (existing[0].hidden_by_admin) {
      await query('UPDATE conversations SET hidden_by_admin = 0 WHERE id = ?', [existing[0].id]);
    }
    return { conv: { ...existing[0], hidden_by_admin: 0 }, created: false };
  }

  const id = randomUUID();
  await query(
    "INSERT INTO conversations (id, customer_id, customer_name, conversation_type) VALUES (?, ?, ?, 'customer_chat')",
    [id, customerId, customerName]
  );
  const [rows] = await query('SELECT * FROM conversations WHERE id = ?', [id]);
  return { conv: rows[0], created: true };
}

/**
 * Get all messages for a conversation, sorted oldest first.
 */
export async function getMessages(conversationId) {
  const [rows] = await query(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [conversationId]
  );
  return rows;
}

/**
 * Save a new message and update conversation.last_at.
 *
 * Status logic:
 * - Customer mengirim pesan → status "Belum Ditangani": reset assigned_admin_id ke NULL
 * - Admin/staff membalas → status "Ditangani": set assigned_admin_id ke pengirim
 */
export async function saveMessage({ conversationId, senderId, senderRole, type = 'text', content, filePath, fileName, fileSize, mimeType }) {
  const id = randomUUID();
  await query(
    `INSERT INTO messages
       (id, conversation_id, sender_id, sender_role, type, content, file_path, file_name, file_size, mime_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, conversationId, senderId, senderRole, type, content || null, filePath || null, fileName || null, fileSize || null, mimeType || null]
  );

  const isStaff = STAFF_ROLES.has(senderRole);

  if (isStaff) {
    // Admin/staff membalas → tandai sebagai "Ditangani"
    await query(
      'UPDATE conversations SET last_at = NOW(), assigned_admin_id = ? WHERE id = ?',
      [senderId, conversationId]
    );
  } else {
    // Customer mengirim pesan baru → kembali ke "Belum Ditangani"
    await query(
      'UPDATE conversations SET last_at = NOW(), assigned_admin_id = NULL WHERE id = ?',
      [conversationId]
    );
  }

  const [rows] = await query('SELECT * FROM messages WHERE id = ?', [id]);
  return rows[0];
}

/**
 * Mark all unread customer messages in a conversation as read.
 */
export async function markAsRead(conversationId) {
  await query(
    `UPDATE messages
     SET read_at = NOW()
     WHERE conversation_id = ?
       AND sender_role = 'customer'
       AND read_at IS NULL`,
    [conversationId]
  );
}

/**
 * Get a conversation by ID.
 */
export async function getConversationById(id) {
  const [rows] = await query('SELECT * FROM conversations WHERE id = ?', [id]);
  return rows[0] || null;
}

/**
 * Hide a conversation from the admin chat list without deleting any data.
 * The conversation and all its messages remain in the database.
 * It reappears in the list as soon as the admin opens it again via customer search.
 *
 * @param {string} conversationId
 * @returns {Promise<boolean>} true if the row was found and updated
 */
export async function hideConversation(conversationId) {
  const [result] = await query(
    'UPDATE conversations SET hidden_by_admin = 1 WHERE id = ? AND conversation_type = ?',
    [conversationId, 'customer_chat']
  );
  return result.affectedRows > 0;
}

/**
 * Delete a conversation and all its messages (cascade).
 * Returns the file paths of any file messages so the controller can delete them from disk.
 *
 * @param {string} conversationId
 * @returns {Promise<{ deletedFilePaths: string[] }>}
 */
export async function deleteConversation(conversationId) {
  // Collect file paths from file-type messages before deleting
  const [fileMessages] = await query(
    "SELECT file_path FROM messages WHERE conversation_id = ? AND type = 'file' AND file_path IS NOT NULL",
    [conversationId]
  );
  const deletedFilePaths = fileMessages.map((m) => m.file_path).filter(Boolean);

  // DELETE FROM conversations cascades to messages automatically (FK ON DELETE CASCADE)
  await query('DELETE FROM conversations WHERE id = ?', [conversationId]);

  return { deletedFilePaths };
}

/**
 * List all DM conversations for a given user, enriched with lastMessage and unreadCount.
 * Joins with the users table to resolve the other participant's name and role.
 * Sorted by last_at DESC (Req 2.9, 2.11).
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function listDMConversations(userId) {
  const [rows] = await query(
    `SELECT
       c.id,
       c.conversation_type,
       c.dm_participant_a,
       c.dm_participant_b,
       c.last_at,
       CASE
         WHEN c.dm_participant_a = ? THEN c.dm_participant_b
         ELSE c.dm_participant_a
       END AS other_participant_id,
       u.name  AS other_participant_name,
       u.role  AS other_participant_role,
       (SELECT COUNT(*)
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id != ?
          AND m.read_at IS NULL) AS unread_count,
       (SELECT JSON_OBJECT(
          'id', m2.id,
          'type', m2.type,
          'content', m2.content,
          'file_name', m2.file_name,
          'sender_role', m2.sender_role,
          'created_at', m2.created_at
        )
        FROM messages m2
        WHERE m2.conversation_id = c.id
        ORDER BY m2.created_at DESC
        LIMIT 1) AS last_message
     FROM conversations c
     JOIN users u ON u.id = CASE
       WHEN c.dm_participant_a = ? THEN c.dm_participant_b
       ELSE c.dm_participant_a
     END
     WHERE c.conversation_type = 'staff_dm'
       AND (c.dm_participant_a = ? OR c.dm_participant_b = ?)
     ORDER BY c.last_at DESC`,
    [userId, userId, userId, userId, userId]
  );

  return rows.map((r) => ({
    ...r,
    unread_count: Number(r.unread_count),
    last_message: r.last_message
      ? (typeof r.last_message === 'string' ? JSON.parse(r.last_message) : r.last_message)
      : null,
  }));
}

/**
 * Get or create a DM conversation between two staff members.
 * Normalises participant order so the lower UUID is always in dm_participant_a,
 * preventing duplicate DM rows (Req 2.2, 4.3, 4.4).
 *
 * @param {string} userAId
 * @param {string} userBId
 * @returns {Promise<object>} The conversation row.
 */
export async function getOrCreateDMConversation(userAId, userBId) {
  // Canonical ordering: lower UUID in dm_participant_a
  const [participantA, participantB] = [userAId, userBId].sort();

  const [existing] = await query(
    `SELECT * FROM conversations
     WHERE conversation_type = 'staff_dm'
       AND dm_participant_a = ?
       AND dm_participant_b = ?`,
    [participantA, participantB]
  );
  if (existing.length > 0) return existing[0];

  const id = randomUUID();
  await query(
    `INSERT INTO conversations
       (id, conversation_type, dm_participant_a, dm_participant_b)
     VALUES (?, 'staff_dm', ?, ?)`,
    [id, participantA, participantB]
  );
  const [rows] = await query('SELECT * FROM conversations WHERE id = ?', [id]);
  return rows[0];
}

/**
 * Mark all messages in a DM conversation sent by the other participant (not readerId) as read.
 * (Req 2.10)
 *
 * @param {string} conversationId
 * @param {string} readerId  The user who is reading (their own messages are NOT marked).
 */
export async function markDMAsRead(conversationId, readerId) {
  await query(
    `UPDATE messages
     SET read_at = NOW()
     WHERE conversation_id = ?
       AND sender_id != ?
       AND read_at IS NULL`,
    [conversationId, readerId]
  );
}

/**
 * Count unread messages sent by admin/staff in a customer's conversation.
 * Used to power the notification bubble on the customer chat widget.
 *
 * A message is "unread by customer" when:
 *   - sender_role is NOT 'customer'
 *   - read_at IS NULL
 *
 * @param {string} customerId
 * @returns {Promise<number>} Unread count (0 if no conversation exists yet)
 */
export async function getCustomerUnreadCount(customerId) {
  const [rows] = await query(
    `SELECT COUNT(*) AS cnt
     FROM messages m
     INNER JOIN conversations c ON c.id = m.conversation_id
     WHERE c.customer_id = ?
       AND c.conversation_type = 'customer_chat'
       AND m.sender_role != 'customer'
       AND m.read_at IS NULL`,
    [customerId]
  );
  return Number(rows[0]?.cnt ?? 0);
}

/**
 * Mark all admin/staff messages in a customer's conversation as read by the customer.
 * Called when the customer opens their chat widget.
 *
 * @param {string} customerId
 */
export async function markAdminMessagesRead(customerId) {
  await query(
    `UPDATE messages m
     INNER JOIN conversations c ON c.id = m.conversation_id
     SET m.read_at = NOW()
     WHERE c.customer_id = ?
       AND c.conversation_type = 'customer_chat'
       AND m.sender_role != 'customer'
       AND m.read_at IS NULL`,
    [customerId]
  );
}
