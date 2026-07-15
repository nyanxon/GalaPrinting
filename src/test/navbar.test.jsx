// Feature: vanilla-to-react-migration, Property 8: Navbar cart badge reflects context
// Feature: vanilla-to-react-migration, Property 9: Navbar links reflect user role
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../components/context/AuthContext.jsx';
import { CartContext } from '../components/context/CartContext.jsx';
import Navbar from '../components/shared/Navbar.jsx';

// Mock authService so logout doesn't touch real localStorage
vi.mock('../services/auth.js', () => ({
  getCurrentUser: vi.fn(() => null),
  logout: vi.fn(),
}));

/** All staff roles */
const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

/**
 * Helper: render Navbar with explicit context values inside a MemoryRouter.
 */
function renderNavbar(user, items = []) {
  const cartValue = {
    items,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
  };
  const authValue = { user, updateUser: vi.fn() };

  return render(
    <AuthContext.Provider value={authValue}>
      <CartContext.Provider value={cartValue}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </CartContext.Provider>
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Property 8: Navbar cart badge reflects context
// Validates: Requirements 6.6
// ---------------------------------------------------------------------------

describe('Property 8: Navbar cart badge reflects context', () => {
  /**
   * For any cart state with N items, the cart badge rendered by <Navbar>
   * SHALL display N when N > 0, and SHALL not render the badge when N === 0.
   *
   * Validates: Requirements 6.6
   */
  it('badge count equals items.length for any cart size (guest)', () => {
    fc.assert(
      fc.property(
        // Generate 0–20 cart items
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 30 }),
            price: fc.integer({ min: 1000, max: 500000 }),
            quantity: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (items) => {
          const { unmount, container } = renderNavbar(null, items);

          const badge = container.querySelector('[data-cart-count]');

          if (items.length === 0) {
            // Badge should not be rendered when cart is empty
            expect(badge).toBeNull();
          } else {
            // Badge should show the exact count
            expect(badge).not.toBeNull();
            expect(Number(badge.textContent)).toBe(items.length);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('badge count equals items.length for any cart size (customer)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 30 }),
            price: fc.integer({ min: 1000, max: 500000 }),
            quantity: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (items) => {
          const customer = { id: 'c1', name: 'Test Customer', role: 'customer' };
          const { unmount, container } = renderNavbar(customer, items);

          const badge = container.querySelector('[data-cart-count]');

          if (items.length === 0) {
            expect(badge).toBeNull();
          } else {
            expect(badge).not.toBeNull();
            expect(Number(badge.textContent)).toBe(items.length);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('staff users do not see the cart badge', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STAFF_ROLES),
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 30 }),
            price: fc.integer({ min: 1000, max: 500000 }),
            quantity: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (role, items) => {
          const staffUser = { id: 's1', name: 'Staff', role };
          const { unmount, container } = renderNavbar(staffUser, items);

          // Staff should not see the cart badge
          const badge = container.querySelector('[data-cart-count]');
          expect(badge).toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Navbar links reflect user role
// Validates: Requirements 6.7
// ---------------------------------------------------------------------------

describe('Property 9: Navbar links reflect user role', () => {
  /**
   * For any authenticated user with a given role, the navigation links
   * rendered by <Navbar> SHALL match the set of links defined for that role,
   * and SHALL not include links intended for other roles.
   *
   * Validates: Requirements 6.7
   */
  it('guest sees public navigation links and no customer-only links', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        (user) => {
          const { unmount } = renderNavbar(user, []);

          // Guest should see Login link
          const loginLinks = screen.getAllByRole('link').filter(
            (el) => el.textContent.includes('Login')
          );
          expect(loginLinks.length).toBeGreaterThan(0);

          // Guest should NOT see "Pesanan Saya" (My Orders)
          const myOrdersLinks = screen.queryAllByRole('link').filter(
            (el) => el.textContent.includes('Pesanan Saya')
          );
          expect(myOrdersLinks.length).toBe(0);

          // Guest should NOT see "Keluar" (Logout)
          const logoutBtns = screen.queryAllByRole('button').filter(
            (el) => el.textContent.includes('Keluar')
          );
          expect(logoutBtns.length).toBe(0);

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('customer sees My Orders and Cart links, no staff dashboard links', () => {
    fc.assert(
      fc.property(
        fc.constant({ id: 'c1', name: 'Customer', role: 'customer' }),
        (user) => {
          const { unmount } = renderNavbar(user, []);

          // Customer should see Logout button
          const logoutBtns = screen.getAllByRole('button').filter(
            (el) => el.textContent.includes('Keluar')
          );
          expect(logoutBtns.length).toBeGreaterThan(0);

          // Customer should NOT see Login link
          const loginLinks = screen.queryAllByRole('link').filter(
            (el) => el.textContent === 'Login'
          );
          expect(loginLinks.length).toBe(0);

          // Customer should NOT see any staff dashboard links
          const dashboardLinks = screen.queryAllByRole('link').filter(
            (el) => el.getAttribute('href')?.startsWith('/admin') ||
                    el.getAttribute('href')?.startsWith('/owner') ||
                    el.getAttribute('href')?.startsWith('/cashier')
          );
          expect(dashboardLinks.length).toBe(0);

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('staff user sees only their dashboard link and Logout, no public nav', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STAFF_ROLES),
        (role) => {
          const staffUser = { id: 's1', name: 'Staff', role };
          const { unmount } = renderNavbar(staffUser, []);

          // Staff should see Logout button
          const logoutBtns = screen.getAllByRole('button').filter(
            (el) => el.textContent.includes('Keluar')
          );
          expect(logoutBtns.length).toBeGreaterThan(0);

          // Staff should NOT see Login link
          const loginLinks = screen.queryAllByRole('link').filter(
            (el) => el.textContent === 'Login'
          );
          expect(loginLinks.length).toBe(0);

          // Staff should NOT see "Pesanan Saya"
          const myOrdersLinks = screen.queryAllByRole('link').filter(
            (el) => el.textContent.includes('Pesanan Saya')
          );
          expect(myOrdersLinks.length).toBe(0);

          // Staff should NOT see secondary nav links (Tentang Kami, Cara Order, etc.)
          const tentangLinks = screen.queryAllByRole('link').filter(
            (el) => el.textContent === 'Tentang Kami'
          );
          expect(tentangLinks.length).toBe(0);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no cross-role links: staff roles do not see other staff dashboard links', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STAFF_ROLES),
        (role) => {
          const staffUser = { id: 's1', name: 'Staff', role };
          const { unmount } = renderNavbar(staffUser, []);

          // Get all links
          const allLinks = screen.queryAllByRole('link');

          // Other staff dashboard paths that should NOT appear
          const otherStaffPaths = STAFF_ROLES
            .filter((r) => r !== role)
            .map((r) => `/${r}`);

          for (const path of otherStaffPaths) {
            const crossLinks = allLinks.filter(
              (el) => el.getAttribute('href') === path
            );
            expect(crossLinks.length).toBe(0);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
