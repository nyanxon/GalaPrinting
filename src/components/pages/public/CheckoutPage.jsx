/**
 * CheckoutPage.jsx
 *
 * Checkout form matching vanilla checkoutView.js exactly:
 *   .co-layout > .co-form-section + .co-summary-section
 *   Form uses .co-field / .co-label / .co-input / .co-textarea
 *
 * Requirements: 7.5, 13.4
 */

import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CartContext } from '../../context/CartContext.jsx';
import { AuthContext } from '../../context/AuthContext.jsx';
import PaymentModal from '../../shared/PaymentModal.jsx';
import { createOrderFromCart, attachPaymentProof } from '../../../services/orderService.js';
import { formatCurrency } from '../../../core/helpers.js';
import { USE_BACKEND, api } from '../../../core/httpClient.js';
import AddressSelector from '../../shared/AddressSelector.jsx';
import '../../../styles/css/pages/checkout.css';

function CheckoutPage() {
  const { items, clearCart } = useContext(CartContext);
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    addressTitle: '',
    notes: '',
  });
  const [nameErr, setNameErr]       = useState('');
  const [phoneErr, setPhoneErr]     = useState('');
  const [addressErr, setAddressErr] = useState('');
  const [formAlert, setFormAlert]   = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [promoCode, setPromoCode]       = useState('');
  const [promoDiscount, setPromoDiscount] = useState(null); // { discountAmount, finalSubtotal } or null
  const [promoError, setPromoError]     = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);

  // Auth guard
  if (loading) return null;
  if (!user) {
    return (
      <main>
        <div className="container co-page">
          <div className="co-auth-required">
            <div className="co-auth-icon">🔒</div>
            <h2 className="co-auth-title">{t('checkout.loginRequired')}</h2>
            <p className="co-auth-desc">
              {t('checkout.loginRequiredDesc')}
            </p>
            <div className="co-auth-actions">
              <Link className="co-auth-btn co-auth-btn--primary" to="/register">{t('checkout.loginOrRegister')}</Link>
              <Link className="co-auth-btn" to="/cart">{t('checkout.backToCart')}</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Email verification guard — hanya untuk customer
  if (USE_BACKEND && user && user.role === 'customer' && !user.is_email_verified) {
    return (
      <main>
        <div className="container co-page">
          <div className="co-auth-required">
            <div className="co-auth-icon">✉️</div>
            <h2 className="co-auth-title">Verifikasi Email Diperlukan</h2>
            <p className="co-auth-desc">
              Silakan verifikasi email kamu sebelum melanjutkan checkout.
            </p>
            <div className="co-auth-actions">
              <Link className="co-auth-btn co-auth-btn--primary" to="/profile">Verifikasi Sekarang</Link>
              <Link className="co-auth-btn" to="/cart">← Kembali ke Keranjang</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Empty cart guard
  if (items.length === 0) {
    return (
      <main>
        <div className="container co-page">
          <div className="co-empty">
            <p>{t('checkout.emptyCart')}</p>
            <Link className="btn primary" to="/products">{t('checkout.viewProducts')}</Link>
          </div>
        </div>
      </main>
    );
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'name')    setNameErr('');
    if (name === 'phone')   setPhoneErr('');
    if (name === 'address') setAddressErr('');
  }

  function handleAddressSelect({ name, phone, address, title }) {
    setFormData((prev) => ({ ...prev, name, phone, address, addressTitle: title || '' }));
    setNameErr('');
    setPhoneErr('');
    setAddressErr('');
  }

  function validate() {
    let ok = true;
    if (!formData.name.trim())    { setNameErr(t('checkout.errName'));    ok = false; }
    if (!formData.phone.trim())   { setPhoneErr(t('checkout.errPhone')); ok = false; }
    if (!formData.address.trim()) { setAddressErr(t('checkout.errAddress')); ok = false; }
    return ok;
  }

  function handleSubmit(e) {
    e.preventDefault();
    setFormAlert('');
    if (!validate()) return;
    setPaymentModalOpen(true);
  }

  async function handlePaymentSubmit(result) {
    if (submitting) return;
    setSubmitting(true);

    if (!items.length) { setSubmitting(false); navigate('/cart'); return; }

    try {
      const order = await createOrderFromCart({
        customer: { name: formData.name, phone: user?.phone || formData.phone, address: formData.address, addressTitle: formData.addressTitle || null },
        items,
        subtotal,
        promoCode: promoApplied ? promoCode.trim() : null,
        discountAmount: promoDiscount?.discountAmount || 0,
      });

      const proof = result?.proof;
      if (proof) {
        if (USE_BACKEND) {
          await attachPaymentProof(order.id, proof.file ?? proof);
        } else {
          // existing localStorage block — unchanged
          const orders = JSON.parse(localStorage.getItem('gala.orders') || '[]');
          const stored = orders.find((o) => o.id === order.id);
          if (stored) {
            stored.paymentProof = {
              fileName: proof.fileName, fileSize: proof.fileSize,
              mimeType: proof.mimeType, dataUrl: proof.dataUrl,
              uploadedAt: new Date().toISOString(),
            };
            localStorage.setItem('gala.orders', JSON.stringify(orders));
            window.dispatchEvent(new CustomEvent('gala:orders-updated', { detail: { orders } }));
          }
        }
      }

      clearCart();
      setPaymentModalOpen(false);
      if (order.warnings?.length > 0) {
        alert(order.warnings[0]);
      }
      navigate('/my-orders');
    } catch (err) {
      setFormAlert(err?.response?.data?.message ?? 'Gagal membuat pesanan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyPromo() {
    if (!promoCode.trim()) { setPromoError(t('checkout.errPromoEmpty')); return; }
    setPromoError('');
    setPromoLoading(true);
    try {
      if (USE_BACKEND) {
        const res = await api.post('/api/promo/validate', { code: promoCode.trim(), subtotal });
        if (res.data.ok) {
          setPromoDiscount({ discountAmount: res.data.discountAmount, finalSubtotal: res.data.finalSubtotal });
          setPromoApplied(true);
        } else {
          setPromoError(res.data.message || t('checkout.errPromoInvalid'));
        }
      } else {
        // localStorage mode: no promo validation, just show a generic error
        setPromoError(t('checkout.errPromoOffline'));
      }
    } catch (err) {
      setPromoError(err?.response?.data?.message || 'Gagal memvalidasi kode promo.');
    } finally {
      setPromoLoading(false);
    }
  }

  function handleRemovePromo() {
    setPromoCode('');
    setPromoDiscount(null);
    setPromoApplied(false);
    setPromoError('');
  }

  return (
    <main>
      <div className="container co-page">
        <div className="co-layout">

          {/* ── Left: form ── */}
          <section className="co-form-section">
            <h1 className="co-title">{t('checkout.title')}</h1>

            <form className="co-form" id="checkout-form" onSubmit={handleSubmit} noValidate>
              {/* Address selector — only shown to logged-in customers with saved addresses */}
              {USE_BACKEND && <AddressSelector onSelect={handleAddressSelect} />}

              <div className="co-field">
                <label className="co-label" htmlFor="co-name">{t('checkout.fullName')}</label>
                <input
                  className={`co-input co-input--readonly${nameErr ? ' co-input--error' : ''}`}
                  id="co-name"
                  name="name"
                  placeholder={t('checkout.fullNameReadonly')}
                  readOnly
                  value={formData.name}
                  aria-readonly="true"
                />
                {nameErr && (
                  <span className="co-hint co-hint--err" id="co-name-err">{nameErr}</span>
                )}
              </div>

              <div className="co-field">
                <label className="co-label" htmlFor="co-phone">{t('checkout.phone')}</label>
                <input
                  className={`co-input co-input--readonly${phoneErr ? ' co-input--error' : ''}`}
                  id="co-phone"
                  name="phone"
                  type="tel"
                  placeholder={t('checkout.fullNameReadonly')}
                  readOnly
                  value={formData.phone}
                  aria-readonly="true"
                />
                {phoneErr && (
                  <span className="co-hint co-hint--err" id="co-phone-err">{phoneErr}</span>
                )}
              </div>

              <div className="co-field">
                <label className="co-label" htmlFor="co-address">{t('checkout.shippingAddress')}</label>
                <textarea
                  className={`co-input co-textarea co-input--readonly${addressErr ? ' co-input--error' : ''}`}
                  id="co-address"
                  name="address"
                  placeholder={t('checkout.fullNameReadonly')}
                  readOnly
                  rows={3}
                  value={formData.address}
                  aria-readonly="true"
                />
                {addressErr && (
                  <span className="co-hint co-hint--err" id="co-address-err">{addressErr}</span>
                )}
              </div>

              <div className="co-field">
                <label className="co-label" htmlFor="co-notes">{t('checkout.additionalNotes')}</label>
                <textarea
                  className="co-input co-textarea"
                  id="co-notes"
                  name="notes"
                  placeholder={t('checkout.notesPlaceholder')}
                  rows={2}
                  value={formData.notes}
                  onChange={handleChange}
                />
              </div>

              {formAlert && (
                <div className="co-form-alert" id="co-alert">{formAlert}</div>
              )}

              <button className="co-submit-btn" type="submit" disabled={submitting}>
                {submitting ? t('checkout.processing') : t('checkout.createOrder')}
              </button>

              <Link className="co-back-link" to="/cart">{t('checkout.backToCart')}</Link>
            </form>
          </section>

          {/* ── Right: order summary ── */}
          <aside className="co-summary-section">
            <h2 className="co-summary-title">{t('checkout.orderSummary')}</h2>
            <div className="co-summary-list">
              {items.map((item) => (
                <div key={item.id} className="co-summary-row">
                  <span className="co-summary-name">
                    {item.name}
                    <span className="co-summary-qty">×{item.quantity}</span>
                  </span>
                  <span className="co-summary-price">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {/* Promo Code */}
            <div className="co-promo-section">
              {!promoApplied ? (
                <div className="co-promo-input-row">
                  <input
                    className="co-input co-promo-input"
                    type="text"
                    placeholder={t('checkout.promoCode')}
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }}
                    disabled={promoLoading}
                    aria-label={t('checkout.promoCode')}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo(); } }}
                  />
                  <button
                    type="button"
                    className="co-promo-btn"
                    onClick={handleApplyPromo}
                    disabled={promoLoading}
                  >
                    {promoLoading ? '...' : t('checkout.applyPromo')}
                  </button>
                </div>
              ) : (
                <div className="co-promo-applied-row">
                  <span className="co-promo-applied-label">🏷️ {promoCode.trim()}</span>
                  <button type="button" className="co-promo-remove-btn" onClick={handleRemovePromo}>
                    {t('checkout.removePromo')}
                  </button>
                </div>
              )}
              {promoError && <p className="co-promo-error">{promoError}</p>}
              {promoDiscount && (
                <div className="co-promo-discount-row">
                  <span>{t('checkout.discount')}</span>
                  <span className="co-promo-discount-amount">-{formatCurrency(promoDiscount.discountAmount)}</span>
                </div>
              )}
            </div>
            <div className="co-summary-total">
              <span>{t('checkout.total')}</span>
              <strong>{formatCurrency(promoDiscount ? promoDiscount.finalSubtotal : subtotal)}</strong>
            </div>
          </aside>
        </div>
      </div>

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        subtotal={subtotal}
        onPaymentSubmit={handlePaymentSubmit}
      />
    </main>
  );
}

export default CheckoutPage;
