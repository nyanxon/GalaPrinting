import { useContext } from 'react';
import { Navigate } from 'react-router';
import { AuthContext } from '../context/AuthContext.jsx';
import { STAFF_ROLES } from '../../config/roles.js';

/**
 * RoleGuard — protects a route by requiring a specific user role.
 *
 * If the user is null (unauthenticated) or their role does not match
 * `requiredRole`, the user is redirected to the appropriate login page:
 *   - Staff roles → /admin/login
 *   - Customer / unknown → /register
 *
 * @param {{ requiredRole: string, children: import('react').ReactNode }} props
 */
export default function RoleGuard({ requiredRole, children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

  if (user === null || user.role !== requiredRole) {
    const loginPath = STAFF_ROLES.includes(requiredRole) ? '/admin/login' : '/register';
    return <Navigate to={loginPath} replace />;
  }

  return children;
}
