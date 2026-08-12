/**
 * OfflineOrderSection.jsx — Form input order offline untuk cashier.
 *
 * Tidak menggunakan modal — form langsung ditampilkan di halaman.
 * Setelah submit berhasil, menampilkan ringkasan order, tombol reset,
 * tombol PDF invoice, tombol print resi, dan opsional kirim email.
 */

import { useState, useEffect, useRef } from 'react';
import { api } from '../../../../core/httpClient.js';
import { formatCurrency } from '../../../../utils/format.js';
import { showToast } from '../../../../core/toastEmitter.js';
import { getInvoiceByOrderId, openInvoicePdf, sendInvoiceEmail } from '../../../../services/api/invoiceService.js';
import { searchProducts } from '../../../../services/products.js';
import ThermalReceiptModal from '../../../modals/ThermalReceiptModal.jsx';

function makeItem() {
  return {
    id: crypto.randomUUID(),
    productId: null,
    name: '',
    priceCustomer: '',
    priceBroker: '',
    price: '',
    quantity: 1,
    notes: '',
    sizeType: 'fixed',
    lengthCm: '',
    widthCm: '',
  };
}

function priceForType(item, customerType) {
  if (customerType === 'broker') {
    return item.priceBroker !== '' && item.priceBroker !== undefined && item.priceBroker !== null
      ? Number(item.priceBroker)
      : Number(item.price);
  }
  return item.priceCustomer !== '' && item.priceCustomer !== undefined && item.priceCustomer !== null
    ? Number(item.priceCustomer)
    : Number(item.price);
}

/**
 * Harga satuan final item:
 * - Item katalog: harga dasar sesuai customer_type (customer/broker).
 * - Item manual: harga yang diketik cashier.
 */
function resolveUnitPrice(item, customerType) {
  if (!item.productId) return Number(item.price) || 0;
  return priceForType(item, customerType);
}

/* ── Harga produk per m² ──────────────────────────────────────────────────── */

function parseNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Luas (m²) dalam desimal, tanpa pembulatan ke atas:
 * (panjang_cm × lebar_cm) / 10000 — mis. 200cm × 20cm = 0,4 m².
 * Dibulatkan ke 4 desimal hanya untuk membersihkan error float.
 * Return 0 jika dimensi belum lengkap.
 */
function billedAreaM2(lengthCm, widthCm) {
  const l = parseNumber(lengthCm);
  const w = parseNumber(widthCm);
  if (!l || !w) return 0;
  return Math.round((l / 100) * (w / 100) * 10000) / 10000;
}

/** Total harga panel = luas (m²) × harga per m² (dibulatkan ke Rupiah). 0 jika dimensi belum lengkap. */
function perM2LineTotal(item) {
  const area = billedAreaM2(item.lengthCm, item.widthCm);
  if (area <= 0) return 0;
  return Math.round(area * (Number(item.price) || 0));
}

/**
 * Harga yang tampil di kotak "Harga":
 * - per m² → harga dasar per m² sesuai customer_type (bukan total panel).
 * - fixed  → harga varian (jika ada) atau harga dasar.
 */
function computeLinePrice(item, customerType) {
  if (item.sizeType === 'per_m2') return priceForType(item, customerType);
  return resolveUnitPrice(item, customerType);
}

/** Total line item (termasuk qty). Per m² = luas × harga/m² × qty. */
function itemLineTotal(item) {
  const qty = Number(item.quantity) || 1;
  if (item.sizeType === 'per_m2') return perM2LineTotal(item) * qty;
  return (Number(item.price) || 0) * qty;
}

/* ── Autocomplete produk (search + dropdown) ───────────────────────────────── */

function ProductAutocomplete({ item, customerType, error, onSelect, onClear }) {
  const [query, setQuery] = useState(item.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function handleQueryChange(val) {
    setQuery(val);
    if (item.productId) return; // terkunci ke produk terpilih
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchProducts(val);
        setResults(res || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSelect(prod) {
    const priceCustomer = Number(prod.price_customer ?? prod.priceCustomer ?? 0);
    const priceBroker   = Number(prod.price_broker   ?? prod.priceBroker   ?? 0);
    setQuery(prod.name);
    setOpen(false);
    onSelect({
      productId: prod.id,
      name: prod.name,
      priceCustomer,
      priceBroker,
      price: customerType === 'broker' ? priceBroker : priceCustomer,
      sizeType: prod.size_type ?? prod.sizeType ?? 'fixed',
      lengthCm: '',
      widthCm: '',
    });
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setOpen(false);
    onClear();
  }

  return (
    <div className="offline-autocomplete" ref={wrapRef}>
      {item.productId ? (
        <div className="offline-locked-product">
          <input
            className="adm-input offline-item-name"
            type="text"
            value={query}
            readOnly
            title="Produk dari katalog — hapus untuk pilih yang lain"
          />
          <span className="offline-lock-badge">🔒</span>
          <button
            type="button"
            className="offline-clear-product"
            onClick={handleClear}
            aria-label="Hapus pilihan produk"
          >
            ✕
          </button>
        </div>
      ) : (
        <input
          className={`adm-input offline-item-name${error ? ' adm-input--error' : ''}`}
          type="text"
          placeholder="Ketik nama produk untuk mencari…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          autoComplete="off"
        />
      )}
      {open && !item.productId && (
        <div className="offline-search-dropdown">
          {loading && (
            <div className="offline-search-empty">Mencari…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="offline-search-empty">
              {query.trim() ? 'Tidak ada produk ditemukan.' : 'Ketik minimal 1 karakter…'}
            </div>
          )}
          {!loading && results.map((prod) => {
            const pCust = Number(prod.price_customer ?? prod.priceCustomer ?? 0);
            const pBrok = Number(prod.price_broker   ?? prod.priceBroker   ?? 0);
            return (
              <button
                type="button"
                key={prod.id}
                className="offline-search-item"
                onClick={() => handleSelect(prod)}
              >
                <span className="offline-search-name">{prod.name}</span>
                <span className="offline-search-meta">
                  {prod.category ? `${prod.category} · ` : ''}
                  {formatCurrency(customerType === 'broker' ? pBrok : pCust)}
                  {(prod.size_type ?? prod.sizeType ?? 'fixed') === 'per_m2' ? ' / m²' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SuccessCard({ order, onReset }) {
  const items = order.items || [];
  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [thermalOpen, setThermalOpen] = useState(false);

  async function loadInvoice() {
    if (invoice || invoiceLoading) return;
    setInvoiceLoading(true);
    try {
      const inv = await getInvoiceByOrderId(order.id);
      if (inv) setInvoice(inv);
    } catch {
      // Invoice mungkin belum siap, retry sekali
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const inv = await getInvoiceByOrderId(order.id);
        if (inv) setInvoice(inv);
      } catch {
        showToast('Invoice belum tersedia, coba lagi sebentar.', 'error');
      }
    } finally {
      setInvoiceLoading(false);
    }
  }

  async function handleOpenPdf() {
    await loadInvoice();
    if (!invoice) {
      showToast('Invoice belum tersedia.', 'error');
      return;
    }
    try {
      await openInvoicePdf(invoice.id);
    } catch {
      showToast('Gagal membuka PDF invoice.', 'error');
    }
  }

  async function handlePrintReceipt() {
    await loadInvoice();
    if (!invoice) {
      showToast('Invoice belum tersedia.', 'error');
      return;
    }
    setThermalOpen(true);
  }

  async function handleSendEmail() {
    await loadInvoice();
    if (!invoice) {
      showToast('Invoice belum tersedia.', 'error');
      return;
    }
    setEmailSending(true);
    try {
      await sendInvoiceEmail(invoice.id);
      setInvoiceSent(true);
      showToast('Invoice berhasil dikirim ke email customer.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal mengirim email.', 'error');
    } finally {
      setEmailSending(false);
    }
  }

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
        {items.map((item, i) => {
          const attrs = [item.notes].filter(Boolean);
          return (
            <div key={item.id || i} className="offline-receipt-mini-row">
              <span className="offline-receipt-mini-key">
                {item.name}{attrs.length > 0 ? ` · ${attrs.join(', ')}` : ''} ×{item.quantity}
              </span>
              <span className="offline-receipt-mini-val">{formatCurrency(Number(item.price) * Number(item.quantity))}</span>
            </div>
          );
        })}
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

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '12px' }}>
        <button
          type="button"
          className="adm-btn adm-btn--secondary"
          onClick={handleOpenPdf}
          disabled={invoiceLoading}
        >
          📄 Invoice PDF
        </button>
        <button
          type="button"
          className="adm-btn adm-btn--thermal"
          onClick={handlePrintReceipt}
          disabled={invoiceLoading}
        >
          🖨️ Print Resi
        </button>
        {order.customer_email && !invoiceSent && (
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={handleSendEmail}
            disabled={emailSending || invoiceLoading}
          >
            {emailSending ? 'Mengirim…' : '📧 Kirim Invoice'}
          </button>
        )}
      </div>

      <button
        type="button"
        className="adm-btn adm-btn--primary offline-reset-btn"
        onClick={onReset}
        style={{ marginTop: '16px' }}
      >
        ➕ Input Order Baru
      </button>

      {thermalOpen && invoice && (
        <ThermalReceiptModal invoice={invoice} onClose={() => setThermalOpen(false)} />
      )}
    </div>
  );
}

export default function OfflineOrderSection() {
  const [customerName,    setCustomerName]    = useState('');
  const [customerPhone,   setCustomerPhone]   = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerEmail,   setCustomerEmail]   = useState('');
  const [adminNote,       setAdminNote]       = useState('');
  const [customerType,    setCustomerType]    = useState('customer');
  const [items,           setItems]           = useState([makeItem()]);
  const [submitting,      setSubmitting]      = useState(false);
  const [fieldErrors,     setFieldErrors]     = useState({});
  const [createdOrder,    setCreatedOrder]    = useState(null);

  const subtotal = items.reduce(
    (sum, it) => sum + itemLineTotal(it),
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

  function updateItemFields(id, patch) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
    if (fieldErrors[`item_${id}_name`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`item_${id}_name`];
        return next;
      });
    }
  }

  function handleSelectProduct(id, patch) {
    updateItemFields(id, patch);
    if (fieldErrors[`item_${id}_name`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`item_${id}_name`];
        return next;
      });
    }
  }

  function handleClearProduct(id) {
    updateItemFields(id, {
      productId: null,
      name: '',
      priceCustomer: '',
      priceBroker: '',
      price: '',
      sizeType: 'fixed',
      lengthCm: '',
      widthCm: '',
    });
  }

  function handleCustomerTypeChange(value) {
    setCustomerType(value);
    // Saat tipe pembeli diganti, harga satuan item dari katalog ikut ter-update.
    setItems((prev) =>
      prev.map((it) => {
        if (!it.productId) return it;
        return { ...it, price: computeLinePrice(it, value) };
      })
    );
  }

  function handleDimensionChange(id, field, value) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
    ['lengthCm', 'widthCm'].forEach((f) => {
      if (fieldErrors[`item_${id}_${f}`]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[`item_${id}_${f}`];
          return next;
        });
      }
    });
  }

  function validate() {
    const errors = {};
    if (!customerName.trim()) errors.customerName = 'Nama customer wajib diisi.';
    items.forEach((it) => {
      if (!it.name.trim()) errors[`item_${it.id}_name`] = 'Nama produk wajib diisi.';
      if (it.sizeType === 'per_m2') {
        if (!parseNumber(it.lengthCm)) errors[`item_${it.id}_lengthCm`] = 'Panjang (cm) wajib diisi.';
        if (!parseNumber(it.widthCm))  errors[`item_${it.id}_widthCm`]  = 'Lebar (cm) wajib diisi.';
        if (!(Number(it.price) > 0)) errors[`item_${it.id}_price`] = 'Harga per m² tidak valid.';
      } else if (!it.price || Number(it.price) <= 0) {
        errors[`item_${it.id}_price`] = 'Harga wajib diisi.';
      }
      if (!it.quantity || Number(it.quantity) < 1) errors[`item_${it.id}_quantity`] = 'Qty minimal 1.';
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
        productId: it.productId || null,
        name:      it.name.trim(),
        price:     Number(it.price),
        quantity:  Number(it.quantity) || 1,
        notes:     (it.notes || '').trim() || null,
        lengthCm:  it.sizeType === 'per_m2' ? (parseNumber(it.lengthCm) || null) : null,
        widthCm:   it.sizeType === 'per_m2' ? (parseNumber(it.widthCm)  || null) : null,
      }));

      const res = await api.post('/api/orders/offline', {
        customerName:    customerName.trim(),
        customerPhone:   customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        customerEmail:   customerEmail.trim(),
        adminNote:       adminNote.trim(),
        customerType,
        items:           validItems,
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
    setCustomerEmail('');
    setAdminNote('');
    setCustomerType('customer');
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
    <div className="adm-card offline-scrollable">
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
              <label className="offline-form-label">
                Tipe Pembeli <span className="offline-required">*</span>
              </label>
              <select
                className="adm-input"
                value={customerType}
                onChange={(e) => handleCustomerTypeChange(e.target.value)}
              >
                <option value="customer">Customer</option>
                <option value="broker">Broker</option>
              </select>
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

            <div className="offline-form-field">
              <label className="offline-form-label">Email (untuk kirim invoice)</label>
              <input
                className="adm-input"
                type="email"
                placeholder="email@customer.com (opsional)…"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
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

          {items.map((item, index) => {
            const itemSub = itemLineTotal(item);
            const nameErr  = fieldErrors[`item_${item.id}_name`];
            const priceErr = fieldErrors[`item_${item.id}_price`];
            const lenErr   = fieldErrors[`item_${item.id}_lengthCm`];
            const widErr   = fieldErrors[`item_${item.id}_widthCm`];
            const isPerM2  = item.sizeType === 'per_m2';
            return (
              <div key={item.id} className="offline-item-card">
                <div className="offline-item-card-head">
                  <span className="offline-item-card-title">Item {index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="offline-item-remove"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Hapus item ${index + 1}`}
                    >
                      🗑 Hapus
                    </button>
                  )}
                </div>

                <div className="offline-item-card-body">
                  <div className="offline-price-row">
                    <div className="offline-price-cell offline-price-cell--name">
                      <label className="offline-form-label">
                        Nama Produk / Layanan <span className="offline-required">*</span>
                      </label>
                      <ProductAutocomplete
                        item={item}
                        customerType={customerType}
                        error={nameErr}
                        onSelect={(patch) => handleSelectProduct(item.id, patch)}
                        onClear={() => handleClearProduct(item.id)}
                      />
                      {nameErr && <span className="offline-field-error">{nameErr}</span>}
                    </div>
                    <div className="offline-price-cell">
                      <label className="offline-form-label">
                        {isPerM2 ? 'Harga Per m² (Rp)' : 'Harga Satuan (Rp)'}
                      </label>
                      {item.productId ? (
                        <input
                          className={`adm-input${priceErr ? ' adm-input--error' : ''}`}
                          type="number"
                          min="0"
                          placeholder="0"
                          value={item.price}
                          readOnly
                          title={isPerM2
                            ? 'Harga per m² dari katalog — total = luas × harga/m²'
                            : 'Harga otomatis dari katalog sesuai tipe pembeli'}
                        />
                      ) : (
                        <input
                          className={`adm-input${priceErr ? ' adm-input--error' : ''}`}
                          type="number"
                          min="0"
                          placeholder="0"
                          value={item.price}
                          onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                        />
                      )}
                      {priceErr && <span className="offline-field-error">{priceErr}</span>}
                    </div>
                    <div className="offline-price-cell">
                      <label className="offline-form-label">Qty</label>
                      <input
                        className="adm-input"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="offline-price-cell offline-price-cell--sub">
                      <label className="offline-form-label">Subtotal</label>
                      <span className="offline-card-subtotal">{formatCurrency(itemSub)}</span>
                    </div>
                  </div>

                  {isPerM2 && (
                    <div className="offline-item-attrs offline-item-attrs--dims">
                      <div className="offline-item-attr">
                        <label className="offline-item-attr-label">Panjang (cm)</label>
                        {!item.productId ? (
                          <input
                            className="adm-input offline-item-attr-input"
                            type="text"
                            value="Produk belum dipilih"
                            disabled
                            title="Pilih produk terlebih dahulu"
                          />
                        ) : (
                          <input
                            className={`adm-input offline-item-attr-input${lenErr ? ' adm-input--error' : ''}`}
                            type="number"
                            min="0"
                            step="any"
                            placeholder="mis. 120"
                            value={item.lengthCm}
                            onChange={(e) => handleDimensionChange(item.id, 'lengthCm', e.target.value)}
                          />
                        )}
                        {lenErr && <span className="offline-field-error">{lenErr}</span>}
                      </div>
                      <div className="offline-item-dims-x" aria-hidden="true">×</div>
                      <div className="offline-item-attr">
                        <label className="offline-item-attr-label">Lebar (cm)</label>
                        {!item.productId ? (
                          <input
                            className="adm-input offline-item-attr-input"
                            type="text"
                            value="Produk belum dipilih"
                            disabled
                            title="Pilih produk terlebih dahulu"
                          />
                        ) : (
                          <input
                            className={`adm-input offline-item-attr-input${widErr ? ' adm-input--error' : ''}`}
                            type="number"
                            min="0"
                            step="any"
                            placeholder="mis. 80"
                            value={item.widthCm}
                            onChange={(e) => handleDimensionChange(item.id, 'widthCm', e.target.value)}
                          />
                        )}
                        {widErr && <span className="offline-field-error">{widErr}</span>}
                      </div>
                      <div className="offline-item-attr offline-item-attr--luas">
                        <label className="offline-item-attr-label">Luas (m²)</label>
                        <div className="offline-item-luas-value">
                          {billedAreaM2(item.lengthCm, item.widthCm) > 0
                            ? billedAreaM2(item.lengthCm, item.widthCm)
                            : '—'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="offline-item-field">
                    <label className="offline-form-label">
                      Keterangan <span className="offline-optional">(opsional)</span>
                    </label>
                    <textarea
                      className="adm-input offline-item-notes"
                      rows={2}
                      placeholder="Keterangan item…"
                      value={item.notes}
                      onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                    />
                  </div>

                </div>
              </div>
            );
          })}

          <div className="offline-order-total-row">
            <span>Total ({items.length} item{items.length !== 1 ? 's' : ''})</span>
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
