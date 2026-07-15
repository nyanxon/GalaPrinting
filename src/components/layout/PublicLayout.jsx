import { Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Navbar from '../shared/Navbar.jsx';
import Footer from '../shared/Footer.jsx';
import EmailVerificationBanner from '../shared/EmailVerificationBanner.jsx';

const ChatWidget = lazy(() => import('../shared/ChatWidget.jsx'));

/**
 * PublicLayout component
 *
 * Layout route wrapper for all public and customer pages.
 * Renders Navbar at the top, the matched child route via Outlet,
 * Footer at the bottom, and the floating ChatWidget.
 *
 * Requirements: 6.1, 6.2, 6.3
 */
function PublicLayout() {
  return (
    <>
      <Navbar />
      <EmailVerificationBanner />
      <Outlet />
      <Footer />
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </>
  );
}

export default PublicLayout;
