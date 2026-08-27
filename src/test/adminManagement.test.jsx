// Feature: dynamic-permissions — Owner "Kelola Admin & Permission" pages.
// Validates: owner-only route guard, account list + search, promote → permission
// editor navigation, revoke confirmation, and permission checklist save.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AuthContext } from '../components/context/AuthContext.jsx';
import RoleGuard from '../components/guards/RoleGuard.jsx';
import AdminManagementPage from '../components/pages/owner/AdminManagementPage.jsx';

vi.mock('../services/adminManagement.js', () => ({
  listAdminAccounts: vi.fn(),
  promoteAccount: vi.fn(),
  revokeAccount: vi.fn(),
  listFeatures: vi.fn(),
  getAccountPermissions: vi.fn(),
  updateAccountPermissions: vi.fn(),
}));

vi.mock('../services/auth.js', () => ({
  getCurrentUser: vi.fn(() => null),
  logout: vi.fn(() => Promise.resolve()),
}));

import {
  listAdminAccounts,
  promoteAccount,
  revokeAccount,
  listFeatures,
  getAccountPermissions,
  updateAccountPermissions,
} from '../services/adminManagement.js';

const OWNER = { id: 'owner1', name: 'Pak Owner', email: 'owner@example.com', role: 'owner' };
const CASHIER = { id: 'c1', name: 'Kasir', email: 'kasir@example.com', role: 'cashier' };

const FEATURES = [
  {
    category: 'Dashboard',
    features: [
      { key: 'dashboard.view', label: 'Lihat Dashboard', description: null },
    ],
  },
  {
    category: 'Orders',
    features: [
      { key: 'orders.view', label: 'Lihat Pesanan', description: null },
      { key: 'orders.create', label: 'Buat Pesanan', description: 'Membuat pesanan baru.' },
    ],
  },
];

const ACCOUNT_PERMS = {
  user: { id: 'u1', name: 'Budi', email: 'budi@example.com', role: 'cashier', is_promoted_admin: 1 },
  permissions: [
    { feature_key: 'dashboard.view', label: 'Lihat Dashboard', category: 'Dashboard', granted: true },
    { feature_key: 'orders.view', label: 'Lihat Pesanan', category: 'Orders', granted: false },
    { feature_key: 'orders.create', label: 'Buat Pesanan', category: 'Orders', granted: false },
  ],
};

function renderRoute(user, initialPath) {
  return render(
    <AuthContext.Provider value={{ user, updateUser: () => {}, loading: false }}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/admin/owner/admin-management"
            element={
              <RoleGuard requiredRole="owner">
                <AdminManagementPage />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/owner/admin-management/:userId"
            element={
              <RoleGuard requiredRole="owner">
                <AdminManagementPage />
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Access guard — owner only', () => {
  it('shows 404 (NotFoundPage) to non-owner users on /admin/owner/admin-management', async () => {
    renderRoute(CASHIER, '/admin/owner/admin-management');

    expect(screen.getByText('Halaman Tidak Ditemukan')).toBeTruthy();
    expect(screen.queryByText('Kelola Admin')).toBeNull();
    expect(listAdminAccounts).not.toHaveBeenCalled();
  });

  it('renders the management page for an owner', async () => {
    listAdminAccounts.mockResolvedValueOnce([
      { id: 'u1', name: 'Budi', email: 'budi@example.com', role: 'cashier', is_promoted_admin: 0 },
    ]);

    renderRoute(OWNER, '/admin/owner/admin-management');

    await waitFor(() => {
      expect(screen.getByText('Budi')).toBeTruthy();
    });
    expect(
      screen.getByText((content, el) => el.tagName === 'H2' && content.includes('Kelola Admin'))
    ).toBeTruthy();
    expect(screen.getByLabelText(/Jadikan admin Budi/)).toBeTruthy();
  });
});

describe('Account list — search & promote', () => {
  beforeEach(() => {
    listAdminAccounts.mockReset();
  });

  it('reloads with ?q= when the search form is submitted', async () => {
    listAdminAccounts.mockResolvedValueOnce([
      { id: 'u1', name: 'Budi', email: 'budi@example.com', role: 'cashier', is_promoted_admin: 0 },
    ]);

    renderRoute(OWNER, '/admin/owner/admin-management');

    await waitFor(() => expect(screen.getByText('Budi')).toBeTruthy());

    listAdminAccounts.mockResolvedValueOnce([
      { id: 'u2', name: 'Siti', email: 'siti@example.com', role: 'qc', is_promoted_admin: 0 },
    ]);
    const searchBox = screen.getByLabelText('Cari akun yang bisa dipromosikan');
    fireEvent.change(searchBox, { target: { value: 'siti' } });
    fireEvent.submit(searchBox.closest('form'));

    await waitFor(() => {
      expect(listAdminAccounts).toHaveBeenLastCalledWith({ q: 'siti' });
    });
  });

  it('promotes an account then navigates to its permission page', async () => {
    listAdminAccounts.mockResolvedValue([
      { id: 'u1', name: 'Budi', email: 'budi@example.com', role: 'cashier', is_promoted_admin: 0 },
    ]);
    promoteAccount.mockResolvedValueOnce({ id: 'u1', is_promoted_admin: 1 });
    listFeatures.mockResolvedValueOnce(FEATURES);
    getAccountPermissions.mockResolvedValueOnce(ACCOUNT_PERMS);

    renderRoute(OWNER, '/admin/owner/admin-management');

    await waitFor(() => expect(screen.getByLabelText(/Jadikan admin Budi/)).toBeTruthy());

    fireEvent.click(screen.getByLabelText(/Jadikan admin Budi/));

    await waitFor(() => {
      expect(promoteAccount).toHaveBeenCalledWith('u1');
      expect(screen.getByText(/Atur Permission/)).toBeTruthy();
    });
    // Wait until the permission data has loaded, then check the grants.
    await waitFor(() => {
      expect(screen.getByLabelText('Lihat Dashboard').checked).toBe(true);
    });
    expect(screen.getByText('Budi')).toBeTruthy();
    expect(screen.getByLabelText('Lihat Pesanan').checked).toBe(false);
  });

  it('revokes an account only after confirmation', async () => {
    listAdminAccounts.mockResolvedValue([
      { id: 'u2', name: 'Siti', email: 'siti@example.com', role: 'qc', is_promoted_admin: 1 },
    ]);
    revokeAccount.mockResolvedValueOnce({ id: 'u2', is_promoted_admin: 0 });

    renderRoute(OWNER, '/admin/owner/admin-management');

    await waitFor(() => expect(screen.getByLabelText(/Cabut admin Siti/)).toBeTruthy());

    fireEvent.click(screen.getByLabelText(/Cabut admin Siti/));
    expect(screen.getByText(/Cabut status Admin Dinamis dari Siti/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cabut' }));

    await waitFor(() => {
      expect(revokeAccount).toHaveBeenCalledWith('u2');
    });
  });
});

describe('Permission checklist — save', () => {
  beforeEach(() => {
    listFeatures.mockReset();
    getAccountPermissions.mockReset();
    updateAccountPermissions.mockReset();
  });

  it('sends the full granted set on save', async () => {
    listFeatures.mockResolvedValueOnce(FEATURES);
    getAccountPermissions.mockResolvedValueOnce(ACCOUNT_PERMS);
    updateAccountPermissions.mockResolvedValueOnce({ ok: true });

    renderRoute(OWNER, '/admin/owner/admin-management/u1');

    await waitFor(() => {
      expect(screen.getByLabelText('Lihat Dashboard')).toBeTruthy();
    });

    // Toggle "Buat Pesanan" on, then save.
    fireEvent.click(screen.getByLabelText('Buat Pesanan'));

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Permission' }));

    await waitFor(() => {
      expect(updateAccountPermissions).toHaveBeenCalledWith('u1', [
        { feature_key: 'dashboard.view', granted: true },
        { feature_key: 'orders.view', granted: false },
        { feature_key: 'orders.create', granted: true },
      ]);
    });
  });

  it('collapses/expands a category accordion', async () => {
    listFeatures.mockResolvedValueOnce(FEATURES);
    getAccountPermissions.mockResolvedValueOnce(ACCOUNT_PERMS);

    renderRoute(OWNER, '/admin/owner/admin-management/u1');

    await waitFor(() => {
      expect(screen.getByLabelText('Lihat Dashboard')).toBeTruthy();
    });

    const toggle = screen.getByRole('button', { name: /^Dashboard/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByLabelText('Lihat Dashboard')).toBeNull();
  });
});
