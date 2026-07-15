/**
 * CSCustomOrderSection.jsx — Custom order creation form for CS role.
 *
 * CS can create a custom order for a registered customer.
 * Flow: Waiting for Design Approval → Design Accepted → Waiting for Payment → ...
 *
 * Requirements: 11.1, 13.4
 */

import { useState, useEffect } from 'react';
import { listCustomers } from '../../../../services/auth.js';
import { createCustomOrder, deleteOrder } from '../../../../services/orders.js';
import { formatCurrency } from '../../../../utils/format.js';
import { showToast } from '../../../../core/toastEmitter.js';

let itemCounter = 0;

function newItem() {
  return { id: ++itemCounter, name: '', qty: 1, price: 0 };
}

export default function CSCustomOrderSection() {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [items, setItems] = useState([newItem()]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const customers = await listCustomers();
        setCustomers(Array.isArray(customers) ? customers : []);
      } catch (err) {
        console.error('Failed to load customers:', err);
      }
    }
    load();
  }, []);

  const selectedCustomer = customers.find((c) => c.id === customerId) || null;
  const total = items.reduce((s, i) => s + Math.max(1, i.qty) * Math.max(0, i.price), 0);

  function addItem() {
    setItems((prev) => [...prev, newItem()]);
  }

  function removeItem(id) {
    if (items.length <= 1) {
      showToast('Minimal 1 item.', 'error');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!customerId) {
      setFormError('Pilih customer terlebih dahulu.');
      return;
    }

    const validItems = [];
    for (const item of items) {
      const name = String(item.name || '').trim();
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      const price = Math.max(0, parseFloat(item.price) || 0);
      if (!name) {
        setFormError('Nama produk tidak boleh kosong.');
        return;
      }
      if (price <= 0) {
        setFormError(`Harga untuk "${name}" harus lebih dari 0.`);
        return;
      }
      validItems.push({
        id: crypto.randomUUID(),
        productId: null,
        name,
        price,
        quantity: qty,
        color: null,
        size: null,
        material: null,
        designFileName: null,
      });
    }

    if (!validItems.length) return;

    const subtotal = validItems.reduce((s, i) => s + i.price * i.quantity, 0);

    setSubmitting(true);
    try {
      const order = await createCustomOrder({
        customerId,
        customerName: selectedCustomer?.name || '',
        customerPhone: selectedCustomer?.phone || '',
        customerAddress: customerAddress.trim(),
        items: validItems,
        subtotal,
        adminNote: adminNote.trim(),
      });
      if (!order || order.ok === false) {
        setFormError(order?.message || 'Gagal membuat custom order. Coba lagi.');
        return;
      }
      setSuccessOrder(order);
      showToast('Custom order berhasil dibuat.', 'success');
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal membuat custom order. Coba lagi.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setCustomerId('');
    setCustomerAddress('');
    setAdminNote('');
    setItems([newItem()]);
    setFormError('');
    setSuccessOrder(null);
    setDeleteConfirm(false);
  }

  async function handleDelete() {
    if (!successOrder?.id) return;
    setDeleting(true);
    try {
      await deleteOrder(successOrder.id);
      showToast('Custom order berhasil dihapus.', 'success');
      setSuccessOrder(null);
      setDeleteConfirm(false);
    } catch (err) {
      showToast(err?.response?.data?.message || err.message || 'Gagal menghapus pesanan.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (successOrder) {
    return (
      <div className="adm-card offline-order-card">
        <div className="offline-receipt-card" style={{ marginTop: '20px' }}>
          <div className="offline-receipt-header">
            <div className="offline-receipt-logo">🎨 Custom Order Dibuat</div>
            <div className="offline-receipt-title">MENUNGGU KONFIRMASI DESAIN</div>
          </div>
          <div className="offline-receipt-body">
            <div className="offline-receipt-row">
              <span className="offline-receipt-key">No. Transaksi</span>
              <strong className="offline-receipt-txn">{successOrder.orderNumber}</strong>
            </div>
            <div className="offline-receipt-row">
              <span className="offline-receipt-key">Customer</span>
              <span>{selectedCustomer?.name || '—'}</span>
            </div>
            <div className="offline-receipt-row">
              <span className="offline-receipt-key">Status Awal</span>
              <span className="order-status-badge status--waiting-design">
                🎨 Waiting for Design Approval
              </span>
            </div>
            <div className="offline-receipt-row">
              <span className="offline-receipt-key">Total</span>
              <strong>{formatCurrency(successOrder.subtotal)}</strong>
            </div>
          </div>
          <div className="offline-receipt-footer">
            <p>
              Pesanan masuk ke antrian CS. Konfirmasi desain dengan customer, lalu advance
              status ke <strong>Design Accepted</strong>.
            </p>
          </div>
          <div className="offline-receipt-actions">
            <button
              className="adm-btn adm-btn--primary"
              type="button"
              onClick={handleReset}
            >
              ➕ Buat Custom Order Baru
            </button>
            <button
              className="adm-btn adm-btn--delete"
              type="button"
              onClick={() => setDeleteConfirm(true)}
              style={{ marginLeft: '8px' }}
            >
              🗑️ Hapus Pesanan Ini
            </button>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}>
            <div style={{
              background: '#fff', borderRadius: '12px', padding: '28px 32px',
              minWidth: '360px', maxWidth: '480px', width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700 }}>
                🗑️ Hapus Custom Order?
              </h3>
              <p style={{ margin: '0 0 16px', color: '#555', fontSize: '14px' }}>
                Pesanan <strong>{successOrder?.orderNumber}</strong> akan dihapus secara permanen.
                Tindakan ini tidak bisa dibatalkan.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  className="adm-btn"
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Batal
                </button>
                <button
                  className="adm-btn adm-btn--delete"
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Menghapus…' : '🗑️ Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="adm-card offline-order-card">
      <div className="adm-toolbar" style={{ marginBottom: '20px' }}>
        <h2 className="adm-section-title">➕ Buat Custom Order</h2>
        <span className="adm-date">Flow: Desain dulu → Konfirmasi → Pembayaran</span>
      </div>

      <div className="cs-custom-info-box">
        <span className="cs-custom-info-icon">ℹ️</span>
        <div>
          <strong>Custom Order Flow</strong>
          <p>
            Pesanan dimulai dari <em>Waiting for Design Approval</em>. CS konfirmasi desain
            terlebih dahulu, baru Kasir memproses pembayaran.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="offline-section-label" style={{ marginTop: '20px' }}>
          Pilih Customer Terdaftar
        </div>

        <div className="cs-customer-select-wrap">
          <div className="adm-field">
            <label className="adm-label" htmlFor="cs-customer-select">
              Customer <span className="offline-required">*</span>
            </label>
            <select
              className="adm-input"
              id="cs-customer-select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">— Pilih customer —</option>
              {customers.length === 0 ? (
                <option value="" disabled>
                  Belum ada customer terdaftar
                </option>
              ) : (
                customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone || c.email}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedCustomer && (
            <div className="cs-customer-preview" style={{ display: 'flex' }}>
              <div className="cs-customer-preview-row">
                <span className="cs-customer-preview-label">Nama</span>
                <span>{selectedCustomer.name}</span>
              </div>
              <div className="cs-customer-preview-row">
                <span className="cs-customer-preview-label">Telepon</span>
                <span>{selectedCustomer.phone || '—'}</span>
              </div>
              <div className="cs-customer-preview-row">
                <span className="cs-customer-preview-label">Email</span>
                <span>{selectedCustomer.email || '—'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="adm-field" style={{ marginTop: '14px' }}>
          <label className="adm-label" htmlFor="cs-address">
            Alamat Pengiriman
          </label>
          <input
            className="adm-input"
            id="cs-address"
            type="text"
            placeholder="Alamat lengkap (opsional)"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
          />
        </div>

        <div className="offline-section-label" style={{ marginTop: '24px' }}>
          Item Pesanan
          <button
            className="adm-btn adm-btn--primary"
            type="button"
            onClick={addItem}
            style={{ marginLeft: '12px', fontSize: '12px', padding: '5px 12px' }}
          >
            + Tambah Item
          </button>
        </div>

        <div className="adm-table-wrap" style={{ marginTop: '10px' }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th style={{ minWidth: '200px' }}>Nama Produk / Layanan</th>
                <th style={{ width: '80px' }}>Qty</th>
                <th style={{ width: '150px' }}>Harga Satuan (Rp)</th>
                <th style={{ width: '120px' }}>Subtotal</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const qty = Math.max(1, parseInt(item.qty, 10) || 1);
                const price = Math.max(0, parseFloat(item.price) || 0);
                return (
                  <tr key={item.id}>
                    <td>
                      <input
                        className="adm-input cs-item-name"
                        type="text"
                        placeholder="Nama produk / layanan custom…"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        className="adm-input cs-item-qty"
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                        style={{ width: '70px' }}
                      />
                    </td>
                    <td>
                      <input
                        className="adm-input cs-item-price"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={item.price}
                        onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                        style={{ width: '130px' }}
                      />
                    </td>
                    <td className="cs-item-subtotal adm-date">
                      {formatCurrency(qty * price)}
                    </td>
                    <td>
                      <button
                        className="adm-btn adm-btn--delete cs-remove-item"
                        type="button"
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

        <div className="offline-total-row">
          <span className="offline-total-label">Total Estimasi</span>
          <span className="offline-total-value">{formatCurrency(total)}</span>
        </div>

        <div className="adm-field" style={{ marginTop: '16px' }}>
          <label className="adm-label" htmlFor="cs-note">
            Catatan / Deskripsi Desain
          </label>
          <input
            className="adm-input"
            id="cs-note"
            type="text"
            placeholder="Deskripsi kebutuhan desain customer…"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
        </div>

        {formError && (
          <div className="offline-form-error" role="alert" style={{ display: 'block' }}>
            {formError}
          </div>
        )}

        <div className="offline-form-actions">
          <button className="adm-btn adm-btn--primary offline-submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'Memproses…' : '🎨 Buat Custom Order'}
          </button>
          <button
            className="adm-btn offline-reset-btn"
            type="button"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
