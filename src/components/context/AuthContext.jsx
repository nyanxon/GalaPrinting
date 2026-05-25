import { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/authService.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(getCurrentUser())
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  function updateUser(newUser) {
    setUser(newUser);
  }

  return (
    <AuthContext.Provider value={{ user, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Inner component that listens for the `gala:session-expired` DOM event
 * and navigates to /register using React Router.
 * Must be rendered inside a BrowserRouter tree.
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
