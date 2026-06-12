/**
 * SubAdminLayout.jsx — Shared sidebar shell and section-switching layout for
 * sub-admin roles: cashier | cs | operational | qc
 * Requirements: 11.2
 */

import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { logout } from '../../../services/authService.js';
import { STAFF_ROLES } from '../../../core/config.js';
import logoImg from '../../../assets/logo.png';
import '../../../styles/css/pages/dashboard.css';

const ROLE_DESCRIPTIONS = {
  cashier:     'Verifikasi pembayaran dan konfirmasi pesanan masuk.',
  cs:          'Konsultasi desain dengan customer dan konfirmasi persetujuan desain.',
  operational: 'Proses produksi — cetak, finishing, dan persiapan produk.',
  qc:          'Quality check, pengemasan, dan pengiriman ke kurir.',
};

export default function SubAdminLayout({ navItems, sections, title }) {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const defaultNav = navItems?.[0]?.id ?? 'orders';
  const [activeNav, setActiveNav]     = useState(defaultNav);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role      = user?.role ?? '';
  const roleInfo  = STAFF_ROLES[role] ?? { label: role, color: '#785E40' };
  const userName  = user?.name || roleInfo.label || role;
  const roleDesc  = ROLE_DESCRIPTIONS[role] ?? '';
  const sidebarBg = roleInfo.color ?? '#785E40';

  function handleNavClick(navId) {
    setActiveNav(navId);
    setSidebarOpen(false);
  }

  async function handleLogout() {
    await Promise.resolve(logout());
    updateUser(null);
    navigate('/register');
  }

  const activeSection  = sections?.[activeNav] ?? null;
  const currentLabel   = navItems?.find((n) => n.id === activeNav)?.label ?? title ?? '';

  return (
    <div className="staff-body">
      <div className="staff-layout">

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div className="staff-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}

        {/* Sidebar */}
        <aside
          className={`staff-sidebar${sidebarOpen ? ' staff-sidebar--open' : ''}`}
          aria-label={`${roleInfo.label} navigation`}
          style={{ background: sidebarBg }}
        >
          <button className="staff-sidebar-close" type="button" aria-label="Tutup menu" onClick={() => setSidebarOpen(false)}>✕</button>

          <div className="staff-sidebar-logo">
            <img src={logoImg} alt="Gala Printing" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>

          <div className="subadmin-role-badge">{roleInfo.label}</div>
          {roleDesc && <div className="subadmin-role-desc">{roleDesc}</div>}

          <nav className="staff-nav" style={{ marginTop: '24px' }}>
            {(navItems ?? []).map((item) => (
              <button
                key={item.id}
                className={`staff-nav-item${activeNav === item.id ? ' active' : ''}`}
                type="button"
                onClick={() => handleNavClick(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="staff-main">
          <header className="staff-header">
            {/* Hamburger — visible on mobile only */}
            <button
              className="staff-hamburger"
              type="button"
              aria-label="Buka menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <span /><span /><span />
            </button>

            <div className="staff-header-section-label">{currentLabel}</div>

            <div className="staff-header-right">
              <div className="staff-header-avatar">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"
                  fill="none" viewBox="0 0 24 24" stroke="#666" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div className="staff-header-auth">
                <span className="staff-header-name">{userName}</span>
                <button className="staff-logout-btn" type="button" onClick={handleLogout}>Keluar</button>
              </div>
            </div>
          </header>

          <div className="staff-body-row staff-body-row--full">
            <div className="staff-content">
              <div id="subadmin-panel" className="subadmin-panel-wrap">
                {activeSection}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
