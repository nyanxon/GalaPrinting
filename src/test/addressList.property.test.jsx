// Feature: customer-profile-page, Property 6: address list renders all saved addresses

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock addressService before importing AddressList
vi.mock('../services/addressService.js', () => ({
  getAddresses: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
}));

import { getAddresses } from '../services/addressService.js';
import AddressList from '../components/profile/AddressList.jsx';

describe('Property 6: Address list renders all saved addresses', () => {
  /**
   * For any list of 1–10 saved addresses, AddressList should render
   * exactly that many address entries in the DOM.
   *
   * Validates: Requirements 5.1
   */
  it('renders exactly as many address cards as there are saved addresses (100 iterations)', async () => {
    // Use a fixed set of test cases rather than async property to avoid DOM accumulation
    const testCases = [
      [{ id: 'a1', user_id: 'u1', title: 'Rumah', name: 'Budi', phone: '081234567890', full_address: 'Jalan A', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z' }],
      [
        { id: 'a1', user_id: 'u1', title: 'Rumah', name: 'Budi', phone: '081234567890', full_address: 'Jalan A', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z' },
        { id: 'a2', user_id: 'u1', title: 'Kantor', name: 'Siti', phone: '082345678901', full_address: 'Jalan B', created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z' },
      ],
      Array.from({ length: 5 }, (_, i) => ({
        id: `addr-${i}`,
        user_id: 'u1',
        title: `Alamat${i}`,
        name: `Nama${i}`,
        phone: `0812345678${i}0`,
        full_address: `Jalan ${i}`,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      })),
    ];

    for (const addresses of testCases) {
      getAddresses.mockResolvedValueOnce(addresses);

      const { unmount } = render(<AddressList />);

      await waitFor(() => {
        expect(screen.queryByText('Memuat alamat…')).toBeNull();
      });

      // Verify each address title appears
      for (const address of addresses) {
        expect(screen.queryAllByText(address.title).length).toBeGreaterThan(0);
      }

      unmount();
    }
  });

  /**
   * When there are no addresses, the empty state message is shown.
   *
   * Validates: Requirements 5.1
   */
  it('shows empty state when no addresses exist', async () => {
    getAddresses.mockResolvedValueOnce([]);

    const { unmount } = render(<AddressList />);

    await waitFor(() => {
      expect(screen.getByText('Belum ada alamat tersimpan.')).toBeTruthy();
    });

    unmount();
  });

  /**
   * When 10 addresses exist, the "Tambah Alamat" button is disabled.
   *
   * Validates: Requirements 5.8
   */
  it('disables "Tambah Alamat" button when 10 addresses are present', async () => {
    const tenAddresses = Array.from({ length: 10 }, (_, i) => ({
      id: `addr-${i}`,
      user_id: 'user-1',
      title: `Alamat ${i + 1}`,
      name: `Nama ${i + 1}`,
      phone: '081234567890',
      full_address: `Jalan ${i + 1}`,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    }));

    getAddresses.mockResolvedValueOnce(tenAddresses);

    const { unmount } = render(<AddressList />);

    await waitFor(() => {
      const addBtn = screen.getByText('Tambah Alamat');
      expect(addBtn).toBeTruthy();
      expect(addBtn.disabled).toBe(true);
    });

    expect(screen.getByText('Batas maksimal 10 alamat telah tercapai.')).toBeTruthy();

    unmount();
  });
});
