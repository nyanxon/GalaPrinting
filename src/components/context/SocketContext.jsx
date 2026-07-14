/**
 * SocketContext.jsx — Centralized Socket.io lifecycle management.
 *
 * Mengelola koneksi socket berdasarkan auth state:
 * - Inisialisasi socket saat user login
 * - Disconnect saat logout atau session expired
 * - Reconnect otomatis setelah token refresh
 *
 * Requirements: 1.1–1.8, 2.1–2.3, 4.1–4.3
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext.jsx';
import { initSocket, disconnectSocket, getSocket } from '../../core/socket.js';
import { getAccessToken } from '../../core/httpClient.js';
import { setupChatListeners } from '../../services/chatService.js';

const SocketContext = createContext(undefined);

export function SocketProvider({ children }) {
  const { user, loading } = useContext(AuthContext);

  // Hydrate dari singleton jika socket sudah ada sebelum SocketProvider mount
  const [socket, setSocket] = useState(() => getSocket());

  // Efek 1: Reaksi terhadap perubahan auth state
  useEffect(() => {
    if (loading) return; // Tunggu AuthContext selesai hydrate

    if (user) {
      const token = getAccessToken();
      if (token) {
        const newSocket = initSocket(token);
        setupChatListeners(newSocket);
        setSocket(newSocket);
      }
      // Jika token belum ada, tunggu event gala:token-refreshed
    } else {
      disconnectSocket();
      setSocket(null);
    }
  }, [user, loading]);

  // Efek 2: Reconnect setelah token refresh, disconnect saat session expired
  useEffect(() => {
    function handleTokenRefreshed(e) {
      const newToken = e.detail?.token;
      if (!newToken) return;
      const newSocket = initSocket(newToken);
      setupChatListeners(newSocket);
      setSocket(newSocket);
    }

    function handleSessionExpired() {
      disconnectSocket();
      setSocket(null);
    }

    window.addEventListener('gala:token-refreshed', handleTokenRefreshed);
    window.addEventListener('gala:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('gala:token-refreshed', handleTokenRefreshed);
      window.removeEventListener('gala:session-expired', handleSessionExpired);
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Hook untuk mengakses socket instance dari SocketContext.
 * @returns {import('socket.io-client').Socket | null}
 */
export function useSocket() {
  const ctx = useContext(SocketContext);
  if (ctx === undefined) {
    throw new Error('useSocket() harus digunakan di dalam <SocketProvider>');
  }
  return ctx; // null jika belum terkoneksi, Socket instance jika sudah
}
