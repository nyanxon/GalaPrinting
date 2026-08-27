import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider, AuthNavigationHandler } from './components/context/AuthContext.jsx';
import { SocketProvider } from './components/context/SocketContext.jsx';
import { CartProvider } from './components/context/CartContext.jsx';
import { CartContext } from './components/context/CartContext.jsx';
import { useContext, useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import PublicLayout from './components/layout/PublicLayout.jsx';
import RoleGuard from './components/guards/RoleGuard.jsx';
import Toast from './components/ui/Toast.jsx';
import LoadingSpinner from './components/ui/LoadingSpinner.jsx';
// NOTE: `seedStaffUsers` seeding is disabled — staff accounts come from the backend.

// Public pages — lazy loaded so only the homepage chunk loads initially
const HomePage             = lazy(() => import('./components/pages/public/HomePage.jsx'));
const ProductsPage         = lazy(() => import('./components/pages/public/ProductsPage.jsx'));
const CatalogProductPage   = lazy(() => import('./components/pages/public/CatalogProductPage.jsx'));
const CartPage             = lazy(() => import('./components/pages/public/CartPage.jsx'));
const CheckoutPage         = lazy(() => import('./components/pages/public/CheckoutPage.jsx'));
const RegisterPage         = lazy(() => import('./components/pages/public/RegisterPage.jsx'));
const StatusOrderPage      = lazy(() => import('./components/pages/public/StatusOrderPage.jsx'));
const MyOrdersPage         = lazy(() => import('./components/pages/public/MyOrdersPage.jsx'));
const CaraOrderPage        = lazy(() => import('./components/pages/public/CaraOrderPage.jsx'));
const CustomOrderPage      = lazy(() => import('./components/pages/public/CustomOrderPage.jsx'));
const PortfolioPage        = lazy(() => import('./components/pages/public/PortfolioPage.jsx'));
const TentangKamiPage      = lazy(() => import('./components/pages/public/TentangKamiPage.jsx'));
const ProfilePage          = lazy(() => import('./components/pages/public/ProfilePage.jsx'));
const VerifyEmailPage      = lazy(() => import('./components/pages/public/VerifyEmailPage.jsx'));
const ForgotPasswordPage   = lazy(() => import('./components/pages/public/ForgotPasswordPage.jsx'));
const ResetPasswordPage    = lazy(() => import('./components/pages/public/ResetPasswordPage.jsx'));
const ChangePasswordPage   = lazy(() => import('./components/pages/public/ChangePasswordPage.jsx'));

// Staff pages — lazy loaded, only fetched when navigating to /admin, /owner, etc.
const AdminDashboardPage       = lazy(() => import('./components/pages/admin/AdminDashboardPage.jsx'));
const AdminLoginPage           = lazy(() => import('./components/pages/staff/AdminLoginPage.jsx'));
const OwnerDashboardPage       = lazy(() => import('./components/pages/owner/OwnerDashboardPage.jsx'));
const AdminManagementPage      = lazy(() => import('./components/pages/owner/AdminManagementPage.jsx'));
const CashierDashboardPage     = lazy(() => import('./components/pages/subadmin/CashierDashboardPage.jsx'));
const CSDashboardPage          = lazy(() => import('./components/pages/subadmin/CSDashboardPage.jsx'));
const OperationalDashboardPage = lazy(() => import('./components/pages/subadmin/OperationalDashboardPage.jsx'));
const QCDashboardPage          = lazy(() => import('./components/pages/subadmin/QCDashboardPage.jsx'));
const OfflineDashboardPage     = lazy(() => import('./components/pages/offline/OfflineDashboardPage.jsx'));

// 404
const NotFoundPage = lazy(() => import('./components/pages/NotFoundPage.jsx'));

// Boot sequence: hydrateUser (session restore) is handled inside AuthProvider on mount.

/**
 * Dismissible warning banner for cart load failures.
 * Reads cartLoadWarning from CartContext and renders a non-blocking banner.
 */
function CartWarningBanner() {
  const { cartLoadWarning, clearCartLoadWarning } = useContext(CartContext);
  if (!cartLoadWarning) return null;
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#fff3cd',
        color: '#856404',
        borderBottom: '1px solid #ffc107',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '14px',
      }}
    >
      <span>⚠️ {cartLoadWarning}</span>
      <button
        onClick={clearCartLoadWarning}
        aria-label="Tutup peringatan"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          lineHeight: 1,
          color: '#856404',
          marginLeft: '12px',
        }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * App — root component.
 *
 * Provider tree: AuthProvider → CartProvider → BrowserRouter
 * Toast is rendered outside the router so it is accessible to all routes.
 *
 * Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4, 6.8
 */
function App() {
  const { i18n } = useTranslation();

  // SEO: Update <html lang> attribute when language changes
  useEffect(() => {
    // Map 'bal' ke kode BCP-47 yang valid untuk Bali language
    const langMap = { id: 'id', en: 'en', bal: 'ban' };
    document.documentElement.lang = langMap[i18n.language] || i18n.language;
  }, [i18n.language]);

  return (
    <AuthProvider>
      <SocketProvider>
        <CartProvider>
        <CartWarningBanner />
        <Toast />
        <BrowserRouter>
          <AuthNavigationHandler />
          <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public layout — Navbar + Footer + ChatWidget */}
            <Route element={<PublicLayout />}>
              <Route path="/"               element={<HomePage />} />
              <Route path="/products"       element={<ProductsPage />} />
              <Route path="/products/:id" element={<CatalogProductPage />} />
              <Route path="/cart"           element={<CartPage />} />
              <Route path="/checkout"       element={<CheckoutPage />} />
              <Route path="/register"       element={<RegisterPage />} />
              <Route path="/status"         element={<StatusOrderPage />} />
              <Route path="/my-orders"      element={<MyOrdersPage />} />
              <Route path="/cara-order"     element={<CaraOrderPage />} />
              <Route path="/custom-order"   element={<CustomOrderPage />} />
              <Route path="/portfolio"      element={<PortfolioPage />} />
              <Route path="/tentang-kami"   element={<TentangKamiPage />} />
              <Route path="/profile"        element={<ProfilePage />} />
              <Route path="/verify-email"   element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password"  element={<ResetPasswordPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>

            {/* Staff login — no shell, no guard */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Staff routes — no public shell, role-guarded */}
            <Route
              path="/admin"
              element={
                <RoleGuard requiredRole="admin">
                  <AdminDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/owner"
              element={
                <RoleGuard requiredRole="owner">
                  <OwnerDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/owner/admin-management"
              element={
                <RoleGuard requiredRole="owner">
                  <AdminManagementPage />
                </RoleGuard>
              }
            />
            <Route
              path="/owner/admin-management/:userId"
              element={
                <RoleGuard requiredRole="owner">
                  <AdminManagementPage />
                </RoleGuard>
              }
            />
            <Route
              path="/cashier"
              element={
                <RoleGuard requiredRole="cashier">
                  <CashierDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/cs"
              element={
                <RoleGuard requiredRole="cs">
                  <CSDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/operational"
              element={
                <RoleGuard requiredRole="operational">
                  <OperationalDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/qc"
              element={
                <RoleGuard requiredRole="qc">
                  <QCDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/offline"
              element={
                <RoleGuard requiredRole="offline">
                  <OfflineDashboardPage />
                </RoleGuard>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        </CartProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
