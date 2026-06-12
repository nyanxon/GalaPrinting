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
  if (!user || user.role !== 'customer') {
    return (
      <main>
        <div className="container co-page">
          <div className="co-auth-required">
            <div className="co-auth-icon">🔒</div>
            <h2 className="co-auth-title">Login Diperlukan</h2>
            <p className="co-auth-desc">
              Kamu harus login atau daftar terlebih dahulu sebelum melanjutkan checkout.
            </p>
            <div className="co-auth-actions">
              <Link className="co-auth-btn co-auth-btn--primary" to="/register">Login / Daftar</Link>
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
            <p>Keranjang kamu kosong.</p>
            <Link className="btn primary" to="/products">Lihat Produk</Link>
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
    if (!formData.name.trim())    { setNameErr('Pilih alamat tersimpan untuk mengisi nama.');    ok = false; }
    if (!formData.phone.trim())   { setPhoneErr('Pilih alamat tersimpan untuk mengisi nomor telepon.'); ok = false; }
    if (!formData.address.trim()) { setAddressErr('Pilih alamat tersimpan untuk mengisi alamat pengiriman.'); ok = false; }
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
    if (!promoCode.trim()) { setPromoError('Masukkan kode promo.'); return; }
    setPromoError('');
    setPromoLoading(true);
    try {
      if (USE_BACKEND) {
        const res = await api.post('/api/promo/validate', { code: promoCode.trim(), subtotal });
        if (res.data.ok) {
          setPromoDiscount({ discountAmount: res.data.discountAmount, finalSubtotal: res.data.finalSubtotal });
          setPromoApplied(true);
        } else {
          setPromoError(res.data.message || 'Kode promo tidak valid.');
        }
      } else {
        // localStorage mode: no promo validation, just show a generic error
        setPromoError('Validasi kode promo tidak tersedia dalam mode offline.');
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
            <h1 className="co-title">Checkout</h1>

            <form className="co-form" id="checkout-form" onSubmit={handleSubmit} noValidate>
              {/* Address selector — only shown to logged-in customers with saved addresses */}
              {USE_BACKEND && <AddressSelector onSelect={handleAddressSelect} />}

              <div className="co-field">
                <label className="co-label" htmlFor="co-name">Nama Lengkap</label>
                <input
                  className={`co-input co-input--readonly${nameErr ? ' co-input--error' : ''}`}
                  id="co-name"
                  name="name"
                  placeholder="Otomatis diisi dari alamat tersimpan"
                  readOnly
                  value={formData.name}
                  aria-readonly="true"
                />
                {nameErr && (
                  <span className="co-hint co-hint--err" id="co-name-err">{nameErr}</span>
                )}
              </div>

              <div className="co-field">
                <label className="co-label" htmlFor="co-phone">Nomor Telepon</label>
                <input
                  className={`co-input co-input--readonly${phoneErr ? ' co-input--error' : ''}`}
                  id="co-phone"
                  name="phone"
                  type="tel"
                  placeholder="Otomatis diisi dari alamat tersimpan"
                  readOnly
                  value={formData.phone}
                  aria-readonly="true"
                />
                {phoneErr && (
                  <span className="co-hint co-hint--err" id="co-phone-err">{phoneErr}</span>
                )}
              </div>

              <div className="co-field">
                <label className="co-label" htmlFor="co-address">Alamat Pengiriman</label>
                <textarea
                  className={`co-input co-textarea co-input--readonly${addressErr ? ' co-input--error' : ''}`}
                  id="co-address"
                  name="address"
                  placeholder="Otomatis diisi dari alamat tersimpan"
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
                <label className="co-label" htmlFor="co-notes">Catatan Tambahan</label>
                <textarea
                  className="co-input co-textarea"
                  id="co-notes"
                  name="notes"
                  placeholder="Instruksi khusus (opsional)"
                  rows={2}
                  value={formData.notes}
                  onChange={handleChange}
                />
              </div>

              {formAlert && (
                <div className="co-form-alert" id="co-alert">{formAlert}</div>
              )}

              <button className="co-submit-btn" type="submit" disabled={submitting}>
                {submitting ? 'Memproses...' : 'Buat Pesanan'}
              </button>

              <Link className="co-back-link" to="/cart">← Kembali ke Keranjang</Link>
            </form>
          </section>

          {/* ── Right: order summary ── */}
          <aside className="co-summary-section">
            <h2 className="co-summary-title">Ringkasan Pesanan</h2>
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
                    placeholder="Kode promo"
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }}
                    disabled={promoLoading}
                    aria-label="Kode promo"
                  />
                  <button
                    type="button"
                    className="co-promo-btn"
                    onClick={handleApplyPromo}
                    disabled={promoLoading}
                  >
                    {promoLoading ? '...' : 'Terapkan'}
                  </button>
                </div>
              ) : (
                <div className="co-promo-applied-row">
                  <span className="co-promo-applied-label">🏷️ {promoCode.trim()}</span>
                  <button type="button" className="co-promo-remove-btn" onClick={handleRemovePromo}>
                    Hapus
                  </button>
                </div>
              )}
              {promoError && <p className="co-promo-error">{promoError}</p>}
              {promoDiscount && (
                <div className="co-promo-discount-row">
                  <span>Diskon</span>
                  <span className="co-promo-discount-amount">-{formatCurrency(promoDiscount.discountAmount)}</span>
                </div>
              )}
            </div>
            <div className="co-summary-total">
              <span>Total</span>
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
