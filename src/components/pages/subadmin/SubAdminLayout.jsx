/**
 * SubAdminLayout.jsx — Shared sidebar shell and section-switching layout for
 * sub-admin roles: cashier | cs | operational | qc
 *
 * Fitur 4: Sound notifikasi (order:new & order:status_changed) dengan toggle mute.
 *
 * Requirements: 11.2
 */

import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { logout } from '../../../services/authService.js';
import { STAFF_ROLES } from '../../../core/config.js';
import { getSocket } from '../../../core/socket.js';
import { useAdminSound } from '../../../hooks/useAdminSound.js';
import StaffAvatarButton from '../../shared/StaffAvatarButton.jsx';
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

          <div className="subadmin-role-badge" style={{ marginBottom: '8px' }}>{roleInfo.label}</div>

          <nav className="staff-nav" style={{ marginTop: '8px' }}>
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
              <StaffAvatarButton />
              {/* Fitur 4: toggle mute/unmute sound notifikasi */}
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
              <div className="staff-header-auth">
                <span className="staff-header-name">{userName}</span>
                <button
                  className="staff-homepage-btn"
                  type="button"
                  onClick={() => navigate('/')}
                  title="Buka Homepage"
                >
                  Homepage
                </button>
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
