/**
 * CartPage.jsx
 *
 * Cart item list matching vanilla cart.html exactly:
 *   .cart-page > h1.page-title + .cart-grid > section[data-cart-items] + aside.card.summary
 *
 * Requirements: 7.4, 13.4
 */

import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext.jsx';
import { AuthContext } from '../../context/AuthContext.jsx';
import { formatCurrency } from '../../../core/helpers.js';
import { resolveApiUrl, USE_BACKEND } from '../../../core/httpClient.js';
import placeholderImg from '../../../assets/placeholder.svg';
import ConfirmDialog from '../../shared/ConfirmDialog.jsx';
import '../../../styles/css/pages/cart.css';

// ── Cart Item Detail Modal ────────────────────────────────────────────────────

function CartItemDetailModal({ item, onClose }) {
  const { t } = useTranslation();

  if (!item) return null;

  const specs = [
    item.material && { label: t('cart.material'), value: item.material },
    item.color    && { label: t('cart.color'),    value: item.color },
    item.size     && { label: t('cart.size'),     value: item.size },
    item.notes    && { label: t('cart.notes'),    value: item.notes },
  ].filter(Boolean);

  const imgSrc = item.image
    ? (item.image.startsWith('http') || item.image.startsWith('data:') || item.image.startsWith('/')
        ? resolveApiUrl(item.image) || placeholderImg
        : item.image)
    : placeholderImg;

  const hasDesign = Boolean(item.designDataUrl || item.designFileName);

  return (
    <div
      className="cdm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail ${item.name}`}
      onClick={onClose}
    >
      <div className="cdm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cdm-header">
          <h3 className="cdm-title">{item.name}</h3>
          <button
            type="button"
            className="cdm-close"
            onClick={onClose}
            aria-label={t('cart.closeDetail')}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="cdm-body">
          {/* Product image */}
          <img
            className="cdm-image"
            src={imgSrc}
            alt={item.name}
            onError={(e) => { e.currentTarget.src = placeholderImg; }}
          />

          {/* Specs */}
          {specs.length > 0 && (
            <div className="cdm-specs">
              {specs.map(({ label, value }) => (
                <div key={label} className="cdm-spec-row">
                  <span className="cdm-spec-label">{label}</span>
                  <span className="cdm-spec-value">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Qty & price */}
          <div className="cdm-specs" style={{ marginTop: '8px' }}>
            <div className="cdm-spec-row">
              <span className="cdm-spec-label">{t('cart.qty')}</span>
              <span className="cdm-spec-value">{item.quantity}</span>
            </div>
            <div className="cdm-spec-row">
              <span className="cdm-spec-label">{t('cart.unitPrice')}</span>
              <span className="cdm-spec-value">{formatCurrency(item.price)}</span>
            </div>
            <div className="cdm-spec-row">
              <span className="cdm-spec-label">{t('cart.subtotal')}</span>
              <span className="cdm-spec-value" style={{ fontWeight: 700 }}>
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          </div>

          {/* Design file attachment */}
          {hasDesign && (
            <div className="cdm-attachment">
              <div className="cdm-attachment-label">📎 {t('cart.designAttachment')}</div>
              {item.designDataUrl ? (
                (() => {
                  const isImage = item.designDataUrl.startsWith('data:image');
                  return isImage ? (
                    <a href={item.designDataUrl} download={item.designFileName || 'desain'} target="_blank" rel="noopener noreferrer">
                      <img
                        className="cdm-design-preview"
                        src={item.designDataUrl}
                        alt="Preview desain"
                      />
                    </a>
                  ) : (
                    <a
                      className="cdm-design-link"
                      href={item.designDataUrl}
                      download={item.designFileName || 'desain'}
                    >
                      ⬇ {item.designFileName || t('cart.downloadDesign')}
                    </a>
                  );
                })()
              ) : (
                <span className="cdm-design-name">
                  📄 {item.designFileName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cdm-footer">
          <button type="button" className="btn primary" onClick={onClose}>
            {t('cart.closeBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CartPage ──────────────────────────────────────────────────────────────────

function CartPage() {
  const { t } = useTranslation();
  const { items, removeItem, updateItemQty } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const needsEmailVerify = USE_BACKEND && user && user.role === 'customer' && !user.is_email_verified;
  // Track raw input value per item id so user can freely type before committing
  const [qtyInputs, setQtyInputs] = useState({});
  // Confirm delete dialog
  const [confirmId, setConfirmId] = useState(null);
  // Detail modal
  const [detailItem, setDetailItem] = useState(null);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function getDisplayQty(item) {
    return qtyInputs[item.id] !== undefined ? qtyInputs[item.id] : String(item.quantity);
  }

  function handleQtyInput(item, value) {
    setQtyInputs((prev) => ({ ...prev, [item.id]: value }));
  }

  function commitQty(item) {
    const raw = qtyInputs[item.id];
    if (raw === undefined) return; // not edited
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      updateItemQty(item.id, parsed);
    } else if (!isNaN(parsed) && parsed < 1) {
      removeItem(item.id);
    } else {
      // Invalid input — revert display to current quantity
    }
    setQtyInputs((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
  }

  return (
    <main className="container cart-page">
      <h1 className="page-title">{t('cart.shoppingList')}</h1>

      <div className="cart-grid">
        {/* Cart items */}
        <section className="stack" aria-label={t('cart.cartItemsLabel')} data-cart-items>
          {items.length === 0 ? (
            <div className="alert muted">
              {t('cart.emptyCart')}{' '}
              <Link className="btn" to="/products" style={{ marginLeft: '10px' }}>
                {t('cart.viewProducts')}
              </Link>
            </div>
          ) : (
            items.map((item) => {
              const meta = [item.material, item.color, item.size].filter(Boolean).join(' • ');
              const imgSrc = (() => {
                if (!item.image) return placeholderImg;
                const raw = item.image;
                // Already absolute URL (http/https)
                if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
                // Data URL (design preview)
                if (raw.startsWith('data:')) return raw;
                // Relative path — resolve via API base
                return resolveApiUrl(raw) || placeholderImg;
              })();

              return (
                <div key={item.id} className="cart-item" data-item-id={item.id}>
                  {/* Clickable image → opens detail modal */}
                  <button
                    type="button"
                    className="cart-item-img-btn"
                    onClick={() => setDetailItem(item)}
                    aria-label={t('cart.viewDetail')}
                    title="Lihat detail pemesanan"
                  >
                    <img
                      src={imgSrc}
                      alt={item.name}
                      onError={(e) => { e.currentTarget.src = placeholderImg; }}
                    />
                  </button>

                  <div>
                    {/* Clickable title → opens detail modal */}
                    <button
                      type="button"
                      className="cart-item-title cart-item-title-btn"
                      onClick={() => setDetailItem(item)}
                      title="Lihat detail pemesanan"
                    >
                      {item.name}
                      <span className="cart-item-detail-hint"> · {t('cart.viewDetail')}</span>
                    </button>

                    {meta && <div className="cart-item-meta">{meta}</div>}
                    {item.designFileName && (
                      <div className="cart-item-meta">{t('cart.design')}: {item.designFileName}</div>
                    )}
                    {item.notes && (
                      <div className="cart-item-meta">{t('cart.notes')}: {item.notes}</div>
                    )}
                    <div className="cart-item-actions">
                      <div className="nav-pill" style={{ gap: '12px' }}>
                        <button
                          className="btn ghost"
                          style={{ padding: '6px 10px' }}
                          type="button"
                          data-qty-minus
                          onClick={() => {
                            if (item.quantity <= 1) {
                              removeItem(item.id);
                            } else {
                              updateItemQty(item.id, item.quantity - 1);
                            }
                          }}
                        >
                          -
                        </button>
                        <input
                          className="cart-qty-input"
                          type="number"
                          min="1"
                          data-qty
                          value={getDisplayQty(item)}
                          onChange={(e) => handleQtyInput(item, e.target.value)}
                          onBlur={() => commitQty(item)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                          aria-label={`${t('cart.qty')} ${item.name}`}
                        />
                        <button
                          className="btn ghost"
                          style={{ padding: '6px 10px' }}
                          type="button"
                          data-qty-plus
                          onClick={() => {
                            updateItemQty(item.id, item.quantity + 1);
                          }}
                        >
                          +
                        </button>
                      </div>
                      <strong className="cart-item-price">{formatCurrency(item.price * item.quantity)}</strong>
                      <button
                        className="btn primary"
                        type="button"
                        data-remove
                        onClick={() => setConfirmId(item.id)}
                        aria-label={`${t('cart.remove')} ${item.name}`}
                      >
                        {t('cart.remove')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Summary sidebar */}
        <aside className="card summary">
          <div className="card-body">
            <div className="card-title">{t('cart.summary')}</div>
            <div className="summary-row">
              <span className="muted">{t('cart.subtotal')}</span>
              <strong data-cart-subtotal>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="form-actions" style={{ marginTop: '10px' }}>
              {needsEmailVerify && (
                <div className="co-email-verify-warning" role="alert" style={{ marginBottom: '10px' }}>
                  <span className="co-email-verify-icon">⚠️</span>
                  <span style={{ fontSize: '13px' }}>
                    Verifikasi email kamu sebelum checkout.{' '}
                    <Link to="/profile" className="co-email-verify-link">Verifikasi sekarang →</Link>
                  </span>
                </div>
              )}
              {needsEmailVerify ? (
                <button
                  className="btn primary"
                  type="button"
                  disabled
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                  title="Verifikasi email kamu terlebih dahulu"
                >
                  Checkout
                </button>
              ) : (
                <Link
                  className="btn primary"
                  to="/checkout"
                  data-checkout-link
                  style={{ pointerEvents: items.length === 0 ? 'none' : 'auto', opacity: items.length === 0 ? 0.5 : 1 }}
                >
                  Checkout
                </Link>
              )}
              <button
                className="btn"
                type="button"
                data-clear
                onClick={() => setConfirmId('__clear_all__')}
              >
                {t('cart.clearCart')}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Cart Item Detail Modal */}
      <CartItemDetailModal item={detailItem} onClose={() => setDetailItem(null)} />

      {/* Confirm remove single item */}
      <ConfirmDialog
        isOpen={confirmId !== null && confirmId !== '__clear_all__'}
        onClose={() => setConfirmId(null)}
        onConfirm={() => removeItem(confirmId)}
        title={t('cart.confirmRemoveTitle')}
        message={t('cart.confirmRemoveMsg')}
        confirmLabel={t('cart.confirmYes')}
        cancelLabel={t('cart.confirmNo')}
      />

      {/* Confirm clear all */}
      <ConfirmDialog
        isOpen={confirmId === '__clear_all__'}
        onClose={() => setConfirmId(null)}
        onConfirm={() => items.forEach((i) => removeItem(i.id))}
        title={t('cart.confirmClearTitle')}
        message={t('cart.confirmClearMsg')}
        confirmLabel={t('cart.confirmYes')}
        cancelLabel={t('cart.confirmNo')}
      />
    </main>
  );
}

export default CartPage;
