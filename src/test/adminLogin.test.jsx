// Feature: admin login page (/admin/login) — renders for guests, redirects
// declaratively when already logged in as staff. Guards against the render-time
// navigate() bug that produced a blank white page. A customer session is
// auto-logged-out so the page is shown logged-out and ready to log in as staff.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AuthContext } from '../components/context/AuthContext.jsx';
import AdminLoginPage from '../components/pages/staff/AdminLoginPage.jsx';

vi.mock('../services/auth.js', () => ({
  adminLogin: vi.fn(),
  getCurrentUser: vi.fn(() => null),
  logout: vi.fn(() => Promise.resolve()),
}));

function renderLogin(user, updateUser = vi.fn()) {
  return render(
    <AuthContext.Provider value={{ user, updateUser, loading: false }}>
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/cashier" element={<div data-testid="page-cashier">Cashier</div>} />
          <Route path="/admin/owner" element={<div data-testid="page-owner">Owner</div>} />
          <Route path="/register" element={<div data-testid="page-register">Register</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('AdminLoginPage — /admin/login', () => {
  it('renders the login form for unauthenticated guests', () => {
    const { unmount } = renderLogin(null);

    expect(screen.getByText('Login Staff')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'LOGIN' })).toBeTruthy();

    unmount();
  });

  it('lets a logged-in customer access /admin/login and auto-logs them out', async () => {
    const updateUser = vi.fn();
    const { unmount } = renderLogin({ id: 'c1', name: 'Customer', role: 'customer' }, updateUser);

    // Customer is NOT redirected away — the login form is accessible.
    await waitFor(() => {
      expect(screen.getByText('Login Staff')).toBeTruthy();
    });

    // Their customer session is cleared so the page is ready for staff login.
    const { logout } = await import('../services/auth.js');
    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
    expect(updateUser).toHaveBeenCalledWith(null);

    unmount();
  });

  it('redirects an already-logged-in staff user to their dashboard', async () => {
    const { unmount } = renderLogin({ id: 's1', name: 'Staff', role: 'cashier' });

    await waitFor(() => {
      expect(screen.getByTestId('page-cashier')).toBeTruthy();
    });
    expect(screen.queryByText('Login Staff')).toBeNull();

    unmount();
  });

  it('redirects an already-logged-in owner to the owner dashboard', async () => {
    const { unmount } = renderLogin({ id: 'o1', name: 'Owner', role: 'owner' });

    await waitFor(() => {
      expect(screen.getByTestId('page-owner')).toBeTruthy();
    });
    expect(screen.queryByText('Login Staff')).toBeNull();

    unmount();
  });
});