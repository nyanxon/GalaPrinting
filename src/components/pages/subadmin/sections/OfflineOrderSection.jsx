/**
 * OfflineOrderSection.jsx — Form input order offline untuk cashier.
 *
 * Tidak menggunakan modal — form langsung ditampilkan di halaman.
 * Setelah submit berhasil, menampilkan ringkasan order dan tombol reset.
 */

import { useState } from 'react';
import { api } from '../../../../core/httpClient.js';
import { formatCurrency } from '../../../../core/helpers.js';
import { showToast } from '../../../../core/toastEmitter.js';

function makeItem() {
  return { id: crypto.randomUUID(), name: '', price: '', quantity: 1 };
}

function SuccessCard({ order, onReset }) {
  const items = order.items || [];
  const subtotal = Number(order.subtotal ?? order.total ?? 0);

  return (
    <div className="offline-success-card">
      <div className="offline-success-icon">✅</div>
      <div className="offline-success-title">Order Offline Berhasil Dibuat</div>

      <div className="offline-receipt-mini">
        <div className="offline-receipt-mini-row">
          <span className="offline-receipt-mini-key">No. Transaksi</span>
          <code className="offline-receipt-mini-val">{order.order_number || order.orderNumber}</code>
        </div>
        <div className="offline-receipt-mini-row">
          <span className="offline-receipt-mini-key">Customer</span>
          <span className="offline-receipt-mini-val">{order.customer_name || order.customer?.name || '—'}</span>
        </div>
        {(order.customer_phone || order.customer?.phone) && (
          <div className="offline-receipt-mini-row">
            <span className="offline-receipt-mini-key">Telepon</span>
            <span className="offline-receipt-mini-val">{order.customer_phone || order.customer?.phone}</span>
          </div>
        )}
        <div className="offline-receipt-mini-divider" />
        {items.map((item, i) => (
          <div key={item.id || i} className="offline-receipt-mini-row">
            <span className="offline-receipt-mini-key">{item.name} ×{item.quantity}</span>
            <span className="offline-receipt-mini-val">{formatCurrency(Number(item.price) * Number(item.quantity))}</span>
          </div>
        ))}
        <div className="offline-receipt-mini-divider" />
        <div className="offline-receipt-mini-row offline-receipt-mini-row--total">
          <span className="offline-receipt-mini-key">TOTAL</span>
          <strong className="offline-receipt-mini-val">{formatCurrency(subtotal)}</strong>
        </div>
        <div className="offline-receipt-mini-row" style={{ marginTop: '6px' }}>
          <span className="offline-receipt-mini-key">Status</span>
          <span className="offline-status-badge">On Progress</span>
        </div>
      </div>

      <button
        type="button"
        className="adm-btn adm-btn--primary offline-reset-btn"
        onClick={onReset}
      >
        ➕ Input Order Baru
      </button>
    </div>
  );
}

export default function OfflineOrderSection() {
  const [customerName,    setCustomerName]    = useState('');
  const [customerPhone,   setCustomerPhone]   = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [adminNote,       setAdminNote]       = useState('');
  const [items,           setItems]           = useState([makeItem()]);
  const [submitting,      setSubmitting]      = useState(false);
  const [fieldErrors,     setFieldErrors]     = useState({});
  const [createdOrder,    setCreatedOrder]    = useState(null);

  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0
  );

  function addItem() {
    setItems((prev) => [...prev, makeItem()]);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
    // hapus error item saat diubah
    if (fieldErrors[`item_${id}_${field}`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`item_${id}_${field}`];
        return next;
      });
    }
  }

  function validate() {
    const errors = {};
    if (!customerName.trim()) errors.customerName = 'Nama customer wajib diisi.';
    items.forEach((it) => {
      if (!it.name.trim()) errors[`item_${it.id}_name`] = 'Nama produk wajib diisi.';
      if (!it.price || Number(it.price) <= 0) errors[`item_${it.id}_price`] = 'Harga wajib diisi.';
    });
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      const validItems = items.map((it) => ({
        name:     it.name.trim(),
        price:    Number(it.price),
        quantity: Number(it.quantity) || 1,
      }));

      const res = await api.post('/api/orders/offline', {
        customerName:    customerName.trim(),
        customerPhone:   customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        adminNote:       adminNote.trim(),
        items:           validItems,
        subtotal,
      });

      setCreatedOrder(res.data.data);
      showToast(`Order offline ${res.data.data.order_number} berhasil dibuat.`, 'success');
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal membuat order offline.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setCreatedOrder(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setAdminNote('');
    setItems([makeItem()]);
    setFieldErrors({});
  }

  if (createdOrder) {
    return (
      <div className="adm-card">
        <SuccessCard order={createdOrder} onReset={handleReset} />
      </div>
    );
  }

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">🏪 Input Order Offline</h2>
      </div>

      <form className="offline-form" onSubmit={handleSubmit} noValidate>
        {/* ── Data Customer ── */}
        <section className="offline-form-section">
          <div className="offline-form-section-title">👤 Data Customer</div>
          <div className="offline-form-grid">
            <div className="offline-form-field">
              <label className="offline-form-label">
                Nama Customer <span className="offline-required">*</span>
              </label>
              <input
                className={`adm-input${fieldErrors.customerName ? ' adm-input--error' : ''}`}
                type="text"
                placeholder="Nama customer…"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (fieldErrors.customerName) setFieldErrors((p) => ({ ...p, customerName: null }));
                }}
              />
              {fieldErrors.customerName && (
                <span className="offline-field-error">{fieldErrors.customerName}</span>
              )}
            </div>

            <div className="offline-form-field">
              <label className="offline-form-label">No. Telepon</label>
              <input
                className="adm-input"
                type="tel"
                placeholder="0812xxxxxxxx"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="offline-form-field" style={{ marginTop: '12px' }}>
            <label className="offline-form-label">Alamat</label>
            <input
              className="adm-input"
              type="text"
              placeholder="Alamat customer (opsional)…"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
            />
          </div>
        </section>

        {/* ── Item Pesanan ── */}
        <section className="offline-form-section">
          <div className="offline-form-section-header">
            <div className="offline-form-section-title">📦 Item Pesanan</div>
            <button
              type="button"
              className="adm-btn"
              style={{ padding: '5px 14px', fontSize: '13px' }}
              onClick={addItem}
            >
              + Tambah Item
            </button>
          </div>

          {/* Header kolom */}
          <div className="offline-items-header">
            <span className="offline-items-col offline-items-col--name">Nama Produk / Layanan</span>
            <span className="offline-items-col offline-items-col--price">Harga Satuan (Rp)</span>
            <span className="offline-items-col offline-items-col--qty">Qty</span>
            <span className="offline-items-col offline-items-col--sub">Subtotal</span>
            <span className="offline-items-col offline-items-col--del" />
          </div>

          {items.map((item) => {
            const itemSub = (Number(item.price) || 0) * (Number(item.quantity) || 1);
            const nameErr  = fieldErrors[`item_${item.id}_name`];
            const priceErr = fieldErrors[`item_${item.id}_price`];
            return (
              <div key={item.id} className="offline-item-row">
                <div className="offline-items-col offline-items-col--name">
                  <input
                    className={`adm-input${nameErr ? ' adm-input--error' : ''}`}
                    type="text"
                    placeholder="Nama produk…"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                  />
                  {nameErr && <span className="offline-field-error">{nameErr}</span>}
                </div>
                <div className="offline-items-col offline-items-col--price">
                  <input
                    className={`adm-input${priceErr ? ' adm-input--error' : ''}`}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={item.price}
                    onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                  />
                  {priceErr && <span className="offline-field-error">{priceErr}</span>}
                </div>
                <div className="offline-items-col offline-items-col--qty">
                  <input
                    className="adm-input"
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                  />
                </div>
                <div className="offline-items-col offline-items-col--sub">
                  <span className="offline-item-subtotal">{formatCurrency(itemSub)}</span>
                </div>
                <div className="offline-items-col offline-items-col--del">
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="offline-item-remove"
                      onClick={() => removeItem(item.id)}
                      aria-label="Hapus item"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div className="offline-subtotal-row">
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
        </section>

        {/* ── Catatan Admin ── */}
        <section className="offline-form-section">
          <div className="offline-form-section-title">📋 Catatan Admin</div>
          <textarea
            className="adm-input"
            rows={3}
            placeholder="Catatan internal (opsional)…"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </section>

        <div className="offline-form-actions">
          <button
            type="button"
            className="adm-btn"
            onClick={handleReset}
            disabled={submitting}
          >
            Reset
          </button>
          <button
            type="submit"
            className="adm-btn adm-btn--primary"
            disabled={submitting}
          >
            {submitting ? 'Menyimpan…' : '💾 Simpan Order Offline'}
          </button>
        </div>
      </form>
    </div>
  );
}
