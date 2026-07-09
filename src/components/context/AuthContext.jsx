/**
 * AuthContext.jsx — Auth state provider.
 *
 * Perbaikan race condition refresh:
 * - `loading: true` selama proses re-hydrate (getCurrentUser) berlangsung.
 * - Protected route TIDAK boleh redirect ke login sebelum loading = false.
 * - `gala:session-expired` event → navigasi ke /register.
 */

import { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/authService.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  // loading=true sampai proses silent-refresh selesai.
  // Seluruh app menunggu ini sebelum memutuskan apakah user sudah login.
  const [loading, setLoading] = useState(true);

  const hydrateUser = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      setUser(current ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Jalankan satu kali saat app pertama mount.
  // getCurrentUser() sudah menangani silent refresh via httpOnly cookie —
  // tidak perlu race condition workaround tambahan.
  useEffect(() => {
    hydrateUser();
  }, [hydrateUser]);

  function updateUser(newUser) {
    setUser(newUser ?? null);
  }

  return (
    <AuthContext.Provider value={{ user, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Inner component yang mendengarkan `gala:session-expired` DOM event
 * dan meredirect ke /register via React Router.
 * Harus dirender di dalam BrowserRouter tree.
 */
function AuthNavigationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    function handleSessionExpired() {
      navigate('/register', { replace: true });
    }
    window.addEventListener('gala:session-expired', handleSessionExpired);
    return () => window.removeEventListener('gala:session-expired', handleSessionExpired);
  }, [navigate]);

  return null;
}

export { AuthNavigationHandler };
