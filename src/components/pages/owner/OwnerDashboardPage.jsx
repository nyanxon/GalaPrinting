/**
 * OwnerDashboardPage.jsx — Owner dashboard with sidebar shell and section switching.
 * Includes all Admin sections plus Revenue, Reports, and Analytics.
 * Requirements: 10.1, 10.2, 10.3, 13.4
 */

import { useState, useContext, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext.jsx';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { logout } from '../../../services/auth.js';
import { listAllOrders } from '../../../services/orders.js';
import { listConversations } from '../../../services/chatService.js';
import OrdersSection from '../admin/sections/OrdersSection.jsx';
import CustomersSection from '../admin/sections/CustomersSection.jsx';
import ProductsSection from '../admin/sections/ProductsSection.jsx';
import CategoriesSection from '../admin/sections/CategoriesSection.jsx';
import ReviewsSection from '../admin/sections/ReviewsSection.jsx';
import ChatsSection from '../admin/sections/ChatsSection.jsx';
import PromoSection from '../admin/sections/PromoSection.jsx';
import HomepageSection from '../admin/sections/HomepageSection.jsx';
import RevenueSection from './sections/RevenueSection.jsx';
import ReportsSection from './sections/ReportsSection.jsx';
import AnalyticsSection from './sections/AnalyticsSection.jsx';
import StaffAvatarButton from '../../staff/StaffAvatarButton.jsx';
import ExportDataCards from '../../ui/ExportDataCards.jsx';
import logoImg from '../../../assets/logo.png';
import '../../../styles/css/pages/dashboard.css';

const OWNER_NAV = [
  { id: 'dashboard',   label: 'DASHBOARD' },
  { id: 'orders',      label: 'ORDERS' },
  { id: 'customer',    label: 'CUSTOMER' },
  { id: 'products',    label: 'PRODUCT' },
  { id: 'categories',  label: 'CATEGORIES' },
  { id: 'review',      label: 'REVIEW' },
  { id: 'chats',       label: 'CHATS' },
  { id: 'promo',       label: 'PROMO' },
  { id: 'homepage',    label: 'HOMEPAGE' },
  { id: 'revenue',     label: 'REVENUE' },
  { id: 'reports',     label: 'REPORTS' },
  { id: 'analytics',   label: 'ANALYTICS' },
];

function ActivitySidebar({ onGoToOrders, onGoToChats }) {
  const socket = useSocket();
  const [recentOrders, setRecentOrders] = useState([]);
  const [unhandledChats, setUnhandledChats] = useState([]);

  async function loadActivity() {
    try {
      const orders = await listAllOrders();
      const unprocessed = (Array.isArray(orders) ? orders : [])
        .filter((o) => o.status === 'Waiting for Payment').slice(0, 3);
      setRecentOrders(unprocessed);
    } catch (err) { console.error('Failed to load activity orders:', err); }
    try {
      const convs = await listConversations();
      const unhandled = (Array.isArray(convs) ? convs : [])
        .filter((c) => (c.unreadCount ?? 0) > 0).slice(0, 4);
      setUnhandledChats(unhandled);
    } catch (err) { console.error('Failed to load activity chats:', err); }
  }

  useEffect(() => {
    loadActivity();
    function handleOrdersUpdate() { loadActivity(); }
    function handleChatUpdate()   { loadActivity(); }
    function handleStorage(e) {
      if (e.key === 'gala.orders' || e.key === 'gala.chats') loadActivity();
    }
    window.addEventListener('gala:orders-updated', handleOrdersUpdate);
    window.addEventListener('gala:chat-updated', handleChatUpdate);
    window.addEventListener('storage', handleStorage);

    // Socket real-time — socket is available from line 46 closure
    if (socket) {
      socket.on('order:new', handleOrdersUpdate);
      socket.on('order:status_changed', handleOrdersUpdate);
    }

    return () => {
      window.removeEventListener('gala:orders-updated', handleOrdersUpdate);
      window.removeEventListener('gala:chat-updated', handleChatUpdate);
      window.removeEventListener('storage', handleStorage);
      if (socket) {
        socket.off('order:new', handleOrdersUpdate);
        socket.off('order:status_changed', handleOrdersUpdate);
      }
    };
  }, [socket]);

  return (
    <aside className="staff-activity" aria-label="Activity">
      <div className="staff-activity-title">ACTIVITY</div>
      <div className="staff-activity-card">
        <div className="staff-activity-card-header">
          <div className="staff-activity-card-title">NEW ORDER</div>
          <button className="staff-activity-goto" type="button" aria-label="Lihat semua pesanan" onClick={onGoToOrders}>→</button>
        </div>
        {recentOrders.length === 0 ? (
          <p className="staff-activity-empty">Tidak ada pesanan baru.</p>
        ) : (
          recentOrders.map((o) => (
            <div key={o.id} className="staff-activity-item" style={{ cursor: 'pointer' }}
              onClick={onGoToOrders} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onGoToOrders(); }}>
              <div className="staff-activity-order-num">{o.orderNumber}</div>
              <div className="staff-activity-order-meta">{o.customer?.name || '—'} · {o.status}</div>
            </div>
          ))
        )}
      </div>
      <div className="staff-activity-card">
        <div className="staff-activity-card-header">
          <div className="staff-activity-card-title">NEW CHAT</div>
        </div>
        {unhandledChats.length === 0 ? (
          <p className="staff-activity-empty">Semua chat sudah ditangani.</p>
        ) : (
          unhandledChats.map((c) => {
            const last = c.lastMessage;
            const preview = last
              ? last.type === 'file' ? `📎 ${last.fileName || 'file'}` : last.content.slice(0, 35) + '…'
              : 'Belum ada pesan';
            return (
              <div key={c.id} className="staff-activity-item" style={{ cursor: 'pointer' }}
                onClick={onGoToChats} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onGoToChats(); }}>
                <div className="staff-activity-order-num">{c.customerName}</div>
                <div className="staff-activity-order-meta">{preview}</div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function WelcomeCard({ userName }) {
  return (
    <div className="staff-welcome-card" id="staff-welcome">
      <div className="staff-welcome-text">
        <div className="staff-welcome-title">DASHBOARD</div>
        <div className="staff-welcome-sub">Welcome back, <strong>{userName}</strong>!</div>
        <div className="staff-welcome-hint">Here&apos;s your business overview for today.</div>
      </div>
    </div>
  );
}

export default function OwnerDashboardPage() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeNav, setActiveNav]     = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userName    = user?.name || 'Owner';
  const isDashboard = activeNav === 'dashboard';

  function handleNavClick(navId) {
    setActiveNav(navId);
    setSidebarOpen(false);
  }

  async function handleLogout() {
    await Promise.resolve(logout());
    updateUser(null);
    navigate('/register');
  }

  function goToOrders() { setActiveNav('orders'); }
  function goToChats()  { setActiveNav('chats'); }

  function renderSection() {
    switch (activeNav) {
      case 'orders':      return <OrdersSection />;
      case 'customer':    return <CustomersSection />;
      case 'products':    return <ProductsSection />;
      case 'categories':  return <CategoriesSection />;
      case 'review':      return <ReviewsSection />;
      case 'chats':       return <ChatsSection />;
      case 'promo':       return <PromoSection />;
      case 'homepage':    return <HomepageSection />;
      case 'revenue':     return <RevenueSection />;
      case 'reports':     return <ReportsSection />;
      case 'analytics':   return <AnalyticsSection />;
      default:            return null;
    }
  }

  const currentNavLabel = OWNER_NAV.find((n) => n.id === activeNav)?.label ?? 'DASHBOARD';

  return (
    <div className="staff-body">
      <div className="staff-layout">

        {sidebarOpen && (
          <div className="staff-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}

        <aside
          className={`staff-sidebar staff-sidebar--owner${sidebarOpen ? ' staff-sidebar--open' : ''}`}
          aria-label="Owner navigation"
        >
          <button className="staff-sidebar-close" type="button" aria-label="Tutup menu" onClick={() => setSidebarOpen(false)}>✕</button>
          <div className="staff-sidebar-logo">
            <img src={logoImg} alt="Gala Printing" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <nav className="staff-nav">
            {OWNER_NAV.map((item) => (
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

        <div className="staff-main">
          <header className="staff-header">
            <button className="staff-hamburger" type="button" aria-label="Buka menu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>
              <span /><span /><span />
            </button>

            <div className="staff-header-section-label">{currentNavLabel}</div>

            <div className="staff-header-right">
              <StaffAvatarButton />
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

          <div className={`staff-body-row${isDashboard ? '' : ' staff-body-row--full'}`}>
            <div className="staff-content">
              {isDashboard && (
                <>
                  <WelcomeCard userName={userName} />
                  <ExportDataCards />
                </>
              )}
              <div id="adm-panel">{renderSection()}</div>
            </div>
            {isDashboard && (
              <ActivitySidebar onGoToOrders={goToOrders} onGoToChats={goToChats} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
