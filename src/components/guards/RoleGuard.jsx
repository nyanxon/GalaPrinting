import { useContext } from 'react';
import { Navigate } from 'react-router';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * RoleGuard — protects a route by requiring a specific user role.
 *
 * If the user is null (unauthenticated) or their role does not match
 * `requiredRole`, the user is redirected to /register.
 * Otherwise, the children are rendered as-is.
 *
 * @param {{ requiredRole: string, children: import('react').ReactNode }} props
 */
export default function RoleGuard({ requiredRole, children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

  if (user === null || user.role !== requiredRole) {
    return <Navigate to="/register" replace />;
  }

  return children;
}
