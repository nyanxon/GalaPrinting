/**
 * core/socket.js — Socket.io client singleton untuk admin/staff.
 *
 * Socket hanya diinisialisasi satu kali per session. Token di-attach
 * via socket.io auth handshake (sama seperti yang diharapkan backend
 * di server/src/socket/index.js).
 *
 * Usage:
 *   import { getSocket, initSocket, disconnectSocket } from '../core/socket.js';
 *
 *   // Saat login berhasil:
 *   initSocket(accessToken);
 *
 *   // Saat logout:
 *   disconnectSocket();
 *
 *   // Di komponen:
 *   const socket = getSocket(); // bisa null sebelum init
 */

import { io } from 'socket.io-client';
import { API_BASE } from './httpClient.js';

/** @type {import('socket.io-client').Socket | null} */
let _socket = null;

/**
 * Inisialisasi socket dengan access token.
 * Jika sudah ada socket yang aktif, disconnect dulu lalu buat baru.
 * @param {string} accessToken  JWT access token
 * @returns {import('socket.io-client').Socket}
 */
export function initSocket(accessToken) {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }

  _socket = io(API_BASE || window.location.origin, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  _socket.on('connect', () => {
    console.log('[socket] Connected:', _socket.id);
  });

  _socket.on('connect_error', (err) => {
    console.warn('[socket] Connection error:', err.message);
  });

  _socket.on('disconnect', (reason) => {
    console.log('[socket] Disconnected:', reason);
  });

  return _socket;
}

/**
 * Ambil socket instance yang aktif.
 * @returns {import('socket.io-client').Socket | null}
 */
export function getSocket() {
  return _socket;
}

/**
 * Disconnect dan hapus socket instance.
 * Panggil saat logout.
 */
export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
