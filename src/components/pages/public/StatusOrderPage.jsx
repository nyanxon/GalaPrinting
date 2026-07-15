/**
 * StatusOrderPage.jsx
 *
 * Lookup form (order number + phone) and 8-step order timeline.
 * Per-item review cards shown when order is Finished and user owns the order.
 * Requirements: 7.7, 13.4
 */

import { useState, useEffect, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext.jsx';
import { findOrder, ORDER_STATUSES, STATUS_CONFIG } from '../../../services/orders.js';
import { addReview } from '../../../services/reviews.js';
import { api } from '../../../core/httpClient.js';
import { formatCurrency } from '../../../utils/format.js';
import '../../../styles/css/pages/statusOrder.css';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STANDARD_STEPS = ORDER_STATUSES.filter((s) => s !== 'Cancelled');

/**
 * Timeline steps untuk custom order (CS-first flow).
 * Urutan berbeda: design review dulu, baru payment.
 */
const CUSTOM_STEPS = [
  'Waiting for Design Approval',
  'Design Accepted',
  'Waiting for Payment',
  'Payment Accepted',
  'On Progress',
  'Quality Checking',
  'In Delivery',
  'Finished',
];

/**
 * Pilih urutan langkah timeline sesuai order_type.
 * @param {object} order
 * @returns {string[]}
 */
function getTimelineSteps(order) {
  const type   = order?.orderType ?? order?.order_type ?? 'standard';
  const source = order?.source ?? 'online';
  if (type === 'custom' || source === 'custom') return CUSTOM_STEPS;
  return STANDARD_STEPS;
}

/**
 * TimelineStep — HANYA tercentang jika status ini punya entry nyata di timelineMap
 * (artinya admin/sistem benar-benar pernah set status ini di database).
 * TIDAK tercentang hanya karena index-nya lebih kecil dari status saat ini.
 */
function TimelineStep({ label, timestampIso, isCurrent }) {
  const { t } = useTranslation();
  const cfg  = STATUS_CONFIG[label] || { icon: '○' };
  // done = hanya jika ada timestamp nyata dari DB
  const done = Boolean(timestampIso);

  return (
    <div className={`so-step${done ? ' so-step--done' : ''}${isCurrent ? ' so-step--current' : ''}`}>
      <div className="so-step-icon-wrap">
        <div className="so-step-icon">{done ? '✓' : cfg.icon}</div>
        <div className="so-step-line"></div>
      </div>
      <div className="so-step-body">
        <div className="so-step-label">{label}</div>
        {timestampIso
          ? <div className="so-step-time">{fmtDate(timestampIso)}</div>
          : isCurrent
            ? <div className="so-step-time">{t('orderStatus.completed')}</div>
            : <div className="so-step-time so-step-time--pending">{t('orderStatus.pending')}</div>
        }
      </div>
    </div>
  );
}

// ── Per-item review card ──────────────────────────────────────────────────────

function ItemReviewCard({ item, user, orderId }) {
  const { t } = useTranslation();
  const [rating, setRating]       = useState(5);
  const [comment, setComment]     = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError]         = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [checking, setChecking]   = useState(true);
  const fileInputRef = useRef(null);

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

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setError(t('orderStatus.photoHint'));
      return;
    }
    if (file.size > 100 * 1024 * 1024) { // 100 MB (updated from 5 MB)
      setError(t('orderStatus.photoHint'));
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => setPhotoPreview(evt.target.result);
    reader.readAsDataURL(file);
    setError('');
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!comment.trim()) { setError(t('orderStatus.errorReviewComment')); return; }

    setSubmitting(true);
    try {
      // If USE_BACKEND, we need to send multipart/form-data to include the photo
      const { USE_BACKEND, api: httpClient } = await import('../../../core/httpClient.js');
      if (USE_BACKEND && photoFile) {
        const formData = new FormData();
        formData.append('rating', String(rating));
        formData.append('comment', comment.trim());
        if (item.productId ?? item.product_id) {
          formData.append('productId', item.productId ?? item.product_id);
        }
        if (orderId) formData.append('orderId', orderId);
        if (item.id) formData.append('orderItemId', item.id);
        formData.append('photo', photoFile);
        await httpClient.post('/api/reviews', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await addReview({
          productId:    item.productId ?? item.product_id ?? null,
          orderId,
          orderItemId:  item.id ?? null,
          customerId:   user.id,
          customerName: user.name,
          rating,
          comment: comment.trim(),
        });
      }
      setSubmitted(true);
    } catch (err) {
      const msg = err?.response?.data?.message || t('orderStatus.errorReviewFailed');
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
        <div className="so-review-success">✅ {t('orderStatus.alreadyReviewed')}</div>
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
        <div className="so-review-success">✅ {t('orderStatus.reviewSuccess')}</div>
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
              aria-label={`${n} ${t('orderStatus.rating')}`}
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
          placeholder={t('orderStatus.reviewPlaceholder')}
          value={comment}
          onChange={(e) => { setComment(e.target.value); setError(''); }}
          disabled={submitting}
        />

        {/* Photo upload */}
        <div className="so-review-photo-wrap">
          {photoPreview ? (
            <div className="so-review-photo-preview">
              <img src={photoPreview} alt="Preview foto ulasan"
                style={{ maxWidth: 160, maxHeight: 120, objectFit: 'cover',
                  borderRadius: 8, border: '1px solid #e5e7eb', display: 'block' }} />
              <button type="button" className="so-review-photo-remove"
                onClick={removePhoto} disabled={submitting}
                aria-label={t('orderStatus.removePhoto')}>
                ✕ {t('orderStatus.removePhoto')}
              </button>
            </div>
          ) : (
            <label className="so-review-photo-label" style={{ cursor: submitting ? 'not-allowed' : 'pointer' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handlePhotoChange}
                disabled={submitting}
                style={{ display: 'none' }}
              />
              <span className="so-review-photo-btn">
                📷 {t('orderStatus.addPhoto')}
              </span>
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{t('orderStatus.photoHint')}</span>
            </label>
          )}
        </div>

        {error && <div className="so-review-error">{error}</div>}

        <button
          type="submit"
          className="so-review-submit-btn"
          disabled={submitting}
        >
          {submitting ? t('orderStatus.submitting') : t('orderStatus.submitReview')}
        </button>
      </form>
    </div>
  );
}

// ── Order detail ──────────────────────────────────────────────────────────────

function OrderDetail({ order, onReset, user, scrollToReview }) {
  const { t } = useTranslation();
  const reviewSectionRef = useRef(null);

  // Pilih urutan step sesuai order type (standard vs custom)
  const timelineSteps  = getTimelineSteps(order);
  const currentStepIdx = timelineSteps.indexOf(order.status);
  const cfg = STATUS_CONFIG[order.status] || { icon: '○', badge: '' };

  // Auto-scroll to review section when navigated via "Beri Ulasan" button
  useEffect(() => {
    if (scrollToReview && reviewSectionRef.current) {
      setTimeout(() => {
        reviewSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [scrollToReview]);

  // timelineMap dari backend: { [statusName]: isoTimestamp }
  // Hanya berisi status yang benar-benar pernah di-set di DB
  const timelineMap = order.timelineMap || {};

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
            {t('orderStatus.created')}: {new Date(order.createdAt).toLocaleString('id-ID', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
          {order.updatedAt && (
            <div className="so-order-updated">{t('orderStatus.lastUpdated')}: {fmtDate(order.updatedAt)}</div>
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
            <div className="so-admin-note-label">{t('orderStatus.adminNote')}</div>
            <div className="so-admin-note-text">{order.adminNote}</div>
          </div>
        </div>
      )}

      {order.status === 'In Delivery' && (
        <div className="so-courier-box">
          <div className="so-courier-title">🚚 {t('orderStatus.delivery')}</div>
          <p className="so-courier-desc">
            {t('orderStatus.deliveryDesc')}
          </p>
          {order.trackingNumber && (
            <div className="so-courier-num">
              {order.courierName && <span className="so-courier-badge">{order.courierName} </span>}
              {t('orderStatus.trackingNumber')}: <strong>{order.trackingNumber}</strong>
            </div>
          )}
        </div>
      )}

      <div className="so-result-body">
        {/* ── Left: timeline ── */}
        <div className="so-left">
          <h3 className="so-section-label">{t('orderStatus.tracking')}</h3>
          <div className="so-timeline">
            {timelineSteps.map((label, i) => (
              <TimelineStep
                key={label}
                label={label}
                timestampIso={timelineMap[label] || null}
                isCurrent={i === currentStepIdx}
              />
            ))}
            {order.status === 'Cancelled' && (
              <TimelineStep
                key="Cancelled"
                label="Cancelled"
                timestampIso={timelineMap['Cancelled'] || null}
                isCurrent={true}
              />
            )}
          </div>
        </div>

        {/* ── Right: recipient + items + totals ── */}
        <div className="so-right">
          {/* Info Penerima */}
          <h3 className="so-section-label">{t('orderStatus.recipientInfo')}</h3>
          <div className="so-address-card" style={{ marginBottom: '20px' }}>
            {order.customer?.addressTitle && (
              <div className="so-address-card-title">📍 {order.customer.addressTitle}</div>
            )}
            <div className="so-address-card-body">
              <div className="so-customer-row">
                <span className="so-customer-key">{t('orderStatus.name')}</span>
                <span>{order.customer?.name || '—'}</span>
              </div>
              <div className="so-customer-row">
                <span className="so-customer-key">{t('orderStatus.phone')}</span>
                <span>{order.customer?.phone || order.customerPhone || '—'}</span>
              </div>
              <div className="so-customer-row">
                <span className="so-customer-key">{t('orderStatus.address')}</span>
                <span>{order.customer?.address || '—'}</span>
              </div>
            </div>
          </div>

          {/* Rincian Pesanan */}
          <h3 className="so-section-label">{t('orderStatus.orderDetails')} ({items.length} {t('orderStatus.item')})</h3>
          <div className="so-items">
            {items.length === 0 ? (
              <p className="so-empty">{t('orderStatus.noItems')}</p>
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
                    {item.quantity > 1 && <span>{formatCurrency(item.price || 0)} {t('orderStatus.unitPrice')}</span>}
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
            <span>{t('orderStatus.subtotal')}</span>
            <strong>{formatCurrency(order.subtotal)}</strong>
          </div>

          {/* Promo */}
          {(order.promoCode || order.promo_code) && (
            <div className="so-promo-row">
              <div className="so-promo-left">
                <span>🏷️</span>
                <div>
                  <div className="so-promo-code">{order.promoCode || order.promo_code}</div>
                  <div className="so-promo-label">{t('orderStatus.promoCode')}</div>
                </div>
              </div>
              <span className="so-promo-discount">
                -{formatCurrency(order.discountAmount ?? order.discount_amount ?? 0)}
              </span>
            </div>
          )}
          {(order.promoCode || order.promo_code) && (
            <div className="so-total-row so-total-row--final">
              <span>{t('orderStatus.finalTotal')}</span>
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
              <div className="so-cancellation-title">❌ {t('orderStatus.cancellationReason')}</div>
              <div className="so-cancellation-text">
                {order.cancellationReason || order.cancellation_reason}
              </div>
            </div>
          )}

          {/* ── Per-item review cards (Finished orders only) ── */}
          {canReview && items.length > 0 && (
            <div className="so-review-section" id="ulasan" ref={reviewSectionRef}>
              <h3 className="so-section-label" style={{ marginTop: '28px' }}>
                ⭐ {t('orderStatus.writeReview')}
              </h3>
              <p className="so-review-intro">
                {t('orderStatus.reviewIntro')}
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
          ← {t('orderStatus.checkOtherOrder')}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function StatusOrderPage() {
  const { t } = useTranslation();
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
      setErrorMessage(t('orderStatus.errorOrderNumber'));
      setFoundOrder(null);
      return;
    }
    if (!user && !ph.trim()) {
      setErrorMessage(t('orderStatus.errorPhone'));
      setFoundOrder(null);
      return;
    }
    Promise.resolve(findOrder({ orderNumber: num.trim(), phone: ph.trim() }))
      .then((order) => {
        if (!order) {
          setErrorMessage(t('orderStatus.errorNotFound'));
          setFoundOrder(null);
        } else {
          setFoundOrder(order);
          setErrorMessage('');
        }
      })
      .catch(() => {
        setErrorMessage(t('orderStatus.errorGeneral'));
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
            <h1 className="so-title">{t('orderStatus.title')}</h1>
            <p className="so-desc">
              {t('orderStatus.subtitle')}
            </p>
            <form className="so-form" onSubmit={handleSubmit} noValidate data-status-form>
              <div className="so-field">
                <label className="so-label" htmlFor="so-order">{t('orderStatus.orderNumber')}</label>
                <input
                  className={`so-input${errorMessage ? ' so-input--error' : ''}`}
                  id="so-order"
                  name="orderNumber"
                  placeholder={t('orderStatus.orderNumberPlaceholder')}
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                />
              </div>
              <div className="so-field">
                <label className="so-label" htmlFor="so-phone">{t('orderStatus.phone')}</label>
                <input
                  className={`so-input${errorMessage ? ' so-input--error' : ''}`}
                  id="so-phone"
                  name="phone"
                  type="tel"
                  placeholder={t('orderStatus.phonePlaceholder')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {errorMessage && (
                <div className="so-not-found-box" id="so-not-found" role="alert">
                  <span className="so-not-found-icon">🔍</span>
                  <div>
                    <div className="so-not-found-title">{t('orderStatus.notFoundTitle')}</div>
                    <div className="so-not-found-msg">{errorMessage}</div>
                  </div>
                </div>
              )}
              <button className="so-submit-btn" type="submit">{t('orderStatus.checkButton')}</button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

export default StatusOrderPage;
