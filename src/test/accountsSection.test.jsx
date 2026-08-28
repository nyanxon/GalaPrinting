// Feature: Owner "ACCOUNT" menu — customers and admin/staff are listed in
// separate tabs (they live in separate tables, users_customer / users_admin,
// and one email may exist in both). Admin accounts are created manually by
// the Owner; customer accounts can also be created from here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from '../components/context/AuthContext.jsx';
import { STAFF_ROLES } from '../config/roles.js';
import AccountsSection from '../components/pages/owner/sections/AccountsSection.jsx';

const listAccountsMock = vi.fn();
const createStaffMock  = vi.fn();
const createCustomerMock = vi.fn();

vi.mock('../services/accounts.js', () => ({
  listAccounts:        (...args) => listAccountsMock(...args),
  getAccount:          vi.fn(),
  updateAccount:       vi.fn(),
  createCustomerAccount: (...args) => createCustomerMock(...args),
}));

vi.mock('../services/adminManagement.js', () => ({
  createStaffAccount: (...args) => createStaffMock(...args),
}));

function makeAccount(overrides = {}) {
  return {
    id: overrides.id || 'u1',
    name: overrides.name || 'Pengguna',
    email: overrides.email || 'user@example.com',
    role: overrides.role || 'customer',
    phone: overrides.phone ?? '0812345678',
    deleted_at: overrides.deleted_at ?? null,
  };
}

const customersItems = [
  makeAccount({ id: 'c1', name: 'Andi Customer', email: 'andi@example.com', role: 'customer', phone: '08111111' }),
  makeAccount({ id: 'c2', name: 'Budi Customer', email: 'budi@example.com', role: 'customer' }),
];

const adminItems = [
  makeAccount({ id: 's1', name: 'Siti Staff', email: 'siti@example.com', role: 'cashier', phone: null }),
  makeAccount({ id: 's2', name: 'Agus Admin', email: 'agus@example.com', role: 'admin', phone: null }),
];

function renderSection(userRole = 'owner') {
  listAccountsMock.mockImplementation(({ role } = {}) => {
    const items = role === 'customer' ? customersItems : adminItems;
    return Promise.resolve({ items, total: items.length, page: 1, limit: 10, totalPages: 1 });
  });
  createStaffMock.mockResolvedValue({ ok: true, user: makeAccount({ id: 'new1', name: 'Staff Baru', role: 'cashier' }) });
  createCustomerMock.mockResolvedValue({ ok: true, user: makeAccount({ id: 'newc', name: 'Cust Baru', role: 'customer' }) });

  return render(
    <AuthContext.Provider value={{ user: { id: 'o1', role: userRole, name: 'Owner' }, updateUser: vi.fn(), loading: false }}>
      <AccountsSection />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  listAccountsMock.mockReset();
  createStaffMock.mockReset();
  createCustomerMock.mockReset();
});

describe('AccountsSection — split customer/admin lists', () => {
  it('shows the Customers tab by default and lists only customer accounts', async () => {
    renderSection();

    const tabList = screen.getByRole('tablist', { name: /Pilih jenis akun/i });
    expect(within(tabList).getByRole('tab', { name: 'Akun Customer' })).toHaveAttribute('aria-selected', 'true');

    await waitFor(() => {
      expect(screen.getByText('Andi Customer')).toBeTruthy();
      expect(screen.getByText('Budi Customer')).toBeTruthy();
    });
    expect(screen.queryByText('Siti Staff')).toBeNull();

    expect(listAccountsMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'customer' })
    );
  });

  it('switching to the Admin tab lists only admin/staff accounts', async () => {
    renderSection();

    await screen.findByText('Andi Customer');
    await userEvent.click(screen.getByRole('tab', { name: 'Akun Admin' }));

    await waitFor(() => {
      expect(screen.getByText('Siti Staff')).toBeTruthy();
      expect(screen.getByText('Agus Admin')).toBeTruthy();
    });
    expect(screen.queryByText('Andi Customer')).toBeNull();

    expect(listAccountsMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: STAFF_ROLES.join(',') })
    );
  });

  it('shows create buttons for the Owner role', async () => {
    renderSection('owner');

    await screen.findByText('Andi Customer');
    expect(screen.getByRole('button', { name: 'Buat akun customer baru' })).toBeTruthy();

    await userEvent.click(screen.getByRole('tab', { name: 'Akun Admin' }));
    await screen.findByText('Siti Staff');
    expect(screen.getByRole('button', { name: 'Buat akun staff baru' })).toBeTruthy();
  });

  it('hides create buttons for non-owner roles', async () => {
    renderSection('admin');

    await screen.findByText('Andi Customer');
    expect(screen.queryByRole('button', { name: 'Buat akun customer baru' })).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Akun Admin' }));
    await screen.findByText('Siti Staff');
    expect(screen.queryByRole('button', { name: 'Buat akun staff baru' })).toBeNull();
  });
});

describe('AccountsSection — add admin (staff) account', () => {
  it('opens the staff form and validates required fields', async () => {
    renderSection();

    await userEvent.click(screen.getByRole('tab', { name: 'Akun Admin' }));
    await screen.findByText('Siti Staff');

    await userEvent.click(screen.getByRole('button', { name: 'Buat akun staff baru' }));

    const dialog = screen.getByRole('dialog', { name: /Buat Akun Staff Baru/i });
    expect(within(dialog).getByLabelText('Nama Lengkap')).toBeTruthy();
    expect(within(dialog).getByLabelText('Email')).toBeTruthy();
    expect(within(dialog).getByLabelText('Role')).toBeTruthy();
    expect(within(dialog).getByLabelText('Password Sementara')).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat Akun' }));
    expect(within(dialog).getByText('Nama wajib diisi.')).toBeTruthy();
    expect(within(dialog).getByText('Email wajib diisi.')).toBeTruthy();
    expect(within(dialog).getByText('Password wajib diisi.')).toBeTruthy();
    expect(createStaffMock).not.toHaveBeenCalled();
  });

  it('submits to the create-staff endpoint and closes the modal', async () => {
    renderSection();

    await userEvent.click(screen.getByRole('tab', { name: 'Akun Admin' }));
    await screen.findByText('Siti Staff');

    await userEvent.click(screen.getByRole('button', { name: 'Buat akun staff baru' }));
    const dialog = screen.getByRole('dialog', { name: /Buat Akun Staff Baru/i });

    await userEvent.type(within(dialog).getByLabelText('Nama Lengkap'), 'Staff Baru');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'staff@example.com');
    await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'cashier');
    await userEvent.type(within(dialog).getByLabelText('Password Sementara'), 'rahasia123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat Akun' }));

    await waitFor(() => {
      expect(createStaffMock).toHaveBeenCalledWith({
        name: 'Staff Baru',
        email: 'staff@example.com',
        role: 'cashier',
        password: 'rahasia123',
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Buat Akun Staff Baru/i })).toBeNull();
    });
  });
});

describe('AccountsSection — add customer account', () => {
  it('opens the customer form, validates, and submits to the endpoint', async () => {
    renderSection();

    await screen.findByText('Andi Customer');
    await userEvent.click(screen.getByRole('button', { name: 'Buat akun customer baru' }));

    const dialog = screen.getByRole('dialog', { name: /Buat Akun Customer Baru/i });
    await userEvent.type(within(dialog).getByLabelText('Nama Lengkap'), 'Cust Baru');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'cust@example.com');
    await userEvent.type(within(dialog).getByLabelText('No. WhatsApp'), '081234');
    await userEvent.type(within(dialog).getByLabelText('Password Sementara'), 'rahasia123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat Akun' }));

    await waitFor(() => {
      expect(createCustomerMock).toHaveBeenCalledWith({
        name: 'Cust Baru',
        email: 'cust@example.com',
        phone: '081234',
        password: 'rahasia123',
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Buat Akun Customer Baru/i })).toBeNull();
    });
  });
});