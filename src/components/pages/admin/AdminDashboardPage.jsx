/**
 * AdminDashboardPage.jsx — Super Admin dashboard with sidebar shell and section switching.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 13.4, 16.4
 */

import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext.jsx';
import { logout } from '../../../services/auth.js';
import { listAllOrders } from '../../../services/orders.js';
import { listConversations } from '../../../services/chatService.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { useAdminSound } from '../../../hooks/useAdminSound.js';
import { filterNavByPermissions } from '../../../config/permissions.js';
import OrdersSection from './sections/OrdersSection.jsx';
import CustomersSection from './sections/CustomersSection.jsx';
import ProductsSection from './sections/ProductsSection.jsx';
import ReviewsSection from './sections/ReviewsSection.jsx';
import ChatsSection from './sections/ChatsSection.jsx';
import DMSection from './sections/DMSection.jsx';
import PromoSection from './sections/PromoSection.jsx';
import HomepageSection from './sections/HomepageSection.jsx';
import CategoriesSection from './sections/CategoriesSection.jsx';
import InvoiceSection from './sections/InvoiceSection.jsx';
import ExportDataCards from '../../ui/ExportDataCards.jsx';
import SidebarShell from '../../staff/SidebarShell.jsx';
import '../../../styles/css/pages/dashboard.css';

const ADMIN_NAV = [
  { id: 'dashboard',   label: 'DASHBOARD' },
  { id: 'orders',      label: 'ORDERS' },
  { id: 'invoices',    label: 'INVOICES' },
  { id: 'customer',    label: 'CUSTOMER' },
  { id: 'products',    label: 'PRODUCT' },
  { id: 'categories',  label: 'CATEGORIES' },
  { id: 'review',      label: 'REVIEW' },
  { id: 'chats',       label: 'CHATS' },
  { id: 'dm',          label: 'DM' },
  { id: 'promo',       label: 'PROMO' },
  { id: 'homepage',    label: 'HOMEPAGE' },
];

function ActivitySidebar({ onGoToOrders, onGoToChats }) {
  const socket = useSocket();
  const [recentOrders, setRecentOrders]     = useState([]);
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
        .filter((c) => {
          // Show chat if: unread count > 0 OR last message was from customer (needsReply)
          const hasUnread = (c.unreadCount ?? 0) > 0;
          const needsReply = c.needsReply === true;
          const lastMsgFromCustomer = c.lastMessage?.senderRole === 'customer';
          return hasUnread || needsReply || lastMsgFromCustomer;
        })
        .slice(0, 4);
      setUnhandledChats(unhandled);
    } catch (err) {
      console.error('Failed to load activity chats:', err);
    }
  }

  useEffect(() => {
    loadActivity();

    // Custom window events
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

  // useEffect terpisah untuk socket listener saja
  useEffect(() => {
    if (!socket) return;
    function handleOrdersUpdate() { loadActivity(); }
    socket.on('order:new', handleOrdersUpdate);
    socket.on('order:status_changed', handleOrdersUpdate);
    return () => {
      socket.off('order:new', handleOrdersUpdate);
      socket.off('order:status_changed', handleOrdersUpdate);
    };
  }, [socket, loadActivity]);

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
          <button className="staff-activity-goto" type="button" aria-label="Lihat semua chat" onClick={onGoToChats}>→</button>
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
        <div className="staff-welcome-hint">Are you ready to get back to our customer? Let&apos;s start the day!</div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeNav, setActiveNav]       = useState('dashboard');
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  const userName    = user?.name || 'Admin';

  // Fitur 5: suara notifikasi
  const socket = useSocket();
  const { muted, toggleMute, unlockAudio } = useAdminSound(socket);

  const filteredNav = filterNavByPermissions(ADMIN_NAV, user?.permissions);
  const effectiveActive = filteredNav.some((n) => n.id === activeNav) ? activeNav : (filteredNav[0]?.id ?? 'dashboard');
  const isDashboard = effectiveActive === 'dashboard';

  // Unlock audio on first mount (kalau sudah ada interaksi)
  useEffect(() => {
    // Unlock saat komponen mount — user sudah login jadi sudah ada interaksi
    const timer = setTimeout(() => { unlockAudio(); }, 300);
    return () => clearTimeout(timer);
  }, [unlockAudio]);

  function handleNavClick(navId) {
    setActiveNav(navId);
    setSidebarOpen(false); // close drawer on mobile after selection
  }

  async function handleLogout() {
    await Promise.resolve(logout());
    updateUser(null);
    navigate('/register');
  }

  function goToOrders() { setActiveNav('orders'); }
  function goToChats()  { setActiveNav('chats'); }

  function renderSection() {
    switch (effectiveActive) {
      case 'orders':      return <OrdersSection />;
      case 'invoices':    return <InvoiceSection />;
      case 'customer':    return <CustomersSection />;
      case 'products':    return <ProductsSection />;
      case 'categories':  return <CategoriesSection />;
      case 'review':      return <ReviewsSection />;
      case 'chats':       return <ChatsSection />;
      case 'dm':          return <DMSection />;
      case 'promo':       return <PromoSection />;
      case 'homepage':    return <HomepageSection />;
      default:            return null;
    }
  }

  const currentNavLabel = filteredNav.find((n) => n.id === effectiveActive)?.label ?? 'DASHBOARD';

  return (
    <SidebarShell
      navItems={filteredNav}
      activeNav={effectiveActive}
      onNavClick={handleNavClick}
      currentLabel={currentNavLabel}
      userName={userName}
      onLogout={handleLogout}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={setSidebarOpen}
      ariaLabel="Admin navigation"
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
    </SidebarShell>
  );
}
