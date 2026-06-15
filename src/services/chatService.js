/**
 * services/chatService.js
 *
 * Business logic for the customer ↔ admin chat system.
 * Rule: 1 customer = 1 conversation.
 *
 * Data model:
 *   Conversation { id, customerId, customerName, assignedAdminId, status, createdAt, lastAt }
 *   Message      { id, conversationId, senderId, senderRole, type, content,
 *                  fileName, fileSize, createdAt }
 *
 * Real-time sync:
 *   - Same tab:   CustomEvent "gala:chat-updated"
 *   - Cross tab:  localStorage "storage" event (key = CHAT_KEY)
 *
 * When USE_BACKEND=true:
 *   - All CRUD operations call the backend REST API.
 *   - A Socket.io client is initialised after login and dispatches DOM events
 *     for incoming real-time messages and order updates.
 *
 * Requirements: 16.1, 16.6, 16.7
 */

import { readJson, writeJson } from "../core/storage.js";
import { escapeHtml } from "../core/helpers.js";
import { USE_BACKEND, api } from "../core/httpClient.js";
import { io } from "socket.io-client";
import { registerSocketHandlers } from "./authService.js";

const CHAT_KEY = "gala.chats";

/* ── Allowed file types ──────────────────────────────────── */
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
]);
const ALLOWED_EXT  = new Set(["pdf", "png", "jpg", "jpeg", "zip"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/* ══════════════════════════════════════════════════════════
   SOCKET.IO CLIENT
   Requirements: 16.6, 16.7
   ══════════════════════════════════════════════════════════ */

/** @type {import('socket.io-client').Socket | null} */
let socket = null;

/**
 * Pending conversation rooms to join once the socket connects.
 * Populated when gala:join-conversation fires before the socket is ready.
 * @type {Set<string>}
 */
const _pendingRoomJoins = new Set();

/**
 * Stable handler for the gala:join-conversation window event.
 * Kept outside connectSocket so it is only ever registered once and can be
 * properly cleaned up by disconnectSocket.
 * @param {CustomEvent} e
 */
function _handleJoinConversation(e) {
  const { conversationId } = e.detail || {};
  if (!conversationId) return;
  if (socket?.connected) {
    socket.emit('join:conversation', { conversationId });
  } else {
    // Socket not yet connected — queue the join for when it connects
    _pendingRoomJoins.add(conversationId);
  }
}

/**
 * Connect to the Socket.io server using the provided access token.
 * Registers event listeners that dispatch DOM CustomEvents so any React
 * component can subscribe without prop-drilling.
 *
 * Called by authService after a successful login/register.
 *
 * @param {string} accessToken
 */
export function connectSocket(accessToken) {
  // Avoid duplicate connections
  if (socket && socket.connected) return;

  const serverUrl = import.meta.env.VITE_API_URL || undefined;

  socket = io(serverUrl, {
    auth: { token: accessToken },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    // Flush any rooms that were requested before the socket was ready
    _pendingRoomJoins.forEach((conversationId) => {
      socket.emit('join:conversation', { conversationId });
    });
    _pendingRoomJoins.clear();
  });

  socket.on("connect_error", (err) => {
    console.warn("[chatService] Socket.io connect error:", err.message);
  });

  // ── Incoming message ──────────────────────────────────────
  // Requirement 16.7
  socket.on("message:new", (payload) => {
    window.dispatchEvent(new CustomEvent("gala:message-new", { detail: payload }));
  });

  // ── Order status changed ──────────────────────────────────
  // Requirement 16.7
  socket.on("order:status_changed", (payload) => {
    window.dispatchEvent(new CustomEvent("gala:order-status-changed", { detail: payload }));
  });

  // ── New order (staff notification) ───────────────────────
  // Requirement 16.7
  socket.on("order:new", (payload) => {
    window.dispatchEvent(new CustomEvent("gala:order-new", { detail: payload }));
  });

  // ── Conversation read receipt ─────────────────────────────
  socket.on("conversation:read", (payload) => {
    window.dispatchEvent(new CustomEvent("gala:conversation-read", { detail: payload }));
  });

  // ── New DM conversation (staff notification) ──────────────
  // Requirements: 8.9, 6.5
  socket.on("dm:new", (payload) => {
    window.dispatchEvent(new CustomEvent("gala:dm-new", { detail: payload }));
  });

  // Register the window-level join handler once per connection lifecycle.
  // Using a stable named function avoids duplicate listener accumulation.
  window.removeEventListener('gala:join-conversation', _handleJoinConversation);
  window.addEventListener('gala:join-conversation', _handleJoinConversation);
}

/**
 * Disconnect the Socket.io client and release the reference.
 * Called by authService on logout.
 */
export function disconnectSocket() {
  window.removeEventListener('gala:join-conversation', _handleJoinConversation);
  _pendingRoomJoins.clear();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/* ── Register socket lifecycle with authService ──────────── */
// Wire up connect/disconnect so the socket follows the auth lifecycle.
// Called once at module load time.
registerSocketHandlers({ connect: connectSocket, disconnect: disconnectSocket });

/* ── Storage helpers (localStorage path) ────────────────── */
function load() {
  const raw = readJson(CHAT_KEY, null);

  // Migration: old format was a plain array of conversations with embedded messages.
  // New format is { conversations: [], messages: [] }.
  if (Array.isArray(raw)) {
    // Convert old format → new format
    const conversations = [];
    const messages      = [];
    raw.forEach((conv) => {
      const { messages: embeddedMsgs = [], ...convData } = conv;
      // Ensure required new fields exist
      conversations.push({
        assignedAdminId: null,
        status:          "open",
        ...convData,
      });
      embeddedMsgs.forEach((m) => {
        messages.push({
          id:             m.id || crypto.randomUUID(),
          conversationId: conv.id,
          senderId:       m.from === "customer" ? (conv.customerId || "unknown") : "admin",
          senderRole:     m.from || "customer",
          type:           "text",
          content:        m.text || "",
          fileName:       null,
          fileSize:       null,
          createdAt:      m.at || new Date().toISOString(),
          readAt:         null,
        });
      });
    });
    const migrated = { conversations, messages };
    writeJson(CHAT_KEY, migrated);
    return migrated;
  }

  // Normal case: already new format or empty
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return {
      conversations: Array.isArray(raw.conversations) ? raw.conversations : [],
      messages:      Array.isArray(raw.messages)      ? raw.messages      : [],
    };
  }

  return { conversations: [], messages: [] };
}

function saveLocal(data) {
  writeJson(CHAT_KEY, data);
  // Notify same-tab subscribers
  window.dispatchEvent(new CustomEvent("gala:chat-updated", { detail: data }));
}

/* ── File validation ─────────────────────────────────────── */
/**
 * @param {File} file
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateFile(file) {
  if (!file) return { ok: false, message: "File tidak ditemukan." };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext) && !ALLOWED_MIME.has(file.type)) {
    return { ok: false, message: "Format file tidak didukung. Gunakan PDF, PNG, JPG, JPEG, atau ZIP." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: "Ukuran file maksimal 5 MB." };
  }
  return { ok: true };
}

/* ══════════════════════════════════════════════════════════
   CONVERSATION API
   ══════════════════════════════════════════════════════════ */

/**
 * Get all DM conversations for the authenticated staff member, sorted newest first.
 * Maps snake_case fields to camelCase.
 *
 * - USE_BACKEND=true : GET /api/conversations/dm
 * - USE_BACKEND=false: returns empty array (DM is backend-only)
 *
 * Requirements: 2.9
 *
 * @returns {Promise<Array>}
 */
export async function getDMConversations() {
  if (USE_BACKEND) {
    const res = await api.get("/api/conversations/dm");
    const raw = res.data.data ?? res.data.items ?? [];
    return raw.map((c) => ({
      ...c,
      otherParticipantId:   c.other_participant_id   ?? c.otherParticipantId,
      otherParticipantName: c.other_participant_name  ?? c.otherParticipantName,
      otherParticipantRole: c.other_participant_role  ?? c.otherParticipantRole,
      lastAt:               c.last_at                ?? c.lastAt,
      unreadCount:          c.unread_count            ?? c.unreadCount ?? 0,
      lastMessage:          c.last_message            ?? c.lastMessage ?? null,
      dmParticipantA:       c.dm_participant_a        ?? c.dmParticipantA,
      dmParticipantB:       c.dm_participant_b        ?? c.dmParticipantB,
    }));
  }

  // DM conversations are backend-only
  return [];
}

/**
 * Create or get an existing DM conversation with the given recipient.
 *
 * - USE_BACKEND=true : POST /api/conversations/dm with { recipientId }
 * - USE_BACKEND=false: returns null (DM is backend-only)
 *
 * Requirements: 2.2
 *
 * @param {string} recipientId
 * @returns {Promise<object|null>}
 */
export async function createOrGetDMConversation(recipientId) {
  if (USE_BACKEND) {
    const res = await api.post("/api/conversations/dm", { recipientId });
    return res.data.data;
  }

  // DM conversations are backend-only
  return null;
}

/**
 * Search registered customers by name or phone number.
 *
 * - USE_BACKEND=true : GET /api/users/customers?q={query}
 * - USE_BACKEND=false: returns empty array
 *
 * Requirements: 3.2, 3.3
 *
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchCustomers(query) {
  if (USE_BACKEND) {
    const res = await api.get(`/api/users/customers?q=${encodeURIComponent(query)}`);
    return res.data.data ?? res.data.items ?? [];
  }

  return [];
}

/**
 * Search staff members by name.
 *
 * - USE_BACKEND=true : GET /api/users/staff?q={query}
 * - USE_BACKEND=false: returns empty array
 *
 * Requirements: 2.12, 2.13
 *
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchStaff(query) {
  if (USE_BACKEND) {
    const res = await api.get(`/api/users/staff?q=${encodeURIComponent(query)}`);
    return res.data.data ?? res.data.items ?? [];
  }

  return [];
}

/**
 * Get existing conversation for a customer, or create a new one.
 * Enforces 1 customer = 1 conversation.
 *
 * - USE_BACKEND=true : POST /api/conversations
 * - USE_BACKEND=false: localStorage implementation (unchanged)
 *
 * @param {string} customerId
 * @param {string} customerName
 * @returns {Promise<object>|object} conversation
 */
export async function createOrGetConversation(customerId, customerName) {
  if (USE_BACKEND) {
    const res = await api.post("/api/conversations", { customerId, customerName });
    return res.data.data;
  }

  // Original localStorage implementation (unchanged)
  const data = load();
  const existing = data.conversations.find((c) => c.customerId === customerId);
  if (existing) {
    // Un-hide if previously hidden — re-opening via search makes it visible again
    if (existing.hidden_by_admin) {
      existing.hidden_by_admin = false;
      saveLocal(data);
    }
    return existing;
  }

  const conv = {
    id:              crypto.randomUUID(),
    customerId,
    customerName:    String(customerName || "Customer").trim(),
    assignedAdminId: null,
    status:          "open",
    createdAt:       new Date().toISOString(),
    lastAt:          new Date().toISOString(),
  };
  data.conversations.unshift(conv);
  saveLocal(data);
  return conv;
}

/**
 * Get all conversations (admin/owner view), sorted newest first.
 * Each entry is enriched with lastMessage and unreadCount.
 *
 * - USE_BACKEND=true : GET /api/conversations
 * - USE_BACKEND=false: localStorage implementation (unchanged)
 *
 * @returns {Promise<Array>|Array}
 */
export async function getAllConversations() {
  if (USE_BACKEND) {
    const res = await api.get("/api/conversations");
    const raw = res.data.data ?? res.data.items ?? [];
    return raw.map((c) => ({
      ...c,
      customerId:      c.customer_id      ?? c.customerId,
      customerName:    c.customer_name    ?? c.customerName,
      assignedAdminId: c.assigned_admin_id ?? c.assignedAdminId,
      lastAt:          c.last_at          ?? c.lastAt,
      unreadCount:     c.unread_count     ?? c.unreadCount ?? 0,
    }));
  }

  // Original localStorage implementation (unchanged)
  const data = load();
  return data.conversations
    .filter((conv) => !conv.hidden_by_admin)
    .map((conv) => {
      const msgs = data.messages
        .filter((m) => m.conversationId === conv.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const lastMessage = msgs[msgs.length - 1] ?? null;
      const unreadCount = msgs.filter((m) => m.senderRole === "customer" && !m.readAt).length;
      const needsReply  = conv.needsReply ?? (lastMessage?.senderRole === "customer");
      return { ...conv, lastMessage, unreadCount, needsReply };
    })
    .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

/**
 * Get a conversation by id (localStorage mode only).
 * In backend mode, use the conversations API instead.
 * @param {string} convId
 */
export function getConversationById(convId) {
  if (USE_BACKEND) {
    console.warn('[chatService] getConversationById called in backend mode — use the conversations API instead');
    return null;
  }
  return load().conversations.find((c) => c.id === convId) ?? null;
}

/**
 * Get a customer's conversation (localStorage mode only).
 * In backend mode, use createOrGetConversation() instead.
 * @param {string} customerId
 */
export function getConversationByCustomer(customerId) {
  if (USE_BACKEND) {
    console.warn('[chatService] getConversationByCustomer called in backend mode — use createOrGetConversation()');
    return null;
  }
  return load().conversations.find((c) => c.customerId === customerId) ?? null;
}

/* ══════════════════════════════════════════════════════════
   MESSAGE API
   ══════════════════════════════════════════════════════════ */

/**
 * Get all messages for a conversation, sorted oldest → newest.
 *
 * - USE_BACKEND=true : GET /api/conversations/:id/messages
 * - USE_BACKEND=false: localStorage implementation (unchanged)
 *
 * @param {string} convId
 * @returns {Promise<Array>|Array}
 */
export async function getMessagesByConversation(convId) {
  if (USE_BACKEND) {
    const res = await api.get(`/api/conversations/${convId}/messages`);
    const raw = res.data.data ?? res.data.items ?? [];
    return raw.map((m) => ({
      ...m,
      senderId:   m.sender_id   ?? m.senderId,
      senderRole: m.sender_role ?? m.senderRole,
      fileName:   m.file_name   ?? m.fileName,
      fileSize:   m.file_size   ?? m.fileSize,
      mimeType:   m.mime_type   ?? m.mimeType,
      filePath:   m.file_path   ?? m.filePath,
      readAt:     m.read_at     ?? m.readAt,
      createdAt:  m.created_at  ?? m.createdAt,
    }));
  }

  // Original localStorage implementation (unchanged)
  return load().messages
    .filter((m) => m.conversationId === convId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * Get all messages for a customer (resolves their conversation first).
 * @param {string} customerId
 * @param {string} [customerName=""]
 * @returns {Promise<Array>|Array}
 */
export async function getMessagesByCustomer(customerId, customerName = "") {
  if (USE_BACKEND) {
    // Find or create the conversation first, then fetch messages
    const conv = await createOrGetConversation(customerId, customerName || customerId);
    if (!conv) return [];
    return getMessagesByConversation(conv.id);
  }

  // Original localStorage implementation (unchanged)
  const conv = getConversationByCustomer(customerId);
  if (!conv) return [];
  return getMessagesByConversation(conv.id);
}

/**
 * Send a text message.
 *
 * - USE_BACKEND=true : POST /api/conversations/:id/messages
 * - USE_BACKEND=false: localStorage implementation (unchanged)
 *
 * @param {{
 *   customerId:    string,
 *   senderId:      string,
 *   senderRole:    "customer"|"admin"|"owner",
 *   type:          "text"|"file",
 *   content:       string,
 *   file?:         File,
 *   customerName?: string,
 * }} opts
 * @returns {Promise<{ ok: boolean, message?: string, msg?: object }>}
 */
export async function sendMessage({ customerId, senderId, senderRole, type = "text", content, file, customerName }) {
  if (USE_BACKEND) {
    // Ensure conversation exists
    const conv = await createOrGetConversation(customerId, customerName || customerId);
    if (!conv) return { ok: false, message: "Percakapan tidak ditemukan." };

    if (type === "text") {
      const trimmed = escapeHtml(String(content || "").trim());
      if (!trimmed) return { ok: false, message: "Pesan tidak boleh kosong." };

      const res = await api.post(`/api/conversations/${conv.id}/messages`, {
        content: trimmed,
        senderRole,
      });
      return { ok: true, msg: res.data.data };
    }

    if (type === "file") {
      if (!file) return { ok: false, message: "File tidak ditemukan." };
      const validation = validateFile(file);
      if (!validation.ok) return validation;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("senderRole", senderRole);

      const res = await api.post(`/api/conversations/${conv.id}/messages/file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return { ok: true, msg: res.data.data };
    }

    return { ok: false, message: "Tipe pesan tidak valid." };
  }

  // ── Original localStorage implementation (unchanged) ──────

  // Ensure conversation exists (must await — createOrGetConversation may be async)
  const conv = await createOrGetConversation(customerId, customerName || customerId);

  const data = load();
  const convRecord = data.conversations.find((c) => c.id === conv.id);
  if (!convRecord) return { ok: false, message: "Percakapan tidak ditemukan." };

  // Validate content
  if (type === "text") {
    const trimmed = escapeHtml(String(content || "").trim());
    if (!trimmed) return { ok: false, message: "Pesan tidak boleh kosong." };

    const msg = {
      id:             crypto.randomUUID(),
      conversationId: conv.id,
      senderId,
      senderRole,
      type:           "text",
      content:        trimmed,
      fileName:       null,
      fileSize:       null,
      createdAt:      new Date().toISOString(),
      readAt:         null,
    };

    data.messages.push(msg);
    convRecord.lastAt = msg.createdAt;

    // Auto-assign admin on first admin reply
    if ((senderRole === "admin" || senderRole === "owner" || senderRole === "cs") && !convRecord.assignedAdminId) {
      convRecord.assignedAdminId = senderId;
    }

    // Chat status logic:
    // - Customer sends → mark as "unhandled" (needs admin reply)
    // - Admin/CS sends → mark as "handled"
    if (senderRole === "customer") {
      convRecord.needsReply = true;
    } else {
      convRecord.needsReply = false;
    }

    saveLocal(data);
    return { ok: true, msg };
  }

  if (type === "file") {
    if (!file) return { ok: false, message: "File tidak ditemukan." };
    const validation = validateFile(file);
    if (!validation.ok) return validation;

    // Read file as base64 DataURL so it can be viewed/downloaded in dashboards
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const msg = {
          id:             crypto.randomUUID(),
          conversationId: conv.id,
          senderId,
          senderRole,
          type:           "file",
          content:        escapeHtml(file.name),
          fileName:       escapeHtml(file.name),
          fileSize:       file.size,
          mimeType:       file.type,
          dataUrl:        evt.target.result,   // base64 — viewable/downloadable
          createdAt:      new Date().toISOString(),
          readAt:         null,
        };

        data.messages.push(msg);
        convRecord.lastAt = msg.createdAt;

        // Auto-assign admin on first admin reply
        if ((senderRole === "admin" || senderRole === "owner" || senderRole === "cs") && !convRecord.assignedAdminId) {
          convRecord.assignedAdminId = senderId;
        }

        // Chat status logic:
        // - Customer sends → mark as "unhandled" (needs admin reply)
        // - Admin/CS sends → mark as "handled"
        if (senderRole === "customer") {
          convRecord.needsReply = true;
        } else {
          convRecord.needsReply = false;
        }

        saveLocal(data);
        resolve({ ok: true, msg });
      };
      reader.onerror = () => resolve({ ok: false, message: "Gagal membaca file." });
      reader.readAsDataURL(file);
    });
  }

  return { ok: false, message: "Tipe pesan tidak valid." };
}

/**
 * Mark all messages in a conversation as read by a given role.
 *
 * - USE_BACKEND=true : PATCH /api/conversations/:id/read
 * - USE_BACKEND=false: localStorage implementation (unchanged)
 *
 * @param {string} convId
 * @param {"admin"|"owner"|"cs"} readerRole
 */
export async function markAsRead(convId, readerRole) {
  if (USE_BACKEND) {
    await api.patch(`/api/conversations/${convId}/read`);
    return;
  }

  // Original localStorage implementation (unchanged)
  const data = load();
  let changed = false;
  data.messages.forEach((m) => {
    if (m.conversationId === convId && m.senderRole === "customer" && !m.readAt) {
      m.readAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) saveLocal(data);
}

/**
 * Assign an admin to a conversation.
 * @param {string} convId
 * @param {string} adminId
 */
export function assignAdmin(convId, adminId) {
  const data = load();
  const conv = data.conversations.find((c) => c.id === convId);
  if (!conv) return { ok: false };
  conv.assignedAdminId = adminId;
  saveLocal(data);
  return { ok: true };
}

/**
 * Hide a conversation from the admin chat list without deleting any data.
 * The conversation and all its messages are preserved — it reappears as soon as
 * the admin opens it again via customer search (name or phone).
 *
 * - USE_BACKEND=true : PATCH /api/conversations/:id/hide
 * - USE_BACKEND=false: sets hidden_by_admin=true on the localStorage record
 *
 * @param {string} conversationId
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function hideConversation(conversationId) {
  if (USE_BACKEND) {
    try {
      await api.patch(`/api/conversations/${conversationId}/hide`);
      return { ok: true };
    } catch (err) {
      const message = err.response?.data?.message ?? 'Gagal menutup percakapan.';
      return { ok: false, message };
    }
  }

  // localStorage mode: mark as hidden (keeps data, just excluded from list)
  const data = load();
  const conv = data.conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.hidden_by_admin = true;
    saveLocal(data);
  }
  return { ok: true };
}

/**
 * Delete a conversation and all its messages permanently.
 *
 * - USE_BACKEND=true : DELETE /api/conversations/:id
 *   Returns { ok: true } on 200 or 404 (idempotent).
 *   Returns { ok: false, message } on other errors.
 * - USE_BACKEND=false: removes the conversation and all its messages from
 *   localStorage (gala.chats), then calls saveLocal.
 *
 * @param {string} conversationId
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function deleteConversation(conversationId) {
  if (USE_BACKEND) {
    try {
      await api.delete(`/api/conversations/${conversationId}`);
      return { ok: true };
    } catch (err) {
      if (err.response?.status === 404) {
        // Already deleted — treat as success
        return { ok: true };
      }
      const message = err.response?.data?.message ?? 'Gagal menghapus percakapan.';
      return { ok: false, message };
    }
  }

  // localStorage mode: filter out the conversation and all its messages
  const data = load();
  data.conversations = data.conversations.filter((c) => c.id !== conversationId);
  data.messages      = data.messages.filter((m) => m.conversationId !== conversationId);
  saveLocal(data);
  return { ok: true };
}

/* ══════════════════════════════════════════════════════════
   CUSTOMER UNREAD COUNT
   ══════════════════════════════════════════════════════════ */

/**
 * Get the number of unread messages from admin/staff for the logged-in customer.
 * Falls back to 0 on error so the badge degrades gracefully.
 *
 * - USE_BACKEND=true : GET /api/conversations/unread-count
 * - USE_BACKEND=false: computed from localStorage messages
 *
 * @param {string} customerId
 * @returns {Promise<number>}
 */
export async function getCustomerUnreadCount(customerId) {
  if (USE_BACKEND) {
    try {
      const res = await api.get('/api/conversations/unread-count');
      return Number(res.data.count ?? 0);
    } catch {
      return 0;
    }
  }

  // localStorage mode: count admin messages with no readAt in the customer's conversation
  const data = load();
  const conv = data.conversations.find((c) => c.customerId === customerId);
  if (!conv) return 0;
  return data.messages.filter(
    (m) => m.conversationId === conv.id && m.senderRole !== 'customer' && !m.readAt
  ).length;
}

/**
 * Mark all admin/staff messages in the customer's conversation as read.
 * Called when the customer opens the chat widget.
 *
 * - USE_BACKEND=true : POST /api/conversations/mark-read
 * - USE_BACKEND=false: sets readAt on all admin messages in localStorage
 *
 * @param {string} customerId
 */
export async function markAdminMessagesReadForCustomer(customerId) {
  if (USE_BACKEND) {
    try {
      await api.post('/api/conversations/mark-read');
    } catch { /* silent */ }
    return;
  }

  // localStorage mode
  const data = load();
  const conv = data.conversations.find((c) => c.customerId === customerId);
  if (!conv) return;
  let changed = false;
  data.messages.forEach((m) => {
    if (m.conversationId === conv.id && m.senderRole !== 'customer' && !m.readAt) {
      m.readAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) saveLocal(data);
}

/* ══════════════════════════════════════════════════════════
   LEGACY COMPAT (used by admin activity sidebar)
   ══════════════════════════════════════════════════════════ */

/** @deprecated Use getAllConversations() */
export async function listConversations() {
  return getAllConversations();
}

/** @deprecated Use getConversationById() */
export function getConversation(convId) {
  return getConversationById(convId);
}

/* ══════════════════════════════════════════════════════════
   DEMO SEED
   ══════════════════════════════════════════════════════════ */

export function seedDemoChats() {
  const data = load();
  if (data.conversations.length) return;

  const now = Date.now();
  const conv1Id = "conv-demo-1";
  const conv2Id = "conv-demo-2";

  data.conversations = [
    { id: conv1Id, customerId: "demo-c1", customerName: "Budi Santoso", assignedAdminId: null, status: "open", createdAt: new Date(now - 3600000).toISOString(), lastAt: new Date(now - 3500000).toISOString() },
    { id: conv2Id, customerId: "demo-c2", customerName: "Sari Dewi",    assignedAdminId: null, status: "open", createdAt: new Date(now - 7200000).toISOString(), lastAt: new Date(now - 7200000).toISOString() },
  ];

  data.messages = [
    { id: "m1", conversationId: conv1Id, senderId: "demo-c1", senderRole: "customer", type: "text", content: "Halo, saya mau tanya soal stiker vinyl.", fileName: null, fileSize: null, createdAt: new Date(now - 3600000).toISOString(), readAt: null },
    { id: "m2", conversationId: conv1Id, senderId: "admin",   senderRole: "admin",    type: "text", content: "Halo Budi! Silakan, ada yang bisa kami bantu?", fileName: null, fileSize: null, createdAt: new Date(now - 3500000).toISOString(), readAt: null },
    { id: "m3", conversationId: conv2Id, senderId: "demo-c2", senderRole: "customer", type: "text", content: "Berapa lama proses cetak brosur A5?", fileName: null, fileSize: null, createdAt: new Date(now - 7200000).toISOString(), readAt: null },
  ];

  saveLocal(data);
}
