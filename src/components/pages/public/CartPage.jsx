/**
 * CartPage.jsx
 *
 * Cart item list matching vanilla cart.html exactly:
 *   .cart-page > h1.page-title + .cart-grid > section[data-cart-items] + aside.card.summary
 *
 * Requirements: 7.4, 13.4
 */

import { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext.jsx';
import { AuthContext } from '../../context/AuthContext.jsx';
import { formatCurrency } from '../../../utils/format.js';
import { resolveApiUrl, USE_BACKEND } from '../../../core/httpClient.js';
import { buildWhatsAppUrl } from '../../../core/config.js';
import { batchCheckStock } from '../../../services/products.js';
import placeholderImg from '../../../assets/placeholder.svg';
import ConfirmDialog from '../../ui/ConfirmDialog.jsx';
import '../../../styles/css/pages/cart.css';

// ── Cart Item Detail Modal ────────────────────────────────────────────────────

/**
 * Parse selected attribute values from a cart item.
 * Accepts a JSON array string or an already-parsed array of { name, value }.
 */
function parseItemAttributes(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const name = String(a.name ?? '').trim();
      const value = String(a.value ?? '').trim();
      return name && value ? { name, value } : null;
    })
    .filter(Boolean);
}

function CartItemDetailModal({ item, onClose }) {
  if (!item) return null;

  // ── Design file ──
  const designUrl      = item.designDataUrl || null;
  const designFileName = item.designFileName || item.design_file_path || null;
  const hasDesign      = Boolean(designUrl || designFileName);
  const isDesignImage  = designUrl ? designUrl.startsWith('data:image') : false;

  const totalPrice = Number(item.price || 0) * Number(item.quantity || 1);

  return (
    <div
      className="cdm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail ${item.name}`}
      onClick={onClose}
    >
      <div className="cdm-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="cdm-header">
          <h3 className="cdm-title">{item.name}</h3>
          <button
            type="button"
            className="cdm-close"
            onClick={onClose}
            aria-label="Tutup detail"
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="cdm-body">

          {/* Info Produk */}
          <div className="cdm-specs">
            {/* Nama Item */}
            <div className="cdm-spec-row">
              <span className="cdm-spec-label">Nama Item</span>
              <span className="cdm-spec-value">{item.name}</span>
            </div>

            {/* Atribut terpilih */}
            {parseItemAttributes(item.attributes).map((a) => (
              <div className="cdm-spec-row" key={a.name}>
                <span className="cdm-spec-label">{a.name}</span>
                <span className="cdm-spec-value">{a.value}</span>
              </div>
            ))}

            {/* Keterangan */}
            <div className="cdm-spec-row">
              <span className="cdm-spec-label">Keterangan</span>
              <span className="cdm-spec-value">{item.notes || <span style={{ color: 'var(--gray-400)' }}>—</span>}</span>
            </div>
          </div>

          {/* Harga */}
          <div className="cdm-specs" style={{ marginTop: '12px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
            <div className="cdm-spec-row">
              <span className="cdm-spec-label">Jumlah</span>
              <span className="cdm-spec-value">{item.quantity} pcs</span>
            </div>
            <div className="cdm-spec-row">
              <span className="cdm-spec-label">Harga Satuan</span>
              <span className="cdm-spec-value">{formatCurrency(item.price)}</span>
            </div>
            <div className="cdm-spec-row" style={{ fontWeight: 700 }}>
              <span className="cdm-spec-label">Total Harga</span>
              <span className="cdm-spec-value" style={{ color: 'var(--brand-brown, #785E40)', fontSize: '16px' }}>
                {formatCurrency(totalPrice)}
              </span>
            </div>
          </div>

          {/* File Desain yang Diupload */}
          {hasDesign && (
            <div className="cdm-attachment" style={{ marginTop: '12px' }}>
              <div className="cdm-section-label">📎 File Desain</div>
              {designUrl && isDesignImage ? (
                <img
                  className="cdm-design-preview"
                  src={designUrl}
                  alt="Preview desain"
                  style={{ marginTop: '8px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '10px 12px', background: 'var(--gray-50)', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '24px' }}>📄</span>
                  <span style={{ fontSize: '13px', color: '#374151' }}>{designFileName || 'File desain tersimpan'}</span>
                </div>
              )}
            </div>
          )}

          {/* Jika tidak ada file desain */}
          {!hasDesign && (
            <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--gray-50)', borderRadius: '8px', border: '1px solid #e5e7eb', color: 'var(--gray-400)', fontSize: '13px' }}>
              📎 Belum ada file desain yang diupload
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="cdm-footer">
          <button type="button" className="btn primary" onClick={onClose}>
            Tutup
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

  // ── Validasi stok batch (mode backend) ──
  const [stockByItem, setStockByItem] = useState({});
  const [stockChecking, setStockChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!USE_BACKEND) {
      setStockByItem({});
      setStockChecking(false);
      return undefined;
    }
    const entries = items
      .filter((i) => i.productId)
      .map((i) => ({ key: i.id, productId: i.productId, combination: parseItemAttributes(i.attributes) }));
    if (entries.length === 0) {
      setStockByItem({});
      setStockChecking(false);
      return undefined;
    }
    setStockChecking(true);
    batchCheckStock(entries)
      .then((list) => {
        if (cancelled) return;
        const map = {};
        for (const e of list ?? []) {
          if (e && e.key !== null && e.key !== undefined) map[e.key] = Number(e.stock) || 0;
        }
        setStockByItem(map);
        setStockChecking(false);
      })
      .catch(() => {
        if (!cancelled) setStockChecking(false);
      });
    return () => { cancelled = true; };
  }, [items]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function waItemMessage(item) {
    const attrs = parseItemAttributes(item.attributes).map((a) => `${a.name}: ${a.value}`).join(' · ');
    return `Halo Gala Printing! Saya ingin memesan ${item.name}${
      attrs ? ` (${attrs})` : ''
    } sebanyak ${item.quantity} pcs. Apakah masih tersedia?`;
  }

  const stockInsufficient = (item) =>
    Boolean(item.productId) && stockByItem[item.id] !== undefined && stockByItem[item.id] < item.quantity;

  const hasStockIssue = items.some(stockInsufficient);
  const checkoutBlocked = USE_BACKEND && (stockChecking || hasStockIssue);

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
              const meta = [item.notes].filter(Boolean).join(' • ');
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
                      width="80"
                      height="80"
                      loading="lazy"
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
                    {parseItemAttributes(item.attributes).length > 0 && (
                      <div className="cart-item-meta">
                        {parseItemAttributes(item.attributes).map((a) => `${a.name}: ${a.value}`).join(' • ')}
                      </div>
                    )}
                    {item.designFileName && (
                      <div className="cart-item-meta">{t('cart.design')}: {item.designFileName}</div>
                    )}
                    {item.notes && (
                      <div className="cart-item-meta">{t('cart.notes')}: {item.notes}</div>
                    )}
                    {USE_BACKEND && stockByItem[item.id] !== undefined && (stockInsufficient(item) ? (
                      <div className="cart-item-meta" style={{ color: 'var(--color-danger-dark)', fontWeight: 600 }}>
                        Stok tersisa {stockByItem[item.id]} pcs — tidak cukup untuk pesanan.
                        {' '}<a
                          href={buildWhatsAppUrl(waItemMessage(item))}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--color-success-mid)', textDecoration: 'underline' }}
                        >
                          Pesan via WhatsApp
                        </a>
                      </div>
                    ) : (
                      <div className="cart-item-meta" style={{ color: 'var(--color-success-mid)' }}>
                        Stok tersedia: {stockByItem[item.id]} pcs
                      </div>
                    ))}
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
                  style={{ pointerEvents: checkoutBlocked || items.length === 0 ? 'none' : 'auto', opacity: checkoutBlocked || items.length === 0 ? 0.5 : 1 }}
                >
                  Checkout
                </Link>
              )}
              {USE_BACKEND && stockChecking && (
                <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--gray-500)' }}>
                  Menghitung stok…
                </p>
              )}
              {USE_BACKEND && hasStockIssue && (
                <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--color-danger-dark)' }}>
                  Sebagian item stoknya tidak cukup — sesuaikan jumlah atau hubungi kami via WhatsApp.
                </p>
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
