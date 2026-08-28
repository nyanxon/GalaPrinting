// Feature: vanilla-to-react-migration, Property 3: Unknown routes render NotFoundPage
// Feature: vanilla-to-react-migration, Property 10: Staff routes exclude public shell
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AuthContext } from '../components/context/AuthContext.jsx';
import { CartContext } from '../components/context/CartContext.jsx';
import { SocketProvider } from '../components/context/SocketContext.jsx';
import RoleGuard from '../components/guards/RoleGuard.jsx';
import PublicLayout from '../components/layout/PublicLayout.jsx';
import NotFoundPage from '../components/pages/NotFoundPage.jsx';

// Staff dashboard pages
import AdminDashboardPage from '../components/pages/admin/AdminDashboardPage.jsx';
import OwnerDashboardPage from '../components/pages/owner/OwnerDashboardPage.jsx';
import CashierDashboardPage from '../components/pages/subadmin/CashierDashboardPage.jsx';
import CSDashboardPage from '../components/pages/subadmin/CSDashboardPage.jsx';
import OperationalDashboardPage from '../components/pages/subadmin/OperationalDashboardPage.jsx';
import QCDashboardPage from '../components/pages/subadmin/QCDashboardPage.jsx';
import OfflineDashboardPage from '../components/pages/offline/OfflineDashboardPage.jsx';

// Mock authService to avoid real localStorage calls
vi.mock('../services/auth.js', () => ({
  getCurrentUser: vi.fn(() => null),
  seedStaffUsers: vi.fn(),
  logout: vi.fn(),
}));

// Mock all service modules used by page components to avoid localStorage errors
vi.mock('../services/orders.js', () => ({
  listAllOrders: vi.fn(() => []),
  getOrdersByCustomer: vi.fn(() => []),
  createOrder: vi.fn(() => ({ ok: true })),
  updateOrderStatus: vi.fn(() => ({ ok: true })),
  getOrderByNumberAndPhone: vi.fn(() => null),
}));

vi.mock('../services/products.js', () => ({
  listProducts: vi.fn(() => []),
  getProductBySlug: vi.fn(() => null),
  createProduct: vi.fn(() => ({ ok: true })),
  updateProduct: vi.fn(() => ({ ok: true })),
  deleteProduct: vi.fn(() => ({ ok: true })),
}));

vi.mock('../services/categories.js', () => ({
  listCategories: vi.fn(() => []),
}));

vi.mock('../services/chatService.js', () => ({
  listConversations: vi.fn(() => []),
  getMessagesByCustomer: vi.fn(() => []),
  createOrGetConversation: vi.fn(() => ({ id: 'c1' })),
  sendMessage: vi.fn(() => ({ ok: true })),
  validateFile: vi.fn(() => ({ ok: true })),
}));

vi.mock('../services/reviews.js', () => ({
  listReviews: vi.fn(() => []),
  updateReview: vi.fn(() => ({ ok: true })),
}));

vi.mock('../services/analyticsService.js', () => ({
  getBestSellers: vi.fn(() => []),
  recordVisit: vi.fn(),
  getVisitStats: vi.fn(() => ({})),
}));

vi.mock('../services/cartService.js', () => ({
  getCart: vi.fn(() => []),
  saveCart: vi.fn(),
}));

/** All 19 defined route paths */
const DEFINED_PATHS = [
  '/',
  '/products',
  '/products/test-slug',
  '/cart',
  '/checkout',
  '/register',
  '/status',
  '/my-orders',
  '/cara-order',
  '/portfolio',
  '/tentang-kami',
  '/admin/login',
  '/admin/superadmin',
  '/admin/owner',
  '/admin/cashier',
  '/admin/cs',
  '/admin/operational',
  '/admin/qc',
  '/admin/offline',
];

/** Staff route definitions: path → { requiredRole, component } */
const STAFF_ROUTES = [
  { path: '/admin/superadmin', requiredRole: 'admin',       Component: AdminDashboardPage },
  { path: '/admin/owner', requiredRole: 'owner',       Component: OwnerDashboardPage },
  { path: '/admin/cashier', requiredRole: 'cashier',   Component: CashierDashboardPage },
  { path: '/admin/cs',    requiredRole: 'cs',          Component: CSDashboardPage },
  { path: '/admin/operational', requiredRole: 'operational', Component: OperationalDashboardPage },
  { path: '/admin/qc',    requiredRole: 'qc',          Component: QCDashboardPage },
  { path: '/admin/offline', requiredRole: 'offline',   Component: OfflineDashboardPage },
];

/**
 * Default cart context value for tests.
 */
const defaultCartValue = {
  items: [],
  addItem: vi.fn(),
  removeItem: vi.fn(),
  clearCart: vi.fn(),
};

/**
 * Render a minimal router that mirrors the App routing table.
 * Uses MemoryRouter so we can set the initial path without a real browser.
 */
function renderAppRouter(initialPath, user = null) {
  const authValue = { user, updateUser: vi.fn() };

  return render(
    <AuthContext.Provider value={authValue}>
      <CartContext.Provider value={defaultCartValue}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            {/* Public layout */}
            <Route element={<PublicLayout />}>
              <Route path="/"               element={<div data-testid="page-home">Home</div>} />
              <Route path="/products"       element={<div data-testid="page-products">Products</div>} />
              <Route path="/products/:slug" element={<div data-testid="page-catalog">Catalog</div>} />
              <Route path="/cart"           element={<div data-testid="page-cart">Cart</div>} />
              <Route path="/checkout"       element={<div data-testid="page-checkout">Checkout</div>} />
              <Route path="/register"       element={<div data-testid="page-register">Register</div>} />
              <Route path="/status"         element={<div data-testid="page-status">Status</div>} />
              <Route path="/my-orders"      element={<div data-testid="page-my-orders">My Orders</div>} />
              <Route path="/cara-order"     element={<div data-testid="page-cara-order">Cara Order</div>} />
              <Route path="/portfolio"      element={<div data-testid="page-portfolio">Portfolio</div>} />
              <Route path="/tentang-kami"   element={<div data-testid="page-tentang-kami">Tentang Kami</div>} />
            </Route>

            {/* Staff login — no shell, no guard (always reachable) */}
            <Route path="/admin/login" element={<div data-testid="page-admin-login">Admin Login</div>} />

            {/* Staff routes */}
            {STAFF_ROUTES.map(({ path, requiredRole, Component }) => (
              <Route
                key={path}
                path={path}
                element={
                  <RoleGuard requiredRole={requiredRole}>
                    <Component />
                  </RoleGuard>
                }
              />
            ))}

            {/* Catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </MemoryRouter>
      </CartContext.Provider>
    </AuthContext.Provider>
  );
}

/**
 * Render a single staff route directly (bypassing RoleGuard) to test
 * that the public shell components are absent.
 */
function renderStaffRouteDirect(path, Component, role) {
  const user = { id: 'staff-1', name: 'Staff User', role };
  const authValue = { user, updateUser: vi.fn() };

  return render(
    <AuthContext.Provider value={authValue}>
      <SocketProvider>
        <CartContext.Provider value={defaultCartValue}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route
                path={path}
                element={
                  <RoleGuard requiredRole={role}>
                    <Component />
                  </RoleGuard>
                }
              />
              <Route path="/register" element={<div>Register</div>} />
            </Routes>
          </MemoryRouter>
        </CartContext.Provider>
      </SocketProvider>
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Property 3: Unknown routes render NotFoundPage
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

describe('Property 3: Unknown routes render NotFoundPage', () => {
  /**
   * For any path string that does not match any of the 18 defined routes,
   * the router SHALL render <NotFoundPage> rather than any other page component.
   *
   * Validates: Requirements 2.2
   */
  it('renders NotFoundPage for any non-matching path', () => {
    // Arbitrary path segments that will never match defined routes
    const pathSegmentArb = fc.stringMatching(/^[a-z][a-z0-9-]{2,14}$/);

    fc.assert(
      fc.property(
        // Generate a path like /random-segment or /seg1/seg2
        fc.oneof(
          pathSegmentArb.map((s) => `/${s}`),
          fc.tuple(pathSegmentArb, pathSegmentArb).map(([a, b]) => `/${a}/${b}`),
          fc.tuple(pathSegmentArb, pathSegmentArb, pathSegmentArb).map(
            ([a, b, c]) => `/${a}/${b}/${c}`
          )
        ).filter((path) => {
          // Exclude any path that matches a defined route
          // (including /products/:slug which matches /products/<anything>)
          if (DEFINED_PATHS.includes(path)) return false;
          if (path.startsWith('/products/')) return false;
          return true;
        }),
        (unknownPath) => {
          const { unmount, container } = renderAppRouter(unknownPath);

          // NotFoundPage renders "404" and "Halaman Tidak Ditemukan"
          const heading = container.querySelector('h1');
          expect(heading).not.toBeNull();
          expect(heading.textContent).toContain('Halaman Tidak Ditemukan');

          // No known page test IDs should be present
          const knownPages = [
            'page-home', 'page-products', 'page-catalog', 'page-cart',
            'page-checkout', 'page-register', 'page-status', 'page-my-orders',
            'page-cara-order', 'page-portfolio', 'page-tentang-kami',
          ];
          for (const testId of knownPages) {
            expect(container.querySelector(`[data-testid="${testId}"]`)).toBeNull();
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('renders NotFoundPage for deeply nested unknown paths', () => {
    const paths = [
      '/unknown',
      '/foo/bar',
      '/abc/def/ghi',
      '/not-a-real-page',
      '/admin-fake',
      '/products-extra',
      // Fase 6: the old /admin dashboard path is gone (no redirect) → 404
      '/admin',
    ];

    for (const path of paths) {
      const { unmount, container } = renderAppRouter(path);
      const heading = container.querySelector('h1');
      expect(heading).not.toBeNull();
      expect(heading.textContent).toContain('Halaman Tidak Ditemukan');
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// Property 10: Staff routes exclude public shell
// Validates: Requirements 6.8
// ---------------------------------------------------------------------------

describe('Property 10: Staff routes exclude public shell', () => {
  /**
   * For each of the 7 staff route paths, the rendered output SHALL NOT
   * include the public <Navbar>, <Footer>, or <ChatWidget> components.
   *
   * Identifies:
   *   - Navbar:      [data-component="navbar"]
   *   - Footer:      [data-component="footer"]
   *   - ChatWidget:  #chat-widget-root
   *
   * Validates: Requirements 6.8
   */
  it('no public shell components present on any staff route', () => {
    for (const { path, requiredRole, Component } of STAFF_ROUTES) {
      const { unmount, container } = renderStaffRouteDirect(path, Component, requiredRole);

      // Navbar must be absent
      const navbar = container.querySelector('[data-component="navbar"]');
      expect(navbar, `Navbar found on staff route ${path}`).toBeNull();

      // Footer must be absent
      const footer = container.querySelector('[data-component="footer"]');
      expect(footer, `Footer found on staff route ${path}`).toBeNull();

      // ChatWidget must be absent
      const chatWidget = container.querySelector('#chat-widget-root');
      expect(chatWidget, `ChatWidget found on staff route ${path}`).toBeNull();

      unmount();
    }
  });

  /**
   * Property-based variant: for each staff route, assert public shell is absent
   * across multiple renders (simulating different user states / re-renders).
   *
   * Validates: Requirements 6.8
   */
  it('public shell absent for all staff routes under property test', () => {
    fc.assert(
      fc.property(
        // Pick one of the 7 staff routes
        fc.constantFrom(...STAFF_ROUTES),
        ({ path, requiredRole, Component }) => {
          const { unmount, container } = renderStaffRouteDirect(path, Component, requiredRole);

          const navbar = container.querySelector('[data-component="navbar"]');
          const footer = container.querySelector('[data-component="footer"]');
          const chatWidget = container.querySelector('#chat-widget-root');

          expect(navbar).toBeNull();
          expect(footer).toBeNull();
          expect(chatWidget).toBeNull();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: /admin/* hidden from unauthenticated / wrong-role users
// Validates: Requirements 3.2, 3.3
//
// Every /admin/* section renders NotFoundPage (404) for visitors who are not
// logged in or who lack the required role. The only exception is /admin/login,
// which MUST stay reachable so staff can sign in.
// ---------------------------------------------------------------------------

describe('Property 11: Admin pages hidden from unauthenticated users', () => {
  it('shows NotFoundPage for guests on every staff route', () => {
    for (const { path } of STAFF_ROUTES) {
      const { unmount, container } = renderAppRouter(path, null);

      const heading = container.querySelector('h1');
      expect(heading, `h1 missing on ${path}`).not.toBeNull();
      expect(heading.textContent).toContain('Halaman Tidak Ditemukan');

      unmount();
    }
  });

  it('shows NotFoundPage for a wrong-role user on a staff route', () => {
    const customer = { id: 'c1', name: 'Customer', role: 'customer' };
    const { unmount, container } = renderAppRouter('/admin/owner', customer);

    const heading = container.querySelector('h1');
    expect(heading, 'h1 missing').not.toBeNull();
    expect(heading.textContent).toContain('Halaman Tidak Ditemukan');

    unmount();
  });

  it('keeps /admin/login reachable for guests (the only non-guarded admin page)', () => {
    const { unmount, container } = renderAppRouter('/admin/login', null);

    expect(container.querySelector('[data-testid="page-admin-login"]')).not.toBeNull();
    const heading = container.querySelector('h1');
    expect(
      heading ? heading.textContent.includes('Halaman Tidak Ditemukan') : false
    ).toBe(false);

    unmount();
  });
});
