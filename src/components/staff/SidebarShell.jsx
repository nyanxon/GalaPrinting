/**
 * SidebarShell.jsx — Extracted identical layout shared by staff dashboards.
 *
 * Handles: wrapper divs, mobile backdrop, sidebar (logo + nav items),
 * header (hamburger + section label + StaffAvatarButton + auth).
 *
 * Role-specific logic stays in each dashboard page:
 *   - Nav items (menu config)
 *   - Section rendering (switch / props / inline)
 *   - Socket handling
 *   - Sound toggle (passed as headerSlot)
 *   - Inline sidebar background color (passed as sidebarStyle)
 *   - Role badge (passed as preNavSlot)
 */

import { useNavigate } from 'react-router';
import StaffAvatarButton from '../staff/StaffAvatarButton.jsx';
import AdminDashboardButton from '../staff/AdminDashboardButton.jsx';
import logoImg from '../../assets/logo.png';

export default function SidebarShell({
  navItems = [],
  activeNav,
  onNavClick,
  currentLabel,
  userName,
  onLogout,
  sidebarOpen,
  onToggleSidebar,
  ariaLabel = 'Navigation',
  sidebarClassName = '',
  sidebarStyle,
  navStyle,
  headerSlot,
  preNavSlot,
  showHomepage = true,
  children,
}) {
  const navigate = useNavigate();
  const hasNoAccess = navItems.length === 0;

  return (
    <div className="staff-body">
      <div className="staff-layout">

        {/* ── Mobile backdrop ── */}
        {sidebarOpen && onToggleSidebar && (
          <div
            className="staff-sidebar-backdrop"
            onClick={() => onToggleSidebar(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={`staff-sidebar${sidebarOpen ? ' staff-sidebar--open' : ''}${sidebarClassName ? ` ${sidebarClassName}` : ''}`}
          aria-label={ariaLabel}
          style={sidebarStyle}
        >
          {/* Mobile: close button inside drawer */}
          <button
            className="staff-sidebar-close"
            type="button"
            aria-label="Tutup menu"
            onClick={() => onToggleSidebar?.(false)}
          >
            ✕
          </button>

          <div className="staff-sidebar-logo">
            <img
              src={logoImg}
              alt="Gala Printing"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          {preNavSlot}

          <nav className="staff-nav" style={navStyle}>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`staff-nav-item${activeNav === item.id ? ' active' : ''}`}
                type="button"
                onClick={() => onNavClick(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <div className="staff-main">
          <header className="staff-header">
            {/* Hamburger — visible on mobile only */}
            <button
              className="staff-hamburger"
              type="button"
              aria-label="Buka menu"
              aria-expanded={sidebarOpen}
              onClick={() => onToggleSidebar?.(true)}
            >
              <span /><span /><span />
            </button>

            <div className="staff-header-section-label">{currentLabel}</div>

            <div className="staff-header-right">
              <AdminDashboardButton
                onClick={() => onNavClick?.(navItems[0]?.id)}
              />
              <StaffAvatarButton />
              {headerSlot}
              <div className="staff-header-auth">
                <span className="staff-header-name">{userName}</span>
                {showHomepage && (
                  <button
                    className="staff-homepage-btn"
                    type="button"
                    onClick={() => navigate('/')}
                    title="Buka Homepage"
                  >
                    Homepage
                  </button>
                )}
                <button className="staff-logout-btn" type="button" onClick={onLogout}>
                  Keluar
                </button>
              </div>
            </div>
          </header>

          {hasNoAccess ? (
            <div className="staff-no-access">
              <div className="staff-no-access-card">
                <div className="staff-no-access-icon">🔒</div>
                <div className="staff-no-access-title">Tidak Ada Akses</div>
                <div className="staff-no-access-msg">
                  Kamu tidak memiliki akses ke menu disini, harap hubungi owner untuk memperbaiki akses menu kamu!
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>

      </div>
    </div>
  );
}
