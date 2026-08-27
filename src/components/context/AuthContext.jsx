/**
 * AuthContext.jsx — Auth state provider.
 *
 * Perbaikan race condition refresh:
 * - `loading: true` selama proses re-hydrate (getCurrentUser) berlangsung.
 * - Protected route TIDAK boleh redirect ke login sebelum loading = false.
 * - `gala:session-expired` event → navigasi ke /register (customer) atau
 *   /admin/login (staff), tergantung role terakhir.
 */

import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router';
import { getCurrentUser } from '../../services/auth.js';
import { STAFF_ROLES } from '../../config/roles.js';

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
 * dan meredirect ke login page via React Router.
 * Staff → /admin/login, Customer → /register
 */
function AuthNavigationHandler() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    function handleSessionExpired() {
      const loginPath = (user && STAFF_ROLES.includes(user.role))
        ? '/admin/login'
        : '/register';
      navigate(loginPath, { replace: true });
    }
    function handleMustChangePassword() {
      navigate('/change-password', { replace: true });
    }
    window.addEventListener('gala:session-expired', handleSessionExpired);
    window.addEventListener('gala:must-change-password', handleMustChangePassword);
    return () => {
      window.removeEventListener('gala:session-expired', handleSessionExpired);
      window.removeEventListener('gala:must-change-password', handleMustChangePassword);
    };
  }, [navigate, user]);

  return null;
}

export { AuthNavigationHandler };
