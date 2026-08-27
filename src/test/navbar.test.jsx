// Feature: vanilla-to-react-migration, Property 8: Navbar cart badge reflects context
// Feature: vanilla-to-react-migration, Property 9: Navbar links reflect user role
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { MemoryRouter } from 'react-router';
import { AuthContext } from '../components/context/AuthContext.jsx';
import { CartContext } from '../components/context/CartContext.jsx';
import i18n from '../i18n/index.js';
import Navbar from '../components/shared/Navbar.jsx';
import { STAFF_ROLE_DASHBOARD_PATH } from '../config/roles.js';

// Mock authService so logout doesn't touch real localStorage
vi.mock('../services/auth.js', () => ({
  getCurrentUser: vi.fn(() => null),
  logout: vi.fn(),
}));

/** All staff roles */
const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

/**
 * Force Indonesian so the translated labels used by these tests are deterministic.
 */
beforeAll(async () => {
  await i18n.changeLanguage('id');
});

/**
 * Helper: render Navbar with explicit context values inside a MemoryRouter.
 * When `openProfile` is true the logged-in profile popup is opened first so
 * popup-only controls (dashboard links, Logout) are present in the DOM.
 */
function renderNavbar(user, items = [], { openProfile = false } = {}) {
  // Ensure each render starts from a clean DOM. Property tests (fc.assert)
  // run many renders inside a single `it`, so afterEach cleanup alone is not enough.
  cleanup();

  const cartValue = {
    items,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
  };
  const authValue = { user, updateUser: vi.fn() };

  const result = render(
    <AuthContext.Provider value={authValue}>
      <CartContext.Provider value={cartValue}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </CartContext.Provider>
    </AuthContext.Provider>
  );

  if (openProfile && user) {
    fireEvent.click(screen.getByRole('button', { name: i18n.t('nav.profileMenu') }));
  }

  return result;
}

/** Links (desktop + open popups, excluding the aria-hidden mobile sidebar). */
function visibleLinks() {
  return screen.queryAllByRole('link');
}

// ---------------------------------------------------------------------------
// Property 8: Navbar cart badge reflects context
// Validates: Requirements 6.6
// ---------------------------------------------------------------------------

describe('Property 8: Navbar cart badge reflects context', () => {
  /**
   * For any cart state with N items, the cart badge rendered by <Navbar>
   * SHALL display N when N > 0, and SHALL not render the badge when N === 0.
   * The badge is shown to every role — the Navbar intentionally gives all
   * users the same full storefront header.
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
  }, 30_000);

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
  }, 30_000);

  it('badge count equals items.length for any cart size (staff)', () => {
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
          { minLength: 0, maxLength: 20 }
        ),
        (role, items) => {
          const staffUser = { id: 's1', name: 'Staff', role };
          const { unmount, container } = renderNavbar(staffUser, items);

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
  }, 30_000);
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
   * The Navbar gives every role the same full storefront header; role-specific
   * controls (dashboard link, Logout) live inside the profile popup.
   *
   * Validates: Requirements 6.7
   */
  it('guest sees public navigation links and no customer-only or logout controls', () => {
    renderNavbar(null, []);

    // Public nav link (e.g. Tentang Kami) is visible
    expect(screen.getByRole('link', { name: /Tentang Kami/ })).toBeTruthy();

    // Guest has a sign-in control (avatar button labelled "Masuk")
    expect(screen.getByRole('button', { name: i18n.t('nav.login') })).toBeTruthy();

    // No customer-only links
    const myOrdersLinks = visibleLinks().filter(
      (el) => el.textContent.includes('Pesanan Saya')
    );
    expect(myOrdersLinks.length).toBe(0);

    // No "Keluar" (Logout) buttons
    const logoutBtns = screen.queryAllByRole('button').filter(
      (el) => el.textContent.includes('Keluar')
    );
    expect(logoutBtns.length).toBe(0);
  });

  it('customer sees the customer nav with My Orders and Logout, no staff dashboard links', () => {
    const customer = { id: 'c1', name: 'Customer', role: 'customer' };
    const { container } = renderNavbar(customer, [], { openProfile: true });

    // No sign-in control is shown for a logged-in customer
    expect(screen.queryAllByRole('button', { name: i18n.t('nav.login') }).length).toBe(0);

    // Profile popup contains customer-only links (My Orders) and Logout
    const popup = container.querySelector('#profile-popup');
    expect(popup).not.toBeNull();
    expect(within(popup).getByRole('link', { name: /Pesanan Saya/ })).toBeTruthy();
    expect(within(popup).getByRole('button', { name: /Keluar/ })).toBeTruthy();

    // Customer should NOT see any staff dashboard links
    const dashboardPaths = Object.values(STAFF_ROLE_DASHBOARD_PATH);
    const dashboardLinks = visibleLinks().filter(
      (el) => dashboardPaths.includes(el.getAttribute('href'))
    );
    expect(dashboardLinks.length).toBe(0);
  });

  it('staff user sees only their own dashboard link and Logout, no cross-role or sign-in controls', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STAFF_ROLES),
        (role) => {
          const staffUser = { id: 's1', name: 'Staff', role };
          const { container } = renderNavbar(staffUser, [], { openProfile: true });

          // No sign-in control for a logged-in staff user
          expect(screen.queryAllByRole('button', { name: i18n.t('nav.login') }).length).toBe(0);

          // Their own dashboard link is present in the profile popup
          const ownPath = STAFF_ROLE_DASHBOARD_PATH[role];
          const ownLinks = visibleLinks().filter(
            (el) => el.getAttribute('href') === ownPath
          );
          expect(ownLinks.length).toBeGreaterThan(0);

          // Logout button is present in the profile popup
          const popup = container.querySelector('#profile-popup');
          expect(popup).not.toBeNull();
          expect(within(popup).getByRole('button', { name: /Keluar/ })).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  }, 30_000);

  it('no cross-role links: staff roles do not see other staff dashboard links', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STAFF_ROLES),
        (role) => {
          const staffUser = { id: 's1', name: 'Staff', role };
          renderNavbar(staffUser, [], { openProfile: true });

          const otherStaffPaths = STAFF_ROLES
            .filter((r) => r !== role)
            .map((r) => STAFF_ROLE_DASHBOARD_PATH[r]);

          for (const path of otherStaffPaths) {
            const crossLinks = visibleLinks().filter(
              (el) => el.getAttribute('href') === path
            );
            expect(crossLinks.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30_000);
});