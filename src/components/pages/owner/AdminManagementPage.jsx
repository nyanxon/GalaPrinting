/**
 * AdminManagementPage.jsx — Owner-only page for the dynamic permission system
 * (Step 5). Two views:
 *   - /owner/admin-management            → list of promotable accounts
 *   - /owner/admin-management/:userId    → feature permission editor
 *
 * Route-guarded by RoleGuard(owner) in App.jsx; the backend endpoints are
 * owner-only too. Nothing in this page touches other role dashboards.
 */

import { useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AuthContext } from '../../context/AuthContext.jsx';
import { logout } from '../../../services/auth.js';
import SidebarShell from '../../staff/SidebarShell.jsx';
import AdminAccountsListSection from './sections/AdminAccountsListSection.jsx';
import FeaturePermissionSection from './sections/FeaturePermissionSection.jsx';
import '../../../styles/css/pages/dashboard.css';

const NAV_ITEMS = [
  { id: 'admin',     label: 'KELOLA ADMIN' },
  { id: 'dashboard', label: 'DASHBOARD' },
];

export default function AdminManagementPage() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { userId } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isEditor = Boolean(userId);
  const userName = user?.name || 'Owner';

  function handleNavClick(navId) {
    setSidebarOpen(false);
    if (navId === 'dashboard') navigate('/owner');
    // 'admin' stays on the current admin-management view.
  }

  async function handleLogout() {
    await Promise.resolve(logout());
    updateUser(null);
    navigate('/register');
  }

  return (
    <SidebarShell
      navItems={NAV_ITEMS}
      activeNav="admin"
      onNavClick={handleNavClick}
      currentLabel={isEditor ? 'Atur Permission' : 'Kelola Admin'}
      userName={userName}
      onLogout={handleLogout}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={setSidebarOpen}
      ariaLabel="Owner admin management navigation"
      sidebarClassName="staff-sidebar--owner"
    >
      <div className="staff-body-row staff-body-row--full">
        <div className="staff-content">
          <div id="adm-panel">
            {isEditor ? (
              <FeaturePermissionSection userId={userId} />
            ) : (
              <AdminAccountsListSection />
            )}
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}
