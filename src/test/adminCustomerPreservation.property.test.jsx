/**
 * adminCustomerPreservation.property.test.jsx
 *
 * Preservation property tests for Bug 1 — Tanggal Bergabung Customer.
 *
 * **IMPORTANT**: These tests follow the observation-first methodology.
 * They MUST PASS on UNFIXED code — they establish the baseline behavior
 * to preserve after the fix is applied.
 *
 * These tests verify that the non-buggy columns (Name, Email, Phone),
 * search functionality, and pagination continue to work correctly
 * both before and after the Bug 1 fix.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// Mock authService so CustomersSection doesn't make real HTTP calls.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../services/authService.js', () => ({
  listCustomers: vi.fn(),
}));

import { listCustomers } from '../services/authService.js';
import CustomersSection from '../components/pages/admin/sections/CustomersSection.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Arbitrary: generates customer objects in the API response shape (snake_case).
// These objects have `created_at` (snake_case) — the real API shape.
// ─────────────────────────────────────────────────────────────────────────────
const customerArbitrary = fc.record({
  id: fc.uuid(),
  name: fc
    .string({ minLength: 1, maxLength: 50 })
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
  email: fc.emailAddress(),
  phone: fc.option(fc.stringMatching(/^[0-9]{8,15}$/), { nil: null }),
  created_at: fc
    .date({
      min: new Date('2020-01-01T00:00:00.000Z'),
      max: new Date('2025-12-31T23:59:59.999Z'),
    })
    .map((d) => d.toISOString()),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a deterministic customer list for pagination tests.
// ─────────────────────────────────────────────────────────────────────────────
function makeCustomers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `customer-${i + 1}`,
    name: `Customer ${i + 1}`,
    email: `customer${i + 1}@example.com`,
    phone: `0812345678${String(i).padStart(2, '0')}`,
    created_at: '2024-06-15T08:00:00.000Z',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset mocks before each test
// ─────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Requirement 3.1 — Customer list displays Name, Email, Phone columns
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.1 — Customer list displays Name, Email, Phone columns', () => {
  /**
   * Concrete test: a single customer's Name, Email, Phone are rendered.
   *
   * **Validates: Requirements 3.1**
   */
  it('renders Name, Email, Phone for a single concrete customer', async () => {
    const customer = {
      id: 'abc-123',
      name: 'Budi Santoso',
      email: 'budi@mail.com',
      phone: '081234567890',
      created_at: '2025-05-07T10:00:00.000Z',
    };

    listCustomers.mockResolvedValueOnce([customer]);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    expect(screen.getByText('Budi Santoso')).toBeTruthy();
    expect(screen.getByText('budi@mail.com')).toBeTruthy();
    expect(screen.getByText('081234567890')).toBeTruthy();

    unmount();
  });

  /**
   * Property: for any customer object, Name, Email, and Phone columns
   * are always rendered with the correct values.
   *
   * **Validates: Requirements 3.1**
   */
  it('property: Name, Email, Phone columns always render correctly for any customer', async () => {
    const testCases = await fc.sample(customerArbitrary, 5);

    for (const customer of testCases) {
      listCustomers.mockResolvedValueOnce([customer]);

      const { unmount } = render(<CustomersSection />);

      await waitFor(() => {
        expect(screen.queryByText('Belum ada customer.')).toBeNull();
      });

      // Name column: rendered as-is (or '—' if falsy)
      const expectedName = customer.name || '—';
      expect(screen.getByText(expectedName)).toBeTruthy();

      // Email column: always rendered
      expect(screen.getByText(customer.email)).toBeTruthy();

      // Phone column: rendered as-is (or '—' if null)
      const expectedPhone = customer.phone || '—';
      expect(screen.getByText(expectedPhone)).toBeTruthy();

      unmount();
    }
  });

  /**
   * Property: for a list of multiple customers, all Name, Email, Phone
   * values are rendered in the table.
   *
   * **Validates: Requirements 3.1**
   */
  it('property: all customers in a list have their Name, Email, Phone rendered', async () => {
    const customers = makeCustomers(5);

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    for (const customer of customers) {
      expect(screen.getByText(customer.name)).toBeTruthy();
      expect(screen.getByText(customer.email)).toBeTruthy();
      expect(screen.getByText(customer.phone)).toBeTruthy();
    }

    unmount();
  });

  /**
   * Edge case: customer with null phone renders '—' in Phone column.
   *
   * **Validates: Requirements 3.1**
   */
  it('renders "—" for null phone', async () => {
    const customer = {
      id: 'xyz-456',
      name: 'Sari',
      email: 'sari@mail.com',
      phone: null,
      created_at: '2024-01-15T08:30:00.000Z',
    };

    listCustomers.mockResolvedValueOnce([customer]);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    expect(screen.getByText('Sari')).toBeTruthy();
    expect(screen.getByText('sari@mail.com')).toBeTruthy();
    // Phone is null → should render '—'
    const dashCells = screen.getAllByText('—');
    expect(dashCells.length).toBeGreaterThan(0);

    unmount();
  });

  /**
   * Edge case: empty customer list shows empty state message.
   *
   * **Validates: Requirements 3.1**
   */
  it('shows empty state when no customers exist', async () => {
    listCustomers.mockResolvedValueOnce([]);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.getByText('Belum ada customer.')).toBeTruthy();
    });

    unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Requirement 3.2 — Search filters customers by name, email, or phone
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.2 — Search filters customers by name, email, or phone', () => {
  /**
   * Concrete test: searching by name filters the list correctly.
   *
   * **Validates: Requirements 3.2**
   */
  it('search by name filters the customer list', async () => {
    const customers = [
      { id: '1', name: 'Budi Santoso', email: 'budi@mail.com', phone: '081111111111', created_at: '2024-01-01T00:00:00.000Z' },
      { id: '2', name: 'Sari Dewi', email: 'sari@mail.com', phone: '082222222222', created_at: '2024-02-01T00:00:00.000Z' },
      { id: '3', name: 'Ahmad Fauzi', email: 'ahmad@mail.com', phone: '083333333333', created_at: '2024-03-01T00:00:00.000Z' },
    ];

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    // Type in search box
    const searchInput = screen.getByPlaceholderText('Cari nama / email / telepon…');
    fireEvent.change(searchInput, { target: { value: 'Budi' } });

    // Only Budi should be visible
    expect(screen.getByText('Budi Santoso')).toBeTruthy();
    expect(screen.queryByText('Sari Dewi')).toBeNull();
    expect(screen.queryByText('Ahmad Fauzi')).toBeNull();

    unmount();
  });

  /**
   * Concrete test: searching by email filters the list correctly.
   *
   * **Validates: Requirements 3.2**
   */
  it('search by email filters the customer list', async () => {
    const customers = [
      { id: '1', name: 'Budi Santoso', email: 'budi@mail.com', phone: '081111111111', created_at: '2024-01-01T00:00:00.000Z' },
      { id: '2', name: 'Sari Dewi', email: 'sari@example.com', phone: '082222222222', created_at: '2024-02-01T00:00:00.000Z' },
    ];

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    const searchInput = screen.getByPlaceholderText('Cari nama / email / telepon…');
    fireEvent.change(searchInput, { target: { value: 'example.com' } });

    expect(screen.queryByText('Budi Santoso')).toBeNull();
    expect(screen.getByText('Sari Dewi')).toBeTruthy();

    unmount();
  });

  /**
   * Concrete test: searching by phone filters the list correctly.
   *
   * **Validates: Requirements 3.2**
   */
  it('search by phone filters the customer list', async () => {
    const customers = [
      { id: '1', name: 'Budi Santoso', email: 'budi@mail.com', phone: '081111111111', created_at: '2024-01-01T00:00:00.000Z' },
      { id: '2', name: 'Sari Dewi', email: 'sari@mail.com', phone: '089999999999', created_at: '2024-02-01T00:00:00.000Z' },
    ];

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    const searchInput = screen.getByPlaceholderText('Cari nama / email / telepon…');
    fireEvent.change(searchInput, { target: { value: '089999' } });

    expect(screen.queryByText('Budi Santoso')).toBeNull();
    expect(screen.getByText('Sari Dewi')).toBeTruthy();

    unmount();
  });

  /**
   * Property: for any search query matching a customer's name, that customer
   * appears in the filtered results.
   *
   * **Validates: Requirements 3.2**
   */
  it('property: search by name always includes matching customers', async () => {
    // Use a fixed set of representative test cases
    const testCases = [
      {
        customers: [
          { id: '1', name: 'Alice', email: 'alice@test.com', phone: '081000000001', created_at: '2024-01-01T00:00:00.000Z' },
          { id: '2', name: 'Bob', email: 'bob@test.com', phone: '081000000002', created_at: '2024-01-01T00:00:00.000Z' },
          { id: '3', name: 'Charlie', email: 'charlie@test.com', phone: '081000000003', created_at: '2024-01-01T00:00:00.000Z' },
        ],
        query: 'alice',
        shouldFind: 'Alice',
        shouldNotFind: ['Bob', 'Charlie'],
      },
      {
        customers: [
          { id: '1', name: 'Dewi Lestari', email: 'dewi@test.com', phone: '082000000001', created_at: '2024-01-01T00:00:00.000Z' },
          { id: '2', name: 'Eko Prasetyo', email: 'eko@test.com', phone: '082000000002', created_at: '2024-01-01T00:00:00.000Z' },
        ],
        query: 'lestari',
        shouldFind: 'Dewi Lestari',
        shouldNotFind: ['Eko Prasetyo'],
      },
    ];

    for (const { customers, query, shouldFind, shouldNotFind } of testCases) {
      listCustomers.mockResolvedValueOnce(customers);

      const { unmount } = render(<CustomersSection />);

      await waitFor(() => {
        expect(screen.queryByText('Belum ada customer.')).toBeNull();
      });

      const searchInput = screen.getByPlaceholderText('Cari nama / email / telepon…');
      fireEvent.change(searchInput, { target: { value: query } });

      expect(screen.getByText(shouldFind)).toBeTruthy();
      for (const name of shouldNotFind) {
        expect(screen.queryByText(name)).toBeNull();
      }

      unmount();
    }
  });

  /**
   * Edge case: clearing search restores the full list.
   *
   * **Validates: Requirements 3.2**
   */
  it('clearing search restores the full customer list', async () => {
    const customers = [
      { id: '1', name: 'Budi', email: 'budi@mail.com', phone: '081111111111', created_at: '2024-01-01T00:00:00.000Z' },
      { id: '2', name: 'Sari', email: 'sari@mail.com', phone: '082222222222', created_at: '2024-02-01T00:00:00.000Z' },
    ];

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    const searchInput = screen.getByPlaceholderText('Cari nama / email / telepon…');

    // Filter to only Budi
    fireEvent.change(searchInput, { target: { value: 'Budi' } });
    expect(screen.getByText('Budi')).toBeTruthy();
    expect(screen.queryByText('Sari')).toBeNull();

    // Clear search — both should be visible again
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Budi')).toBeTruthy();
    expect(screen.getByText('Sari')).toBeTruthy();

    unmount();
  });

  /**
   * Edge case: search with no matches shows empty state.
   *
   * **Validates: Requirements 3.2**
   */
  it('search with no matches shows empty state', async () => {
    const customers = [
      { id: '1', name: 'Budi', email: 'budi@mail.com', phone: '081111111111', created_at: '2024-01-01T00:00:00.000Z' },
    ];

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    const searchInput = screen.getByPlaceholderText('Cari nama / email / telepon…');
    fireEvent.change(searchInput, { target: { value: 'zzznomatch' } });

    expect(screen.getByText('Belum ada customer.')).toBeTruthy();

    unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Requirement 3.3 — Pagination displays correct pages
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.3 — Pagination displays correct pages', () => {
  /**
   * Concrete test: with 10 or fewer customers, no pagination bar is shown.
   *
   * **Validates: Requirements 3.3**
   */
  it('no pagination bar when 10 or fewer customers', async () => {
    const customers = makeCustomers(5);

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    // All 5 customers should be visible
    for (const c of customers) {
      expect(screen.getByText(c.name)).toBeTruthy();
    }

    // No pagination buttons (totalPages <= 1)
    expect(screen.queryByRole('button', { name: '‹' })).toBeNull();
    expect(screen.queryByRole('button', { name: '›' })).toBeNull();

    unmount();
  });

  /**
   * Concrete test: with 11 customers, page 1 shows first 10 and page 2 shows 1.
   *
   * **Validates: Requirements 3.3**
   */
  it('page 1 shows first 10 customers when 11 total', async () => {
    const customers = makeCustomers(11);

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    // First 10 customers should be visible on page 1
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`Customer ${i}`)).toBeTruthy();
    }

    // Customer 11 should NOT be visible on page 1
    expect(screen.queryByText('Customer 11')).toBeNull();

    // Pagination info should show "1–10 dari 11"
    expect(screen.getByText('1–10 dari 11')).toBeTruthy();

    unmount();
  });

  /**
   * Concrete test: clicking next page shows the correct customers.
   *
   * **Validates: Requirements 3.3**
   */
  it('clicking next page shows the correct customers', async () => {
    const customers = makeCustomers(11);

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    // Click next page button
    const nextBtn = screen.getByRole('button', { name: '›' });
    fireEvent.click(nextBtn);

    // Customer 11 should now be visible
    await waitFor(() => {
      expect(screen.getByText('Customer 11')).toBeTruthy();
    });

    // Customer 1 should NOT be visible on page 2
    expect(screen.queryByText('Customer 1')).toBeNull();

    // Pagination info should show "11–11 dari 11"
    expect(screen.getByText('11–11 dari 11')).toBeTruthy();

    unmount();
  });

  /**
   * Property: for any number of customers between 1 and 25, the first page
   * shows at most 10 customers and the count header is correct.
   *
   * **Validates: Requirements 3.3**
   */
  it('property: first page always shows at most 10 customers', async () => {
    const testCases = [1, 5, 10, 11, 15, 20, 25];

    for (const count of testCases) {
      const customers = makeCustomers(count);

      listCustomers.mockResolvedValueOnce(customers);

      const { unmount } = render(<CustomersSection />);

      await waitFor(() => {
        expect(screen.queryByText('Belum ada customer.')).toBeNull();
      });

      // Count header should show total
      expect(screen.getByText(`Daftar Customer (${count})`)).toBeTruthy();

      // First page shows min(count, 10) customers
      const expectedOnPage1 = Math.min(count, 10);
      for (let i = 1; i <= expectedOnPage1; i++) {
        expect(screen.getByText(`Customer ${i}`)).toBeTruthy();
      }

      // Customer 11+ should not be visible on page 1
      if (count > 10) {
        expect(screen.queryByText('Customer 11')).toBeNull();
      }

      unmount();
    }
  });

  /**
   * Property: pagination info text is always correct for any page.
   *
   * **Validates: Requirements 3.3**
   */
  it('property: pagination info text is correct for page 1 with 15 customers', async () => {
    const customers = makeCustomers(15);

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    // Page 1: shows 1–10 of 15
    expect(screen.getByText('1–10 dari 15')).toBeTruthy();

    // Navigate to page 2
    const nextBtn = screen.getByRole('button', { name: '›' });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      // Page 2: shows 11–15 of 15
      expect(screen.getByText('11–15 dari 15')).toBeTruthy();
    });

    unmount();
  });

  /**
   * Edge case: search + pagination — filtered results paginate correctly.
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  it('search resets to page 1 and paginates filtered results correctly', async () => {
    // 15 customers: 10 named "Alpha X", 5 named "Beta X"
    const customers = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `alpha-${i}`,
        name: `Alpha ${i + 1}`,
        email: `alpha${i + 1}@test.com`,
        phone: `0810000000${String(i).padStart(2, '0')}`,
        created_at: '2024-01-01T00:00:00.000Z',
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `beta-${i}`,
        name: `Beta ${i + 1}`,
        email: `beta${i + 1}@test.com`,
        phone: `0820000000${String(i).padStart(2, '0')}`,
        created_at: '2024-01-01T00:00:00.000Z',
      })),
    ];

    listCustomers.mockResolvedValueOnce(customers);

    const { unmount } = render(<CustomersSection />);

    await waitFor(() => {
      expect(screen.queryByText('Belum ada customer.')).toBeNull();
    });

    // Search for "Beta" — should show 5 results, no pagination needed
    const searchInput = screen.getByPlaceholderText('Cari nama / email / telepon…');
    fireEvent.change(searchInput, { target: { value: 'Beta' } });

    // All 5 Beta customers should be visible
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(`Beta ${i}`)).toBeTruthy();
    }

    // No Alpha customers should be visible
    expect(screen.queryByText('Alpha 1')).toBeNull();

    // Count header should show filtered count
    expect(screen.getByText('Daftar Customer (5)')).toBeTruthy();

    // No pagination bar (5 results fit on one page)
    expect(screen.queryByRole('button', { name: '›' })).toBeNull();

    unmount();
  });
});
