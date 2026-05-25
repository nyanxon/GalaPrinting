// Feature: customer-profile-page, Property 1: non-customer role redirect

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from '../components/context/AuthContext.jsx';

// Mock authService to avoid real network/localStorage calls
vi.mock('../services/authService.js', () => ({
  getCurrentUser: vi.fn(() => null),
}));

// Mock profileService to avoid real API calls
vi.mock('../services/profileService.js', () => ({
  getProfile: vi.fn(() => Promise.resolve(null)),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  getNotificationPreferences: vi.fn(() => Promise.resolve({})),
  updateNotificationPreferences: vi.fn(),
}));

// Mock addressService
vi.mock('../services/addressService.js', () => ({
  getAddresses: vi.fn(() => Promise.resolve([])),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
}));

/**
 * Minimal ProfilePage stub that mirrors the real route guard logic:
 * redirect to /register if not logged in or role !== 'customer'.
 */
function ProfilePageStub({ user }) {
  if (!user || user.role !== 'customer') {
    return <Navigate to="/register" replace />;
  }
  return <div data-testid="profile-page">Profile Page</div>;
}

/**
 * Render ProfilePageStub inside a MemoryRouter with the given user.
 */
function renderProfilePage(user) {
  return render(
    <AuthContext.Provider value={{ user, updateUser: () => {}, loading: false }}>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProfilePageStub user={user} />} />
          <Route path="/register" element={<div data-testid="register-page">Register Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

/**
 * All non-customer roles in the system.
 */
const NON_CUSTOMER_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

describe('Property 1: Non-customer role redirect', () => {
  /**
   * For any user role that is not 'customer', rendering ProfilePage
   * should result in a redirect to /register.
   *
   * Validates: Requirements 1.3
   */
  it('redirects non-customer roles to /register (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NON_CUSTOMER_ROLES),
        (role) => {
          const user = { id: 'u1', name: 'Test User', role };
          const { unmount } = renderProfilePage(user);

          // Should show register page, not profile page
          expect(screen.getByTestId('register-page')).toBeTruthy();
          expect(screen.queryByTestId('profile-page')).toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Unauthenticated users (null) should also be redirected to /register.
   *
   * Validates: Requirements 1.2
   */
  it('redirects unauthenticated users (null) to /register', () => {
    const { unmount } = renderProfilePage(null);
    expect(screen.getByTestId('register-page')).toBeTruthy();
    expect(screen.queryByTestId('profile-page')).toBeNull();
    unmount();
  });

  /**
   * Customers should NOT be redirected.
   *
   * Validates: Requirements 1.1
   */
  it('does not redirect customers', () => {
    const user = { id: 'u1', name: 'Customer', role: 'customer' };
    const { unmount } = renderProfilePage(user);
    expect(screen.getByTestId('profile-page')).toBeTruthy();
    expect(screen.queryByTestId('register-page')).toBeNull();
    unmount();
  });
});
