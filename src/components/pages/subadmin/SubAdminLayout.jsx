/**
 * SubAdminLayout.jsx — Shared sidebar shell and section-switching layout for
 * sub-admin roles: cashier | cs | operational | qc
 *
 * Fitur 4: Sound notifikasi (order:new & order:status_changed) dengan toggle mute.
 *
 * Requirements: 11.2
 */

import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext, getUserAuthPath } from '../../context/AuthContext.jsx';
import { logout } from '../../../services/auth.js';
import { STAFF_ROLE_CONFIG } from '../../../config/roles.js';
import { BRAND_COLOR } from '../../../config/brand.js';
import { filterNavByPermissions } from '../../../config/permissions.js';
import { getSocket } from '../../../core/socket.js';
import { useAdminSound } from '../../../hooks/useAdminSound.js';
import { track, flush as flushActivity } from '../../../utils/activityTracker.js';
import SidebarShell from '../../staff/SidebarShell.jsx';
import '../../../styles/css/pages/dashboard.css';

export default function SubAdminLayout({ navItems, sections, title }) {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const defaultNav = navItems?.[0]?.id ?? 'orders';
  const [activeNav, setActiveNav]     = useState(defaultNav);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role      = user?.role ?? '';
  const roleInfo  = STAFF_ROLE_CONFIG[role] ?? { label: role, color: BRAND_COLOR };
  const userName  = user?.name || roleInfo.label || role;
  const sidebarBg = roleInfo.color ?? BRAND_COLOR;

  // Fitur 4: sound notifikasi
  const socket = getSocket();
  const { muted, toggleMute, unlockAudio } = useAdminSound(socket);

  // Unlock audio setelah mount (user sudah login = ada interaksi sebelumnya)
  useEffect(() => {
    const t = setTimeout(() => { unlockAudio(); }, 300);
    return () => clearTimeout(t);
  }, [unlockAudio]);

  function handleNavClick(navId) {
    setActiveNav(navId);
    setSidebarOpen(false);
  }

  async function handleLogout() {
    track('Logout', { pagePath: window.location.pathname, targetType: 'account', targetId: user?.id ?? null });
    flushActivity();
    await Promise.resolve(logout());
    updateUser(null);
    navigate(getUserAuthPath(user));
  }

  // If the currently active nav is no longer visible after filtering, fall back to first visible item
  const filteredNav = filterNavByPermissions(navItems ?? [], user?.permissions);
  const effectiveActive = filteredNav.some((n) => n.id === activeNav) ? activeNav : (filteredNav[0]?.id ?? 'orders');
  const activeSection  = sections?.[effectiveActive] ?? null;
  const currentLabel   = filteredNav?.find((n) => n.id === effectiveActive)?.label ?? title ?? '';

  return (
    <SidebarShell
      navItems={filteredNav}
      activeNav={effectiveActive}
      onNavClick={handleNavClick}
      currentLabel={currentLabel}
      userName={userName}
      onLogout={handleLogout}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={setSidebarOpen}
      ariaLabel={`${roleInfo.label} navigation`}
      sidebarStyle={{ background: sidebarBg }}
      navStyle={{ marginTop: '8px' }}
      preNavSlot={
        <div className="subadmin-role-badge" style={{ marginBottom: '8px' }}>{roleInfo.label}</div>
      }
      headerSlot={
        <button
          className="staff-sound-btn"
          type="button"
          onClick={() => { toggleMute(); unlockAudio(); }}
          title={muted ? 'Aktifkan suara notifikasi' : 'Matikan suara notifikasi'}
          aria-label={muted ? 'Aktifkan suara' : 'Matikan suara'}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            color: '#fff',
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
          }}
        >
          {muted ? '🔇' : '🔔'}
        </button>
      }
    >
      <div className="staff-body-row staff-body-row--full">
        <div className="staff-content">
          <div id="subadmin-panel" className="subadmin-panel-wrap">
            {activeSection}
          </div>
        </div>
      </div>
    </SidebarShell>
  );
}
