/**
 * socket/index.js — Socket.io server setup with JWT auth middleware.
 *
 * Requirements: 9.5, 9.6, 9.10, 14.5
 */

import { Server } from 'socket.io';
import { config } from '../config/env.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { query } from '../db/connection.js';

let io = null;

const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

/**
 * Join all DM conversation rooms for a given staff user.
 * Queries conversations where dm_participant_a or dm_participant_b matches userId.
 * @param {import('socket.io').Socket} socket
 * @param {string} userId
 */
async function joinDMRooms(socket, userId) {
  try {
    const [rows] = await query(
      "SELECT id FROM conversations WHERE conversation_type = 'staff_dm' AND (dm_participant_a = ? OR dm_participant_b = ?)",
      [userId, userId]
    );
    rows.forEach((r) => socket.join(`conversation:${r.id}`));
  } catch { /* non-fatal */ }
}

/**
 * Initialise Socket.io and attach it to the HTTP server.
 * @param {import('http').Server} httpServer
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.clientOrigin,
      credentials: true,
    },
  });

  // ── Auth middleware ──────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('authentication_error'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.user = {
        id:    payload.sub,
        role:  payload.role,
        name:  payload.name,
        email: payload.email,
      };
      next();
    } catch {
      next(new Error('authentication_error'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const { id: userId, role } = socket.user;

    if (role === 'customer') {
      // Join personal room
      socket.join(`customer:${userId}`);

      // Join conversation room if one exists
      try {
        const [rows] = await query(
          'SELECT id FROM conversations WHERE customer_id = ?',
          [userId]
        );
        if (rows.length > 0) {
          socket.join(`conversation:${rows[0].id}`);
        }
      } catch { /* non-fatal */ }

      // Allow customer to join their conversation room on demand
      socket.on('join:conversation', ({ conversationId }) => {
        if (conversationId) {
          socket.join(`conversation:${conversationId}`);
        }
      });
    } else if (STAFF_ROLES.includes(role)) {
      socket.join('staff');

      // Join personal staff room for targeted DM notifications (Req 6.5)
      socket.join(`staff:${userId}`);

      // All staff join all existing customer_chat conversation rooms (Req 1.7)
      try {
        const [rows] = await query(
          "SELECT id FROM conversations WHERE conversation_type = 'customer_chat'"
        );
        rows.forEach((r) => socket.join(`conversation:${r.id}`));
      } catch { /* non-fatal */ }

      // Join all DM conversation rooms where this staff member is a participant (Req 2.8, 6.6)
      await joinDMRooms(socket, userId);
    }
  });

  return io;
}

/**
 * Get the Socket.io server instance.
 * @returns {import('socket.io').Server}
 */
export function getIO() {
  if (!io) throw new Error('Socket.io not initialised');
  return io;
}
