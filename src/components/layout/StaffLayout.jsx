import { Outlet } from 'react-router-dom';

/**
 * StaffLayout component
 *
 * Minimal layout shell for staff dashboard pages.
 * No Navbar, Footer, or ChatWidget — staff pages manage their own sidebar.
 * Renders the matched nested staff route via Outlet.
 *
 * Requirements: 6.8
 */
function StaffLayout() {
  return <Outlet />;
}

export default StaffLayout;
