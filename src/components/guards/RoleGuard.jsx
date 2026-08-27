import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

/**
 * RoleGuard — protects a route by requiring a specific user role.
 *
 * If the user is null (unauthenticated) or their role does not match
 * `requiredRole`, the route renders the 404 page *in place* — the route
 * effectively does not exist for that user (the URL stays, content is 404).
 * This hides every /admin/* section from unauthorized visitors.
 *
 * NOTE: /admin/login is deliberately NOT guarded, so it always stays reachable.
 *
 * @param {{ requiredRole: string, children: import('react').ReactNode }} props
 */
export default function RoleGuard({ requiredRole, children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null;

  if (user === null || user.role !== requiredRole) {
    return <NotFoundPage />;
  }

  return children;
}