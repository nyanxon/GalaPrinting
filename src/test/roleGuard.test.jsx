// Feature: vanilla-to-react-migration, Property 1: Role guard blocks non-permitted users
// Feature: vanilla-to-react-migration, Property 2: Role guard permits correct-role users
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AuthContext } from '../components/context/AuthContext.jsx';
import RoleGuard from '../components/guards/RoleGuard.jsx';

// Mock authService so AuthProvider doesn't call real localStorage
vi.mock('../services/auth.js', () => ({
  getCurrentUser: vi.fn(() => null),
}));

/** All staff roles defined in the application */
const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

/**
 * Helper: render a RoleGuard for a given requiredRole and user inside a
 * MemoryRouter. Unauthorized renders show the NotFoundPage in place, so no
 * extra routes are needed (NotFoundPage only requires a Router + a "/" link).
 */
function renderRoleGuard(requiredRole, user) {
  return render(
    <AuthContext.Provider value={{ user, updateUser: () => {} }}>
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route
            path="/staff"
            element={
              <RoleGuard requiredRole={requiredRole}>
                <div>Protected Content</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('RoleGuard', () => {
  /**
   * Property 1: Role guard blocks non-permitted users
   * Validates: Requirements 3.2, 3.3
   *
   * For any staff role and any user that is either null or has a different role,
   * RoleGuard SHALL render the NotFoundPage (route appears as a 404) — the
   * protected page must NOT be revealed.
   */
  it('Property 1: Role guard shows 404 for non-permitted users', () => {
    fc.assert(
      fc.property(
        // Pick a required role for the route
        fc.constantFrom(...STAFF_ROLES),
        // Generate either null (unauthenticated) or a user with a wrong role
        fc.oneof(
          fc.constant(null),
          fc.record({
            id: fc.string({ minLength: 1 }),
            name: fc.string({ minLength: 1 }),
            // Pick a role that is different from the required role
            role: fc.constantFrom(...STAFF_ROLES),
          }).filter(() => {
            // We'll compare against requiredRole inside the property body;
            // here we just generate any role — the filter is applied below.
            return true;
          })
        ),
        (requiredRole, user) => {
          // If user has the exact required role, skip this iteration
          // (that case belongs to Property 2)
          if (user !== null && user.role === requiredRole) return;

          const { unmount } = renderRoleGuard(requiredRole, user);

          // NotFoundPage heading must be shown…
          expect(screen.getByText('Halaman Tidak Ditemukan')).toBeTruthy();
          // …and the protected content must NOT be revealed
          expect(screen.queryByText('Protected Content')).toBeNull();

          unmount();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2: Role guard permits correct-role users
   * Validates: Requirements 3.4
   *
   * For any staff role and an authenticated user whose role exactly matches
   * the required role, RoleGuard SHALL render the child component.
   */
  it('Property 2: Role guard permits correct-role users', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STAFF_ROLES),
        (role) => {
          const user = { id: 'u1', name: 'Test User', role };

          const { unmount } = renderRoleGuard(role, user);

          expect(screen.getByText('Protected Content')).toBeTruthy();
          expect(screen.queryByText('Halaman Tidak Ditemukan')).toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
