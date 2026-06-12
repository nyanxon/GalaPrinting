/**
 * AdminDashboardPage.jsx — Super Admin dashboard with sidebar shell and section switching.
 * Equivalent to vanilla adminView.js + adminController.js
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 13.4, 16.4
 */

import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { logout } from '../../../services/authService.js';
import { listAllOrders } from '../../../services/orderService.js';
import { listConversations } from '../../../services/chatService.js';
import OrdersSection from './sections/OrdersSection.jsx';
import CustomersSection from './sections/CustomersSection.jsx';
import ProductsSection from './sections/ProductsSection.jsx';
import ReviewsSection from './sections/ReviewsSection.jsx';
import ChatsSection from './sections/ChatsSection.jsx';
import DMSection from './sections/DMSection.jsx';
import PromoSection from './sections/PromoSection.jsx';
import MigrationExportTool from '../../admin/MigrationExportTool.jsx';
import logoImg from '../../../assets/logo.png';
import '../../../styles/css/pages/dashboard.css';

const ADMIN_NAV = [
  { id: 'dashboard', label: 'DASHBOARD' },
  { id: 'orders',    label: 'ORDERS' },
  { id: 'customer',  label: 'CUSTOMER' },
  { id: 'products',  label: 'PRODUCT' },
  { id: 'review',    label: 'REVIEW' },
  { id: 'chats',     label: 'CHATS' },
  { id: 'dm',        label: 'DM' },
  { id: 'promo',     label: 'PROMO' },
];

function ActivitySidebar({ onGoToOrders, onGoToChats }) {
  const [recentOrders, setRecentOrders] = useState([]);
  const [unhandledChats, setUnhandledChats] = useState([]);

  async function loadActivity() {
    try {
      const orders = await listAllOrders();
      const unprocessed = (Array.isArray(orders) ? orders : [])
        .filter((o) => o.status === 'Waiting for Payment')
        .slice(0, 3);
      setRecentOrders(unprocessed);
    } catch (err) {
      console.error('Failed to load activity orders:', err);
    }

    try {
      const convs = await listConversations();
      const unhandled = (Array.isArray(convs) ? convs : [])
        .filter((c) => (c.unreadCount ?? 0) > 0)
        .slice(0, 4);
      setUnhandledChats(unhandled);
    } catch (err) {
      console.error('Failed to load activity chats:', err);
    }
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
    return () => {
      window.removeEventListener('gala:orders-updated', handleOrdersUpdate);
      window.removeEventListener('gala:chat-updated', handleChatUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return (
    <aside className="staff-activity" aria-label="Activity">
      <div className="staff-activity-title">ACTIVITY</div>

      <div className="staff-activity-card">
        <div className="staff-activity-card-header">
          <div className="staff-activity-card-title">NEW ORDER</div>
          <button
            className="staff-activity-goto"
            type="button"
            aria-label="Lihat semua pesanan"
            onClick={onGoToOrders}
          >
            →
          </button>
        </div>
        {recentOrders.length === 0 ? (
          <p className="staff-activity-empty">Tidak ada pesanan baru.</p>
        ) : (
          recentOrders.map((o) => (
            <div
              key={o.id}
              className="staff-activity-item"
              style={{ cursor: 'pointer' }}
              onClick={onGoToOrders}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onGoToOrders(); }}
            >
              <div className="staff-activity-order-num">{o.orderNumber}</div>
              <div className="staff-activity-order-meta">
                {o.customer?.name || '—'} · {o.status}
              </div>
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
              ? last.type === 'file'
                ? `📎 ${last.fileName || 'file'}`
                : last.content.slice(0, 35) + '…'
              : 'Belum ada pesan';
            return (
              <div
                key={c.id}
                className="staff-activity-item"
                style={{ cursor: 'pointer' }}
                onClick={onGoToChats}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onGoToChats(); }}
              >
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
        <div className="staff-welcome-sub">
          Welcome back, <strong>{userName}</strong>!
        </div>
        <div className="staff-welcome-hint">
          Are you ready to get back to our customer? Let&apos;s start the day!
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('dashboard');

  const userName = user?.name || 'Admin';
  const isDashboard = activeNav === 'dashboard';

  function handleNavClick(navId) {
    setActiveNav(navId);
  }

  async function handleLogout() {
    await Promise.resolve(logout());
    updateUser(null);
    navigate('/register');
  }

  function goToOrders() {
    setActiveNav('orders');
  }

  function goToChats() {
    setActiveNav('chats');
  }

  function renderSection() {
    switch (activeNav) {
      case 'orders':   return <OrdersSection />;
      case 'customer': return <CustomersSection />;
      case 'products': return <ProductsSection />;
      case 'review':   return <ReviewsSection />;
      case 'chats':    return <ChatsSection />;
      case 'dm':       return <DMSection />;
      case 'promo':    return <PromoSection />;
      default:         return null;
    }
  }

  return (
    <div className="staff-body">
      <div className="staff-layout">
        {/* Sidebar */}
        <aside className="staff-sidebar" aria-label="Admin navigation">
          <div className="staff-sidebar-logo">
            <img
              src={logoImg}
              alt="Gala Printing"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <nav className="staff-nav">
            {ADMIN_NAV.map((item) => (
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
          {/* Header */}
          <header className="staff-header">
            <div className="staff-header-left" />
            <div className="staff-header-right">
              <div className="staff-header-avatar">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#666"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div className="staff-header-auth">
                <span className="staff-header-name">{userName}</span>
                <button
                  className="staff-logout-btn"
                  type="button"
                  onClick={handleLogout}
                >
                  Keluar
                </button>
              </div>
            </div>
          </header>

          {/* Body row: content + activity sidebar */}
          <div className={`staff-body-row${isDashboard ? '' : ' staff-body-row--full'}`}>
            <div className="staff-content">
              {isDashboard && (
                <>
                  <WelcomeCard userName={userName} />
                  <MigrationExportTool />
                </>
              )}

              <div id="adm-panel">
                {renderSection()}
              </div>
            </div>

            {isDashboard && (
              <ActivitySidebar
                onGoToOrders={goToOrders}
                onGoToChats={goToChats}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
