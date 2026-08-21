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
import { searchProducts, parseAttributes } from '../../../../services/products.js';
import { parseNumber, billedAreaM2 } from '../../../../utils/billing.js';
import { computeOneDiscount, discountTotalFor, parseDiscountRows } from '../../../../utils/discounts.js';
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
    attrDefs: [],
    selectedAttrs: {},
  };
}

/** Baris diskon baru — scope default: subtotal order. */
function makeDiscountRow() {
  return {
    id: crypto.randomUUID(),
    scope: 'order',
    type: 'percentage',
    value: '',
    label: '',
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
 * Total modifier harga dari atribut terpilih — mirror dari
 * sumSelectedAttributeModifiers() di products.service.js (server).
 * Hanya atribut affectsPrice=true yang menyumbang modifier.
 */
function selectedModifierTotal(attrDefs, selectedAttrs) {
  if (!Array.isArray(attrDefs) || !selectedAttrs) return 0;
  return attrDefs.reduce((sum, attr) => {
    if (!attr || !attr.affectsPrice) return sum;
    const picked = String(selectedAttrs[attr.name] ?? '').trim();
    if (!picked) return sum;
    const match = (attr.values || []).find((v) => v.value === picked);
    return sum + (Number(match?.priceModifier) || 0);
  }, 0);
}

/**
 * Harga satuan final item:
 * - Item katalog: harga dasar sesuai customer_type (customer/broker)
 *   + total modifier atribut affectsPrice=true yang dipilih
 *   (sama seperti perhitungan harga di halaman produk customer).
 * - Item manual: harga yang diketik cashier.
 */
function resolveUnitPrice(item, customerType) {
  if (!item.productId) return Number(item.price) || 0;
  return priceForType(item, customerType) + selectedModifierTotal(item.attrDefs, item.selectedAttrs);
}

/* ── Harga produk per m² ──────────────────────────────────────────────────── */

/** Total harga panel = luas (m²) × harga per m² (dibulatkan ke Rupiah)
 *  + modifier atribut flat per panel. 0 jika dimensi belum lengkap. */
function perM2LineTotal(item) {
  const area = billedAreaM2(item.lengthCm, item.widthCm);
  if (area <= 0) return 0;
  return (
    Math.round(area * (Number(item.price) || 0)) +
    selectedModifierTotal(item.attrDefs, item.selectedAttrs)
  );
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
      attrDefs: parseAttributes(prod.attributes),
      selectedAttrs: {},
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
  // Rincian diskon manual (mirror rumus server: gross, additive, clamp).
  const itemDiscRows = items.map((it) => parseDiscountRows(it.discounts));
  const itemDiscTotal = items.reduce((s, it, i) => {
    if (itemDiscRows[i].length === 0) return s;
    return s + discountTotalFor(itemDiscRows[i], Number(it.price || 0) * Number(it.quantity || 1));
  }, 0);
  const orderDiscRows = parseDiscountRows(order.discounts);
  const subtotalDisc = discountTotalFor(orderDiscRows, subtotal);
  const totalAfterDiscount = Math.max(0, subtotal - itemDiscTotal - subtotalDisc);
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
          const discAmt = itemDiscRows[i].length > 0
            ? discountTotalFor(itemDiscRows[i], Number(item.price || 0) * Number(item.quantity || 1))
            : 0;
          return (
            <div key={item.id || i} className="offline-receipt-mini-row">
              <span className="offline-receipt-mini-key">
                {item.name}{attrs.length > 0 ? ` · ${attrs.join(', ')}` : ''} ×{item.quantity}
                {discAmt > 0 && (
                  <span style={{ display: 'block', fontSize: '12px', color: '#15803d' }}>
                    Diskon: -{formatCurrency(discAmt)}
                  </span>
                )}
              </span>
              <span className="offline-receipt-mini-val">{formatCurrency(Number(item.price) * Number(item.quantity))}</span>
            </div>
          );
        })}
        <div className="offline-receipt-mini-divider" />
        {(itemDiscTotal > 0 || subtotalDisc > 0) && (
          <>
            <div className="offline-receipt-mini-row">
              <span className="offline-receipt-mini-key">Subtotal</span>
              <span className="offline-receipt-mini-val">{formatCurrency(subtotal)}</span>
            </div>
            {itemDiscTotal > 0 && (
              <div className="offline-receipt-mini-row">
                <span className="offline-receipt-mini-key">Diskon item</span>
                <span className="offline-receipt-mini-val">-{formatCurrency(itemDiscTotal)}</span>
              </div>
            )}
            {orderDiscRows.map((d, i) => {
              const amt = discountTotalFor([d], subtotal);
              if (amt <= 0) return null;
              const jenis = d.type === 'percentage' ? `${d.value}%` : formatCurrency(d.value);
              return (
                <div key={i} className="offline-receipt-mini-row">
                  <span className="offline-receipt-mini-key">Diskon {d.label ? `${d.label} (` : '('}{jenis})</span>
                  <span className="offline-receipt-mini-val">-{formatCurrency(amt)}</span>
                </div>
              );
            })}
          </>
        )}
        <div className="offline-receipt-mini-row offline-receipt-mini-row--total">
          <span className="offline-receipt-mini-key">TOTAL</span>
          <strong className="offline-receipt-mini-val">{formatCurrency(totalAfterDiscount)}</strong>
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
  const [discounts,       setDiscounts]       = useState([]);
  const [submitting,      setSubmitting]      = useState(false);
  const [fieldErrors,     setFieldErrors]     = useState({});
  const [createdOrder,    setCreatedOrder]    = useState(null);

  // ── Preview hitungan diskon (mirror rumus server: gross, additive, clamp) ──
  const grossList     = items.map((it) => itemLineTotal(it));
  const subtotalGross = grossList.reduce((s, g) => s + g, 0);
  const itemDiscTotals = items.map((it, i) =>
    discountTotalFor(
      discounts.filter((d) => d.scope === it.id),
      grossList[i]
    )
  );
  const subtotalDiscount = discountTotalFor(
    discounts.filter((d) => d.scope === 'order'),
    subtotalGross
  );
  const totalDiscount =
    itemDiscTotals.reduce((s, d) => s + d, 0) + subtotalDiscount;
  const finalTotal = Math.max(0, subtotalGross - totalDiscount);

  function addItem() {
    setItems((prev) => [...prev, makeItem()]);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    // Buang baris diskon yang scope-nya item yang dihapus (cegah orphan).
    setDiscounts((prev) => prev.filter((d) => d.scope !== id));
  }

  function addDiscountRow() {
    setDiscounts((prev) => [...prev, makeDiscountRow()]);
  }

  function removeDiscountRow(id) {
    setDiscounts((prev) => prev.filter((d) => d.id !== id));
    setFieldErrors((prev) => {
      if (!prev[`disc_${id}_value`]) return prev;
      const next = { ...prev };
      delete next[`disc_${id}_value`];
      return next;
    });
  }

  function updateDiscountRow(id, field, value) {
    setDiscounts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
    const errKey = `disc_${id}_value`;
    if (fieldErrors[errKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
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
      attrDefs: [],
      selectedAttrs: {},
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

  function handleAttributeChange(id, attrName, value) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, selectedAttrs: { ...it.selectedAttrs, [attrName]: value } };
        // Harga satuan item fixed ikut ter-update saat pilihan atribut berubah.
        if (it.sizeType !== 'per_m2') {
          next.price = computeLinePrice(next, customerType);
        }
        return next;
      })
    );
    const errKey = `item_${id}_attr_${attrName}`;
    if (fieldErrors[errKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
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
      // Atribut dinamis: sama seperti alur customer, semua atribut wajib dipilih.
      if (it.productId && Array.isArray(it.attrDefs)) {
        it.attrDefs.forEach((attr) => {
          if (!attr?.name) return;
          if (!it.selectedAttrs?.[attr.name]) {
            errors[`item_${it.id}_attr_${attr.name}`] = `${attr.name} wajib dipilih.`;
          }
        });
      }
    });
    // Validasi baris diskon (UX cepat — validasi final tetap di server):
    // percentage 0-100, nominal >= 0.
    discounts.forEach((d) => {
      const v = Number(d.value);
      if (d.value === '' || !Number.isFinite(v)) {
        errors[`disc_${d.id}_value`] = 'Nilai diskon wajib diisi.';
      } else if (d.type === 'percentage' && (v < 0 || v > 100)) {
        errors[`disc_${d.id}_value`] = 'Persentase harus 0-100.';
      } else if (d.type === 'nominal' && v < 0) {
        errors[`disc_${d.id}_value`] = 'Nominal tidak boleh negatif.';
      }
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
      // Baris diskon dipetakan ke scope-nya; client HANYA mengirim
      // type+value+label — hasil hitungan ditentukan server.
      const toDiscountPayload = (rows) =>
        rows.map((d) => ({
          type: d.type,
          value: Number(d.value),
          label: (d.label || '').trim(),
        }));
      const orderLevelRows = toDiscountPayload(discounts.filter((d) => d.scope === 'order'));

      const validItems = items.map((it) => ({
        productId: it.productId || null,
        name:      it.name.trim(),
        price:     Number(it.price),
        quantity:  Number(it.quantity) || 1,
        notes:     (it.notes || '').trim() || null,
        lengthCm:  it.sizeType === 'per_m2' ? (parseNumber(it.lengthCm) || null) : null,
        widthCm:   it.sizeType === 'per_m2' ? (parseNumber(it.widthCm)  || null) : null,
        attributes:
          it.productId && Array.isArray(it.attrDefs) && it.attrDefs.length > 0
            ? it.attrDefs
                .filter((a) => a?.name)
                .map((a) => ({ name: a.name, value: String(it.selectedAttrs[a.name] ?? '') }))
                .filter((a) => a.value)
            : undefined,
        discounts: (() => {
          const rows = discounts.filter((d) => d.scope === it.id);
          return rows.length > 0 ? toDiscountPayload(rows) : undefined;
        })(),
      }));

      const res = await api.post('/api/orders/offline', {
        customerName:    customerName.trim(),
        customerPhone:   customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        customerEmail:   customerEmail.trim(),
        adminNote:       adminNote.trim(),
        customerType,
        items:           validItems,
        discounts:       orderLevelRows.length > 0 ? orderLevelRows : undefined,
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
    setDiscounts([]);
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
            const itemDisc = itemDiscTotals[index] || 0;
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
                        Nama Produk <span className="offline-required">*</span>
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
                      {itemDisc > 0 && (
                        <>
                          <span className="offline-card-disc" title="Total diskon item ini">
                            Diskon: -{formatCurrency(itemDisc)}
                          </span>
                          <span className="offline-card-net">Net: {formatCurrency(itemSub - itemDisc)}</span>
                        </>
                      )}
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

                  {item.productId && Array.isArray(item.attrDefs) && item.attrDefs.length > 0 && (
                    <div className="offline-item-attrs">
                      {item.attrDefs.map((attr) => {
                        if (!attr?.name) return null;
                        const attrErr = fieldErrors[`item_${item.id}_attr_${attr.name}`];
                        return (
                          <div key={attr.name} className="offline-item-attr">
                            <label className="offline-item-attr-label">{attr.name}</label>
                            <select
                              className={`adm-input offline-item-attr-input${attrErr ? ' adm-input--error' : ''}`}
                              value={item.selectedAttrs[attr.name] || ''}
                              onChange={(e) => handleAttributeChange(item.id, attr.name, e.target.value)}
                            >
                              <option value="">Pilih {attr.name}</option>
                              {(attr.values || []).map((v) => (
                                <option key={v.value} value={v.value}>
                                  {attr.affectsPrice && v.priceModifier > 0
                                    ? `${v.value} (+Rp ${v.priceModifier.toLocaleString('id-ID')})`
                                    : v.value}
                                </option>
                              ))}
                            </select>
                            {attrErr && <span className="offline-field-error">{attrErr}</span>}
                          </div>
                        );
                      })}
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
            <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
            <strong>{formatCurrency(subtotalGross)}</strong>
          </div>
        </section>

        {/* ── Diskon / Potongan Harga ── */}
        <section className="offline-form-section">
          <div className="offline-form-section-header">
            <div className="offline-form-section-title">🏷️ Diskon / Potongan Harga</div>
            <button
              type="button"
              className="adm-btn"
              style={{ padding: '5px 14px', fontSize: '13px' }}
              onClick={addDiscountRow}
            >
              + Tambahkan diskon / potongan harga
            </button>
          </div>

          {discounts.length === 0 ? (
            <p className="offline-discount-empty">
              Belum ada diskon. Klik tombol di atas untuk menambahkan potongan per item atau untuk
              subtotal order (bisa lebih dari satu baris).
            </p>
          ) : (
            <div className="offline-discount-list">
              {discounts.map((d, idx) => {
                const valErr = fieldErrors[`disc_${d.id}_value`];
                const scopedGross =
                  d.scope === 'order'
                    ? subtotalGross
                    : grossList[items.findIndex((it) => it.id === d.scope)] || 0;
                const previewAmt = discountTotalFor([d], scopedGross);
                return (
                  <div key={d.id} className="offline-discount-row">
                    <span className="offline-discount-idx">{idx + 1}.</span>

                    <div className="offline-discount-field offline-discount-field--scope">
                      <label className="offline-form-label">Cakupan</label>
                      <select
                        className="adm-input"
                        value={d.scope}
                        onChange={(e) => updateDiscountRow(d.id, 'scope', e.target.value)}
                      >
                        <option value="order">Subtotal order</option>
                        {items.map((it, i) => (
                          <option key={it.id} value={it.id}>
                            Item {i + 1}{it.name.trim() ? ` — ${it.name.trim()}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="offline-discount-field offline-discount-field--type">
                      <label className="offline-form-label">Jenis</label>
                      <select
                        className="adm-input"
                        value={d.type}
                        onChange={(e) => updateDiscountRow(d.id, 'type', e.target.value)}
                      >
                        <option value="percentage">Persentase (%)</option>
                        <option value="nominal">Nominal (Rp)</option>
                      </select>
                    </div>

                    <div className="offline-discount-field offline-discount-field--value">
                      <label className="offline-form-label">
                        {d.type === 'percentage' ? 'Persen (0-100)' : 'Nominal (Rp)'}
                      </label>
                      <input
                        className={`adm-input${valErr ? ' adm-input--error' : ''}`}
                        type="number"
                        min="0"
                        max={d.type === 'percentage' ? '100' : undefined}
                        step={d.type === 'percentage' ? '1' : 'any'}
                        placeholder={d.type === 'percentage' ? 'mis. 10' : 'mis. 5000'}
                        value={d.value}
                        onChange={(e) => updateDiscountRow(d.id, 'value', e.target.value)}
                      />
                      {valErr && <span className="offline-field-error">{valErr}</span>}
                    </div>

                    <div className="offline-discount-field offline-discount-field--label">
                      <label className="offline-form-label">Label (opsional)</label>
                      <input
                        className="adm-input"
                        type="text"
                        maxLength={100}
                        placeholder="mis. Diskon member"
                        value={d.label}
                        onChange={(e) => updateDiscountRow(d.id, 'label', e.target.value)}
                      />
                    </div>

                    <div className="offline-discount-field offline-discount-field--preview">
                      <label className="offline-form-label">Potongan</label>
                      <span className="offline-discount-preview">-{formatCurrency(previewAmt)}</span>
                    </div>

                    <button
                      type="button"
                      className="offline-item-remove offline-discount-remove"
                      onClick={() => removeDiscountRow(d.id)}
                      aria-label={`Hapus diskon ${idx + 1}`}
                    >
                      🗑
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {totalDiscount > 0 && (
            <div className="offline-discount-summary">
              <div className="offline-discount-summary-row">
                <span>Diskon item</span>
                <span>-{formatCurrency(itemDiscTotals.reduce((s, d) => s + d, 0))}</span>
              </div>
              <div className="offline-discount-summary-row">
                <span>Diskon subtotal</span>
                <span>-{formatCurrency(subtotalDiscount)}</span>
              </div>
              <div className="offline-discount-summary-row offline-discount-summary-row--final">
                <span>Total akhir</span>
                <strong>{formatCurrency(finalTotal)}</strong>
              </div>
            </div>
          )}
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
