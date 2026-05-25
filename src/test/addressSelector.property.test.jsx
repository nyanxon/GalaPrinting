// Feature: customer-profile-page, Property 9: address selector populates form fields

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';

// Mock addressService before importing AddressSelector
vi.mock('../services/addressService.js', () => ({
  getAddresses: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
}));

import { getAddresses } from '../services/addressService.js';
import AddressSelector from '../components/shared/AddressSelector.jsx';

/**
 * Arbitrary for a single address object.
 */
const addressArbitrary = fc.record({
  id: fc.uuid(),
  user_id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }).map((s) => s.trim()).filter((s) => s.length > 0),
  name: fc.string({ minLength: 1, maxLength: 80 }).map((s) => s.trim()).filter((s) => s.length > 0),
  phone: fc.stringMatching(/^[0-9]{8,15}$/),
  full_address: fc.string({ minLength: 5, maxLength: 200 }).map((s) => s.trim()).filter((s) => s.length > 0),
  created_at: fc.constant('2024-01-01T00:00:00.000Z'),
  updated_at: fc.constant('2024-01-01T00:00:00.000Z'),
});

describe('Property 9: Address selector populates form fields', () => {
  /**
   * For any saved address, selecting it in AddressSelector should call
   * onSelect with values that exactly match the address data.
   *
   * Validates: Requirements 6.2
   */
  it('onSelect receives name, phone, and address matching the selected address (100 iterations)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(addressArbitrary, { minLength: 1, maxLength: 5 }),
        fc.nat(), // index to select
        async (addresses, rawIndex) => {
          const selectedIndex = rawIndex % addresses.length;
          const selectedAddress = addresses[selectedIndex];

          getAddresses.mockResolvedValueOnce(addresses);

          const onSelect = vi.fn();
          const { unmount } = render(<AddressSelector onSelect={onSelect} />);

          // Wait for addresses to load
          await waitFor(() => {
            expect(screen.queryByText('— Pilih alamat tersimpan —')).not.toBeNull();
          });

          // Select the address by its id value
          const select = screen.getByRole('combobox');
          fireEvent.change(select, { target: { value: selectedAddress.id } });

          // onSelect should have been called with the correct values
          expect(onSelect).toHaveBeenCalledTimes(1);
          const callArg = onSelect.mock.calls[0][0];

          expect(callArg.name).toBe(selectedAddress.name);
          expect(callArg.phone).toBe(selectedAddress.phone);
          expect(callArg.address).toBe(selectedAddress.full_address);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Selecting the placeholder option should NOT call onSelect.
   *
   * Validates: Requirements 6.2
   */
  it('selecting placeholder option does not call onSelect', async () => {
    const addresses = [
      {
        id: 'addr-1',
        user_id: 'user-1',
        title: 'Rumah',
        name: 'Budi',
        phone: '081234567890',
        full_address: 'Jalan Merdeka 1',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    getAddresses.mockResolvedValueOnce(addresses);

    const onSelect = vi.fn();
    const { unmount } = render(<AddressSelector onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.queryByText('— Pilih alamat tersimpan —')).not.toBeNull();
    });

    // Select the placeholder (empty value)
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });

    expect(onSelect).not.toHaveBeenCalled();

    unmount();
  });

  /**
   * When no addresses exist, AddressSelector renders nothing.
   *
   * Validates: Requirements 6.3
   */
  it('renders nothing when no addresses exist', async () => {
    getAddresses.mockResolvedValueOnce([]);

    const onSelect = vi.fn();
    const { unmount, container } = render(<AddressSelector onSelect={onSelect} />);

    // Wait for fetch to complete
    await waitFor(() => {
      // Component should render nothing (null)
      expect(container.firstChild).toBeNull();
    });

    unmount();
  });
});
