/**
 * OfflineDashboardPage.jsx — Dashboard for the Offline Admin role.
 *
 * Allows staff to create orders for walk-in customers at the physical store.
 *
 * TODO: This page has NO mobile responsiveness (no hamburger, no backdrop, no sidebar toggle).
 * The sidebar is permanently visible on small screens. Consider adding mobile toggle like other dashboards.
 *
 * Flow:
 *  1. Fill in customer info (name, phone, address)
 *  2. Add order items (product name, qty, unit price — free-form)
 *  3. Submit → calls createOfflineOrder() → displays printable receipt
 *  4. Order enters the normal 8-step flow starting at "Waiting for Payment"
 *  5. View list of all offline orders via the "Daftar Pesanan" nav
 *
 * Requirements: 12.1, 12.2, 13.4
 */

import { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext, getUserAuthPath } from '../../context/AuthContext.jsx';
import { logout } from '../../../services/auth.js';
import { createOfflineOrder, listAllOrders, STATUS_CONFIG } from '../../../services/orders.js';
import { STAFF_ROLE_CONFIG } from '../../../config/roles.js';
import { filterNavByPermissions } from '../../../config/permissions.js';
import { formatCurrency } from '../../../utils/format.js';
import { track, flush as flushActivity } from '../../../utils/activityTracker.js';
import { showToast } from '../../../core/toastEmitter.js';
import ChatsSection from '../admin/sections/ChatsSection.jsx';
import DMSection from '../admin/sections/DMSection.jsx';
import StaffAvatarButton from '../../staff/StaffAvatarButton.jsx';
import AdminDashboardButton from '../../staff/AdminDashboardButton.jsx';
import logoImg from '../../../assets/logo.png';
import '../../../styles/css/pages/dashboard.css';

/* ── Constants ───────────────────────────────────────────── */
const ROLE_COLOR = '#be185d';
const ROLE_DESC  = 'Input pesanan dari customer yang datang langsung ke toko.';

/* ── Empty item factory ──────────────────────────────────── */
function makeItem() {
  return { id: crypto.randomUUID(), name: '', qty: 1, price: '' };
}

/* ── Receipt component ───────────────────────────────────── */
function Receipt({ order, onNewOrder }) {
  return (
    <div className="offline-receipt">
      <div className="offline-receipt-card">
        {/* Header */}
        <div className="offline-receipt-header">
          <div className="offline-receipt-logo">🖨️ Gala Printing Bali</div>
          <div className="offline-receipt-title">BUKTI PESANAN OFFLINE</div>
          <div className="offline-receipt-date">
            {new Date(order.createdAt).toLocaleString('id-ID', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        </div>

        {/* Customer info */}
        <div className="offline-receipt-body">
          <div className="offline-receipt-row">
            <span className="offline-receipt-key">No. Transaksi</span>
            <strong className="offline-receipt-txn">{order.orderNumber}</strong>
          </div>
          <div className="offline-receipt-row">
            <span className="offline-receipt-key">Customer</span>
            <span>{order.customer?.name || '—'}</span>
          </div>
          <div className="offline-receipt-row">
            <span className="offline-receipt-key">Telepon</span>
            <span>{order.customer?.phone || '—'}</span>
          </div>
          {order.customer?.address && (
            <div className="offline-receipt-row">
              <span className="offline-receipt-key">Alamat</span>
              <span>{order.customer.address}</span>
            </div>
          )}
        </div>

        {/* Items table */}
        <table className="offline-receipt-table">
          <thead>
            <tr>
              <th>Produk / Layanan</th>
              <th style={{ textAlign: 'center' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Harga</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, paddingTop: 10 }}>TOTAL</td>
              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 16, paddingTop: 10 }}>
                {formatCurrency(order.subtotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Admin note */}
        {order.adminNote && (
          <div className="offline-receipt-note">
            <span>📝 Catatan:</span> {order.adminNote}
          </div>
        )}

        {/* Footer */}
        <div className="offline-receipt-footer">
          <p>Simpan nomor transaksi untuk referensi pesanan Anda.</p>
        </div>

        {/* Actions */}
        <div className="offline-receipt-actions">
          <button
            className="adm-btn adm-btn--primary"
            type="button"
            onClick={onNewOrder}
          >
            ➕ Buat Pesanan Baru
          </button>
          <button
            className="adm-btn"
            type="button"
            onClick={() => window.print()}
          >
            🖨️ Print
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── New Order Form ──────────────────────────────────────── */
function NewOrderPanel({ onOrderCreated }) {
  const [customerName,    setCustomerName]    = useState('');
  const [customerPhone,   setCustomerPhone]   = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [adminNote,       setAdminNote]       = useState('');
  const [items,           setItems]           = useState([makeItem()]);
  const [formError,       setFormError]       = useState('');

  /* ── Item helpers ──────────────────────────────────────── */
  function addItem() {
    setItems((prev) => [...prev, makeItem()]);
  }

  function removeItem(id) {
    if (items.length <= 1) {
      showToast('Minimal 1 item diperlukan.', 'error');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  /* ── Derived total ─────────────────────────────────────── */
  const total = items.reduce((sum, i) => {
    const qty   = Math.max(1, parseInt(i.qty, 10) || 1);
    const price = Math.max(0, parseFloat(i.price) || 0);
    return sum + qty * price;
  }, 0);

  /* ── Submit ────────────────────────────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const name    = customerName.trim();
    const phone   = customerPhone.trim();
    const address = customerAddress.trim();
    const note    = adminNote.trim();

    if (!name) {
      setFormError('Nama customer wajib diisi.');
      return;
    }
    if (!phone) {
      setFormError('Nomor telepon customer wajib diisi.');
      return;
    }

    // Validate and collect items
    const orderItems = [];
    for (const item of items) {
      const itemName  = item.name.trim();
      const qty       = Math.max(1, parseInt(item.qty, 10) || 1);
      const price     = Math.max(0, parseFloat(item.price) || 0);

      if (!itemName) {
        setFormError('Nama produk tidak boleh kosong.');
        return;
      }
      if (price <= 0) {
        setFormError(`Harga untuk "${itemName}" harus lebih dari 0.`);
        return;
      }

      orderItems.push({
        id:             crypto.randomUUID(),
        productId:      null,
        name:           itemName,
        price,
        quantity:       qty,
        designFileName: null,
      });
    }

    if (!orderItems.length) {
      setFormError('Tambahkan minimal 1 item pesanan.');
      return;
    }

    const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

    try {
      const order = await createOfflineOrder({
        customer: { name, phone, address },
        items:    orderItems,
        subtotal,
        adminNote: note,
      });

      showToast(`Pesanan ${order.orderNumber} berhasil dibuat!`, 'success');
      onOrderCreated({ ...order, adminNote: note });
    } catch (err) {
      setFormError('Gagal membuat pesanan. Silakan coba lagi.');
      console.error(err);
    }
  }

  return (
    <div className="adm-card offline-order-card">
      <div className="adm-toolbar" style={{ marginBottom: 20 }}>
        <h2 className="adm-section-title">➕ Buat Pesanan Offline</h2>
        <span className="adm-date">Nomor transaksi akan dibuat otomatis</span>
      </div>

      <form id="offline-order-form" onSubmit={handleSubmit} noValidate>
        {/* Customer Info */}
        <div className="offline-section-label">Data Customer</div>
        <div className="offline-customer-grid">
          <div className="adm-field">
            <label className="adm-label" htmlFor="off-name">
              Nama Customer <span className="offline-required">*</span>
            </label>
            <input
              className="adm-input"
              id="off-name"
              type="text"
              placeholder="Nama lengkap customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="off-phone">
              Nomor Telepon <span className="offline-required">*</span>
            </label>
            <input
              className="adm-input"
              id="off-phone"
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
            />
          </div>
          <div className="adm-field offline-address-field">
            <label className="adm-label" htmlFor="off-address">
              Alamat Pengiriman
            </label>
            <input
              className="adm-input"
              id="off-address"
              type="text"
              placeholder="Alamat lengkap (opsional)"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
            />
          </div>
        </div>

        {/* Order Items */}
        <div className="offline-section-label" style={{ marginTop: 24 }}>
          Item Pesanan
          <button
            className="adm-btn adm-btn--primary offline-add-item-btn"
            type="button"
            onClick={addItem}
            style={{ marginLeft: 12, fontSize: 12, padding: '5px 12px' }}
          >
            + Tambah Item
          </button>
        </div>

        <div className="adm-table-wrap" style={{ marginTop: 10 }}>
          <table className="adm-table" id="offline-items-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Nama Produk / Layanan</th>
                <th style={{ width: 80 }}>Qty</th>
                <th style={{ width: 150 }}>Harga Satuan (Rp)</th>
                <th style={{ width: 120 }}>Subtotal</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const qty      = Math.max(1, parseInt(item.qty, 10) || 1);
                const price    = Math.max(0, parseFloat(item.price) || 0);
                const subtotal = qty * price;
                return (
                  <tr key={item.id} className="offline-item-row">
                    <td>
                      <input
                        className="adm-input offline-item-name"
                        type="text"
                        placeholder="Nama produk / layanan…"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        className="adm-input offline-item-qty"
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                        style={{ width: 70 }}
                      />
                    </td>
                    <td>
                      <input
                        className="adm-input offline-item-price"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={item.price}
                        onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                        style={{ width: 130 }}
                      />
                    </td>
                    <td className="offline-item-subtotal adm-date">
                      {formatCurrency(subtotal)}
                    </td>
                    <td>
                      <button
                        className="adm-btn adm-btn--delete offline-remove-item"
                        type="button"
                        title="Hapus baris"
                        onClick={() => removeItem(item.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="offline-total-row">
          <span className="offline-total-label">Total Pesanan</span>
          <span className="offline-total-value" id="offline-total">
            {formatCurrency(total)}
          </span>
        </div>

        {/* Admin note */}
        <div className="adm-field" style={{ marginTop: 16 }}>
          <label className="adm-label" htmlFor="off-note">
            Catatan Admin (opsional)
          </label>
          <input
            className="adm-input"
            id="off-note"
            type="text"
            placeholder="Catatan khusus untuk pesanan ini…"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
        </div>

        {/* Error */}
        {formError && (
          <div className="offline-form-error" id="offline-form-error">
            {formError}
          </div>
        )}

        {/* Actions */}
        <div className="offline-form-actions">
          <button
            className="adm-btn adm-btn--primary offline-submit-btn"
            type="submit"
            id="offline-submit"
          >
            🧾 Buat Pesanan &amp; Cetak Nomor Transaksi
          </button>
          <button
            className="adm-btn offline-reset-btn"
            type="button"
            id="offline-reset"
            onClick={() => {
              setCustomerName('');
              setCustomerPhone('');
              setCustomerAddress('');
              setAdminNote('');
              setItems([makeItem()]);
              setFormError('');
            }}
          >
            Reset Form
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Order List Panel ────────────────────────────────────── */
function OrderListPanel() {
  const [orders,      setOrders]      = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error,       setError]       = useState('');

  const loadOrders = useCallback(async () => {
    try {
      const all = await listAllOrders();
      setOrders((Array.isArray(all) ? all : []).filter((o) => o.source === 'offline'));
    } catch (err) {
      setError('Gagal memuat daftar pesanan.');
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadOrders();

    function handleOrdersUpdated() { loadOrders(); }
    window.addEventListener('gala:orders-updated', handleOrdersUpdated);
    return () => window.removeEventListener('gala:orders-updated', handleOrdersUpdated);
  }, [loadOrders]);

  const q = searchQuery.toLowerCase();
  const filtered = q
    ? orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          (o.customer?.name  || '').toLowerCase().includes(q) ||
          (o.customer?.phone || '').includes(q)
      )
    : orders;

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">📋 Pesanan Offline ({filtered.length})</h2>
        <div className="adm-toolbar-right">
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Cari no. transaksi / nama…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Cari pesanan"
          />
        </div>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>No. Transaksi</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="adm-empty">Belum ada pesanan offline.</td>
              </tr>
            ) : (
              filtered.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };
                return (
                  <tr key={order.id}>
                    <td>
                      <code>{order.orderNumber}</code>
                      <div className="adm-date">
                        {new Date(order.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td>
                      <div>{order.customer?.name || '—'}</div>
                      <div className="adm-date">{order.customer?.phone || ''}</div>
                    </td>
                    <td>{formatCurrency(order.subtotal)}</td>
                    <td>
                      <span className={`order-status-badge ${cfg.badge}`}>
                        {cfg.icon} {order.status}
                      </span>
                    </td>
                    <td className="adm-date">{(order.items || []).length} item</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function OfflineDashboardPage() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [activeNav,     setActiveNav]     = useState('new-order');
  const [createdOrder,  setCreatedOrder]  = useState(null);   // receipt state

  const roleInfo = STAFF_ROLE_CONFIG[user?.role] ?? { label: 'Offline Admin', color: ROLE_COLOR };
  const userName = user?.name || roleInfo.label;

  const offlineNavItems = [
    { id: 'new-order',   label: '➕ Buat Pesanan Baru' },
    { id: 'order-list',  label: '📋 Daftar Pesanan'    },
    { id: 'chat',        label: '💬 Chat Customer'     },
    { id: 'dm',          label: '📨 Pesan Staff'       },
  ];
  const filteredNav = filterNavByPermissions(offlineNavItems, user?.permissions);
  const effectiveActive = filteredNav.some((n) => n.id === activeNav) ? activeNav : (filteredNav[0]?.id ?? 'new-order');

  async function handleLogout() {
    track('Logout', { pagePath: window.location.pathname, targetType: 'account', targetId: user?.id ?? null });
    flushActivity();
    await Promise.resolve(logout());
    updateUser(null);
    navigate(getUserAuthPath(user));
  }

  function handleNavClick(navId) {
    setActiveNav(navId);
    setCreatedOrder(null);   // clear receipt when switching sections
  }

  function handleOrderCreated(order) {
    setCreatedOrder(order);
  }

  function handleNewOrder() {
    setCreatedOrder(null);
  }

  return (
    <div className="staff-body">
      <div className="staff-layout">
        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside
          className="staff-sidebar"
          aria-label="Offline Admin navigation"
          style={{ background: roleInfo.color }}
        >
          <div className="staff-sidebar-logo">
            <img
              src={logoImg}
              alt="Gala Printing"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          <div className="subadmin-role-badge">{roleInfo.label}</div>
          <div className="subadmin-role-desc">{ROLE_DESC}</div>

          <nav className="staff-nav" style={{ marginTop: 24 }}>
            {filteredNav.map((item) => (
              <button
                key={item.id}
                className={`staff-nav-item${effectiveActive === item.id ? ' active' : ''}`}
                type="button"
                onClick={() => handleNavClick(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Main content ─────────────────────────────────── */}
        <div className="staff-main">
          {/* Header */}
          <header className="staff-header">
            <div className="staff-header-left">
              <span className="staff-header-name" style={{ fontSize: 16 }}>
                Offline Admin Dashboard
              </span>
            </div>
            <div className="staff-header-right">
              <AdminDashboardButton
                onClick={() => setActiveNav('new-order')}
              />
              <StaffAvatarButton />
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

          {/* Body */}
          <div className="staff-body-row staff-body-row--full">
            <div className="staff-content">
              {filteredNav.length === 0 ? (
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
                <div id="offline-panel" className="offline-panel-wrap">
                  {effectiveActive === 'new-order' && (
                    createdOrder
                      ? <Receipt order={createdOrder} onNewOrder={handleNewOrder} />
                      : <NewOrderPanel onOrderCreated={handleOrderCreated} />
                  )}
                  {effectiveActive === 'order-list' && <OrderListPanel />}
                  {effectiveActive === 'chat' && <ChatsSection />}
                  {effectiveActive === 'dm' && <DMSection />}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
