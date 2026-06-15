/**
 * StatusOrderPage.jsx
 *
 * Lookup form (order number + phone) and 8-step order timeline.
 * Per-item review cards shown when order is Finished and user owns the order.
 * Requirements: 7.7, 13.4
 */

import { useState, useEffect, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { findOrder, ORDER_STATUSES, STATUS_CONFIG } from '../../../services/orderService.js';
import { addReview } from '../../../services/reviewService.js';
import { api } from '../../../core/httpClient.js';
import { formatCurrency } from '../../../core/helpers.js';
import '../../../styles/css/pages/statusOrder.css';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STANDARD_STEPS = ORDER_STATUSES.filter((s) => s !== 'Cancelled');

function TimelineStep({ label, entry, isCurrent, isPast }) {
  const cfg = STATUS_CONFIG[label] || { icon: '○' };
  const done = Boolean(entry?.at) || isPast;
  const time = entry?.at ? fmtDate(entry.at) : null;

  return (
    <div className={`so-step${done ? ' so-step--done' : ''}${isCurrent ? ' so-step--current' : ''}`}>
      <div className="so-step-icon-wrap">
        <div className="so-step-icon">{done ? '✓' : cfg.icon}</div>
        <div className="so-step-line"></div>
      </div>
      <div className="so-step-body">
        <div className="so-step-label">{label}</div>
        {time
          ? <div className="so-step-time">{time}</div>
          : done
            ? <div className="so-step-time">Selesai</div>
            : <div className="so-step-time so-step-time--pending">Menunggu</div>
        }
      </div>
    </div>
  );
}

// ── Per-item review card ──────────────────────────────────────────────────────

function ItemReviewCard({ item, user, orderId }) {
  const [rating, setRating]       = useState(5);
  const [comment, setComment]     = useState('');
  const [error, setError]         = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [checking, setChecking]   = useState(true);

  // Check on mount if this item was already reviewed
  useEffect(() => {
    if (!item.id) { setChecking(false); return; }
    api.get('/api/reviews/reviewed-items', { params: { orderItemIds: item.id } })
      .then((res) => {
        const reviewed = res.data.data ?? [];
        if (reviewed.includes(item.id)) setAlreadyReviewed(true);
      })
      .catch(() => {}) // silently ignore — allow submit attempt (server will reject duplicate)
      .finally(() => setChecking(false));
  }, [item.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!comment.trim()) { setError('Komentar tidak boleh kosong.'); return; }

    setSubmitting(true);
    try {
      await addReview({
        productId:    item.productId ?? item.product_id ?? null,
        orderId,
        orderItemId:  item.id ?? null,
        customerId:   user.id,
        customerName: user.name,
        rating,
        comment: comment.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal mengirim ulasan. Silakan coba lagi.';
      if (err?.response?.status === 409) {
        setAlreadyReviewed(true);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return null;

  if (alreadyReviewed) {
    return (
      <div className="so-review-card so-review-card--done">
        <div className="so-review-card-item">
          <span className="so-review-item-name">{item.name}</span>
          <span className="so-review-item-qty">×{item.quantity || 1}</span>
        </div>
        <div className="so-review-success">✅ Ulasan sudah dikirim untuk item ini.</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="so-review-card so-review-card--done">
        <div className="so-review-card-item">
          <span className="so-review-item-name">{item.name}</span>
          <span className="so-review-item-qty">×{item.quantity || 1}</span>
        </div>
        <div className="so-review-success">✅ Ulasan berhasil dikirim!</div>
      </div>
    );
  }

  return (
    <div className="so-review-card">
      {/* Item info */}
      <div className="so-review-card-item">
        <span className="so-review-item-name">{item.name}</span>
        <span className="so-review-item-qty">×{item.quantity || 1}</span>
        {item.color    && <span className="so-item-tag">🎨 {item.color}</span>}
        {item.size     && <span className="so-item-tag">📐 {item.size}</span>}
        {item.material && <span className="so-item-tag">🧱 {item.material}</span>}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Star rating */}
        <div className="so-review-stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`so-star-btn${n <= rating ? ' so-star-btn--active' : ''}`}
              onClick={() => setRating(n)}
              aria-label={`${n} bintang`}
            >
              ★
            </button>
          ))}
          <span className="so-star-label">{rating}/5</span>
        </div>

        {/* Comment */}
        <textarea
          className="so-review-textarea"
          rows={3}
          placeholder="Bagaimana pengalaman Anda dengan produk ini?"
          value={comment}
          onChange={(e) => { setComment(e.target.value); setError(''); }}
          disabled={submitting}
        />

        {error && <div className="so-review-error">{error}</div>}

        <button
          type="submit"
          className="so-review-submit-btn"
          disabled={submitting}
        >
          {submitting ? 'Mengirim…' : 'Kirim Ulasan'}
        </button>
      </form>
    </div>
  );
}

// ── Order detail ──────────────────────────────────────────────────────────────

function OrderDetail({ order, onReset, user, scrollToReview }) {
  const reviewSectionRef = useRef(null);
  const currentStepIdx = STANDARD_STEPS.indexOf(order.status);
  const cfg = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };

  // Auto-scroll to review section when navigated via "Beri Ulasan" button
  useEffect(() => {
    if (scrollToReview && reviewSectionRef.current) {
      setTimeout(() => {
        reviewSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [scrollToReview]);

  const timelineMap = {};
  (order.timeline || []).forEach((t) => { timelineMap[t.label] = t; });

  // Only the logged-in customer who owns this order can review
  const canReview = order.status === 'Finished'
    && user
    && user.role === 'customer'
    && (user.id === (order.customerId ?? order.customer_id)
        || user.phone === (order.customer?.phone ?? order.customerPhone));

  const items = order.items || [];

  return (
    <div className="so-result" id="so-result">
      <div className="so-result-header">
        <div>
          <div className="so-order-number">{order.orderNumber}</div>
          <div className="so-order-date">
            Dibuat: {new Date(order.createdAt).toLocaleString('id-ID', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
          {order.updatedAt && (
            <div className="so-order-updated">Terakhir diperbarui: {fmtDate(order.updatedAt)}</div>
          )}
        </div>
        <span className={`so-status-badge ${cfg.badge}`}>
          {cfg.icon} {order.status}
        </span>
      </div>

      {order.adminNote && (
        <div className="so-admin-note">
          <span className="so-admin-note-icon">📝</span>
          <div>
            <div className="so-admin-note-label">Catatan dari Admin</div>
            <div className="so-admin-note-text">{order.adminNote}</div>
          </div>
        </div>
      )}

      {order.status === 'In Delivery' && (
        <div className="so-courier-box">
          <div className="so-courier-title">🚚 Pengiriman</div>
          <p className="so-courier-desc">
            Pesanan Anda sedang dalam pengiriman. Integrasi kurir akan segera tersedia.
          </p>
          {order.trackingNumber && (
            <div className="so-courier-num">
              {order.courierName && <span className="so-courier-badge">{order.courierName} </span>}
              No. Resi: <strong>{order.trackingNumber}</strong>
            </div>
          )}
        </div>
      )}

      <div className="so-result-body">
        {/* ── Left: timeline ── */}
        <div className="so-left">
          <h3 className="so-section-label">Tracking</h3>
          <div className="so-timeline">
            {STANDARD_STEPS.map((label, i) => (
              <TimelineStep
                key={label}
                label={label}
                entry={timelineMap[label] || null}
                isCurrent={i === currentStepIdx}
                isPast={currentStepIdx >= 0 && i < currentStepIdx}
              />
            ))}
            {order.status === 'Cancelled' && (
              <TimelineStep
                key="Cancelled"
                label="Cancelled"
                entry={timelineMap['Cancelled'] || null}
                isCurrent={true}
                isPast={false}
              />
            )}
          </div>
        </div>

        {/* ── Right: recipient + items + totals ── */}
        <div className="so-right">
          {/* Info Penerima */}
          <h3 className="so-section-label">Info Penerima</h3>
          <div className="so-address-card" style={{ marginBottom: '20px' }}>
            {order.customer?.addressTitle && (
              <div className="so-address-card-title">📍 {order.customer.addressTitle}</div>
            )}
            <div className="so-address-card-body">
              <div className="so-customer-row">
                <span className="so-customer-key">Nama</span>
                <span>{order.customer?.name || '—'}</span>
              </div>
              <div className="so-customer-row">
                <span className="so-customer-key">Telepon</span>
                <span>{order.customer?.phone || order.customerPhone || '—'}</span>
              </div>
              <div className="so-customer-row">
                <span className="so-customer-key">Alamat</span>
                <span>{order.customer?.address || '—'}</span>
              </div>
            </div>
          </div>

          {/* Rincian Pesanan */}
          <h3 className="so-section-label">Rincian Pesanan ({items.length} item)</h3>
          <div className="so-items">
            {items.length === 0 ? (
              <p className="so-empty">Tidak ada item.</p>
            ) : (
              items.map((item, idx) => (
                <div key={idx} className="so-item-card">
                  <div className="so-item-row">
                    <span className="so-item-name">
                      {item.name}
                      <span className="so-item-qty">×{item.quantity || 1}</span>
                    </span>
                    <span className="so-item-price">
                      {formatCurrency((item.price || 0) * (item.quantity || 1))}
                    </span>
                  </div>
                  <div className="so-item-unit-price">
                    {item.quantity > 1 && <span>{formatCurrency(item.price || 0)} / pcs</span>}
                  </div>
                  {(item.color || item.size || item.material) && (
                    <div className="so-item-attrs">
                      {item.color    && <span className="so-item-tag">🎨 {item.color}</span>}
                      {item.size     && <span className="so-item-tag">📐 {item.size}</span>}
                      {item.material && <span className="so-item-tag">🧱 {item.material}</span>}
                    </div>
                  )}
                  {item.notes && <div className="so-item-notes">📝 {item.notes}</div>}
                </div>
              ))
            )}
          </div>

          {/* Subtotal */}
          <div className="so-total-row">
            <span>Subtotal</span>
            <strong>{formatCurrency(order.subtotal)}</strong>
          </div>

          {/* Promo */}
          {(order.promoCode || order.promo_code) && (
            <div className="so-promo-row">
              <div className="so-promo-left">
                <span>🏷️</span>
                <div>
                  <div className="so-promo-code">{order.promoCode || order.promo_code}</div>
                  <div className="so-promo-label">Kode Promo</div>
                </div>
              </div>
              <span className="so-promo-discount">
                -{formatCurrency(order.discountAmount ?? order.discount_amount ?? 0)}
              </span>
            </div>
          )}
          {(order.promoCode || order.promo_code) && (
            <div className="so-total-row so-total-row--final">
              <span>Total Akhir</span>
              <strong>
                {formatCurrency(
                  (order.subtotal || 0) - Number(order.discountAmount ?? order.discount_amount ?? 0)
                )}
              </strong>
            </div>
          )}

          {/* Alasan Pembatalan */}
          {order.status === 'Cancelled' && (order.cancellationReason || order.cancellation_reason) && (
            <div className="so-cancellation-reason">
              <div className="so-cancellation-title">❌ Alasan Pembatalan</div>
              <div className="so-cancellation-text">
                {order.cancellationReason || order.cancellation_reason}
              </div>
            </div>
          )}

          {/* ── Per-item review cards (Finished orders only) ── */}
          {canReview && items.length > 0 && (
            <div className="so-review-section" id="ulasan" ref={reviewSectionRef}>
              <h3 className="so-section-label" style={{ marginTop: '28px' }}>
                ⭐ Tulis Ulasan
              </h3>
              <p className="so-review-intro">
                Pesanan Anda telah selesai. Berikan ulasan untuk setiap produk yang Anda beli.
              </p>
              <div className="so-review-list">
                {items.map((item, idx) => (
                  <ItemReviewCard
                    key={item.id || idx}
                    item={item}
                    user={user}
                    orderId={order.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="so-result-footer">
        <button className="so-back-btn" type="button" onClick={onReset} data-reset>
          ← Cek Order Lain
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function StatusOrderPage() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [foundOrder, setFoundOrder] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [scrollToReview, setScrollToReview] = useState(false);

  useEffect(() => {
    const prefillOrder = searchParams.get('order') || '';
    const prefillPhone = searchParams.get('phone') || '';
    const hash = window.location.hash;
    setOrderNumber(prefillOrder);
    setPhone(prefillPhone);
    setScrollToReview(hash === '#ulasan');
    if (prefillOrder) runLookup(prefillOrder, prefillPhone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function runLookup(num, ph) {
    if (!num.trim()) {
      setErrorMessage('Nomor transaksi tidak boleh kosong.');
      setFoundOrder(null);
      return;
    }
    if (!user && !ph.trim()) {
      setErrorMessage('Nomor telepon wajib diisi.');
      setFoundOrder(null);
      return;
    }
    Promise.resolve(findOrder({ orderNumber: num.trim(), phone: ph.trim() }))
      .then((order) => {
        if (!order) {
          setErrorMessage('Order tidak ditemukan. Pastikan nomor transaksi dan nomor telepon sudah benar.');
          setFoundOrder(null);
        } else {
          setFoundOrder(order);
          setErrorMessage('');
        }
      })
      .catch(() => {
        setErrorMessage('Terjadi kesalahan. Silakan coba lagi.');
        setFoundOrder(null);
      });
  }

  function handleSubmit(e) {
    e.preventDefault();
    runLookup(orderNumber, phone);
  }

  function handleReset() {
    setFoundOrder(null);
    setErrorMessage('');
    setOrderNumber('');
    setPhone('');
  }

  return (
    <main>
      <div className="container so-page">
        {foundOrder ? (
          <OrderDetail order={foundOrder} onReset={handleReset} user={user} scrollToReview={scrollToReview} />
        ) : (
          <div className="so-lookup-wrap">
            <h1 className="so-title">Status Order</h1>
            <p className="so-desc">
              Masukkan nomor transaksi dan nomor telepon yang terdaftar untuk
              melihat status pesanan Anda.
            </p>
            <form className="so-form" onSubmit={handleSubmit} noValidate data-status-form>
              <div className="so-field">
                <label className="so-label" htmlFor="so-order">Nomor Transaksi</label>
                <input
                  className={`so-input${errorMessage ? ' so-input--error' : ''}`}
                  id="so-order"
                  name="orderNumber"
                  placeholder="GALA-260427-083"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                />
              </div>
              <div className="so-field">
                <label className="so-label" htmlFor="so-phone">Nomor Telepon</label>
                <input
                  className={`so-input${errorMessage ? ' so-input--error' : ''}`}
                  id="so-phone"
                  name="phone"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {errorMessage && (
                <div className="so-not-found-box" id="so-not-found" role="alert">
                  <span className="so-not-found-icon">🔍</span>
                  <div>
                    <div className="so-not-found-title">Order Tidak Ditemukan</div>
                    <div className="so-not-found-msg">{errorMessage}</div>
                  </div>
                </div>
              )}
              <button className="so-submit-btn" type="submit">Cek Status Order</button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

export default StatusOrderPage;
