/**
 * MyOrdersPage.jsx
 *
 * Customer order history; pay button for pending orders triggers PaymentModal.
 * Review is done via the "Lacak Pesanan" link → StatusOrderPage.
 * Requirements: 7.8, 13.4
 */

import { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import PaymentModal from '../../shared/PaymentModal.jsx';
import {
  listOrdersByCustomer,
  attachPaymentProof,
  STATUS_CONFIG,
} from '../../../services/orderService.js';
import { formatCurrency } from '../../../core/helpers.js';
import '../../../styles/css/pages/myOrders.css';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function MyOrdersPage() {
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (!loading && user === null) navigate('/register', { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const result = await listOrdersByCustomer({ customerId: user.id, customerPhone: user.phone });
        setOrders(result);
      } catch (err) {
        console.error('Failed to load orders:', err);
      }
    }
    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    async function handleOrdersUpdated() {
      try {
        const fresh = await listOrdersByCustomer({ customerId: user.id, customerPhone: user.phone });
        setOrders(fresh);
      } catch (err) {
        console.error('Failed to refresh orders:', err);
      }
    }
    window.addEventListener('gala:orders-updated', handleOrdersUpdated);
    return () => window.removeEventListener('gala:orders-updated', handleOrdersUpdated);
  }, [user]);

  function handlePayNow(order) {
    setSelectedOrder(order);
    setPaymentError('');
    setPaymentModalOpen(true);
  }

  async function handlePaymentSubmit(result) {
    if (!selectedOrder || !result?.proof) return;
    const proof = result.proof;
    if (!proof.dataUrl) {
      setPaymentError('Tidak ada file yang dipilih. Silakan pilih file bukti pembayaran.');
      return;
    }
    const res = await attachPaymentProof(selectedOrder.id, {
      fileName: proof.fileName, fileSize: proof.fileSize,
      mimeType: proof.mimeType, dataUrl: proof.dataUrl,
    });
    if (res.ok) {
      const fresh = await listOrdersByCustomer({ customerId: user.id, customerPhone: user.phone });
      setOrders(fresh);
      setPaymentModalOpen(false);
      setSelectedOrder(null);
    } else {
      setPaymentError(res.message ?? 'Gagal mengunggah bukti pembayaran.');
    }
  }

  if (loading) return null;
  if (!user) return null;

  if (orders.length === 0) {
    return (
      <main>
        <div className="container mo-page">
          <h1 className="mo-title">Pesanan Saya</h1>
          <div className="mo-empty">
            <div className="mo-empty-icon">📦</div>
            <p className="mo-empty-text">Kamu belum memiliki pesanan.</p>
            <Link className="mo-empty-btn" to="/products">Mulai Belanja</Link>
          </div>
        </div>
      </main>
    );
  }

  const unpaid = orders.filter((o) => o.status === 'Waiting for Payment' && !o.paymentProof);
  const others = orders.filter((o) => !(o.status === 'Waiting for Payment' && !o.paymentProof));

  return (
    <main>
      <div className="container mo-page">
        <h1 className="mo-title">Pesanan Saya</h1>
        <p className="mo-subtitle">{orders.length} pesanan ditemukan</p>

        {unpaid.length > 0 && (
          <div className="mo-section">
            <div className="mo-section-title mo-section-title--urgent">
              💳 Menunggu Pembayaran ({unpaid.length})
            </div>
            <div className="mo-cards">
              {unpaid.map((order) => (
                <OrderCard key={order.id} order={order} onPayNow={handlePayNow} />
              ))}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div className="mo-section">
            <div className="mo-section-title">Semua Pesanan</div>
            <div className="mo-cards">
              {others.map((order) => (
                <OrderCard key={order.id} order={order} onPayNow={handlePayNow} />
              ))}
            </div>
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => { setPaymentModalOpen(false); setSelectedOrder(null); setPaymentError(''); }}
        order={selectedOrder}
        onPaymentSubmit={handlePaymentSubmit}
        paymentError={paymentError}
      />
    </main>
  );
}

function OrderCard({ order, onPayNow }) {
  const cfg = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };
  const isWaitingPayment = order.status === 'Waiting for Payment';
  const hasProof = Boolean(order.paymentProof);
  const isCustom = order.source === 'custom';

  const itemsSummary = (order.items || [])
    .map((i) => `${i.name} ×${i.quantity}`)
    .join(', ');

  return (
    <div className="mo-card" data-order-id={order.id}>
      <div className="mo-card-header">
        <div className="mo-card-left">
          <code className="mo-order-num">{order.orderNumber}</code>
          {isCustom && <span className="mo-source-tag mo-source-tag--custom">🎨 Custom Order</span>}
          {order.source === 'offline' && <span className="mo-source-tag mo-source-tag--offline">🏪 Offline</span>}
          <span className="mo-date">{fmtDate(order.createdAt)}</span>
        </div>
        <span className={`order-status-badge ${cfg.badge}`}>
          {cfg.icon} {order.status}
        </span>
      </div>

      <div className="mo-card-items">{itemsSummary || '—'}</div>

      <div className="mo-card-footer">
        <div className="mo-total-wrap">
          {order.promoCode ? (
            <>
              <span className="mo-total mo-total--strikethrough">{formatCurrency(order.subtotal)}</span>
              <span className="mo-promo-tag">
                🏷️ {(order.promoCode || '').toUpperCase()} -{formatCurrency(order.discountAmount || 0)}
              </span>
              <span className="mo-total mo-total--final">
                {formatCurrency((order.subtotal || 0) - (order.discountAmount || 0))}
              </span>
            </>
          ) : (
            <span className="mo-total">{formatCurrency(order.subtotal)}</span>
          )}
        </div>
        <div className="mo-card-actions">
          {isWaitingPayment && !hasProof && (
            <button
              className="mo-pay-btn"
              type="button"
              onClick={() => onPayNow(order)}
              data-pay-order={order.id}
            >
              💳 Bayar Sekarang
            </button>
          )}
          {isWaitingPayment && hasProof && (
            <span className="mo-proof-sent">✅ Bukti dikirim — menunggu verifikasi Kasir</span>
          )}
          <Link
            className="mo-track-btn"
            to={`/status?order=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.customerPhone || order.customer?.phone || '')}`}
          >
            🔍 Lacak Pesanan
          </Link>
        </div>
      </div>

      {isCustom && isWaitingPayment && !hasProof && (
        <div className="mo-custom-notice">
          <span>ℹ️</span>
          <span>
            Pesanan custom ini dibuat oleh CS Admin. Silakan lakukan pembayaran untuk melanjutkan proses.
          </span>
        </div>
      )}
    </div>
  );
}

export default MyOrdersPage;
