import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, AuthNavigationHandler } from './components/context/AuthContext.jsx';
import { CartProvider } from './components/context/CartContext.jsx';
import { CartContext } from './components/context/CartContext.jsx';
import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PublicLayout from './components/layout/PublicLayout.jsx';
import RoleGuard from './components/guards/RoleGuard.jsx';
import Toast from './components/shared/Toast.jsx';
// NOTE: `seedStaffUsers` seeding is disabled — staff accounts come from the backend.

// Public pages
import HomePage from './components/pages/public/HomePage.jsx';
import ProductsPage from './components/pages/public/ProductsPage.jsx';
import CatalogProductPage from './components/pages/public/CatalogProductPage.jsx';
import CartPage from './components/pages/public/CartPage.jsx';
import CheckoutPage from './components/pages/public/CheckoutPage.jsx';
import RegisterPage from './components/pages/public/RegisterPage.jsx';
import StatusOrderPage from './components/pages/public/StatusOrderPage.jsx';
import MyOrdersPage from './components/pages/public/MyOrdersPage.jsx';
import CaraOrderPage from './components/pages/public/CaraOrderPage.jsx';
import PortfolioPage from './components/pages/public/PortfolioPage.jsx';
import TentangKamiPage from './components/pages/public/TentangKamiPage.jsx';
import ProfilePage from './components/pages/public/ProfilePage.jsx';
import VerifyEmailPage from './components/pages/public/VerifyEmailPage.jsx';
import ForgotPasswordPage from './components/pages/public/ForgotPasswordPage.jsx';
import ResetPasswordPage from './components/pages/public/ResetPasswordPage.jsx';

// Staff pages
import AdminDashboardPage from './components/pages/admin/AdminDashboardPage.jsx';
import OwnerDashboardPage from './components/pages/owner/OwnerDashboardPage.jsx';
import CashierDashboardPage from './components/pages/subadmin/CashierDashboardPage.jsx';
import CSDashboardPage from './components/pages/subadmin/CSDashboardPage.jsx';
import OperationalDashboardPage from './components/pages/subadmin/OperationalDashboardPage.jsx';
import QCDashboardPage from './components/pages/subadmin/QCDashboardPage.jsx';
import OfflineDashboardPage from './components/pages/offline/OfflineDashboardPage.jsx';

// 404
import NotFoundPage from './components/pages/NotFoundPage.jsx';

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
      <CartProvider>
        <CartWarningBanner />
        <Toast />
        <BrowserRouter>
          <AuthNavigationHandler />
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
              <Route path="/portfolio"      element={<PortfolioPage />} />
              <Route path="/tentang-kami"   element={<TentangKamiPage />} />
              <Route path="/profile"        element={<ProfilePage />} />
              <Route path="/verify-email"   element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password"  element={<ResetPasswordPage />} />
            </Route>

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
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
