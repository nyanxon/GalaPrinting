/**
 * ProductsSection.jsx — Product CRUD table with search, category filter, and modal form.
 * Equivalent to vanilla admin/sections/productsSection.js
 *
 * Requirements: 9.2, 16.4
 */

import { useState, useEffect, useRef } from 'react';
import DropZone from '../../../ui/DropZone.jsx';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import {
  listProductsPaginated,
  addProduct,
  updateProduct,
  deleteProduct,
  listCategories,
  uploadProductImage,
  listProductStock,
  setProductStock,
} from '../../../../services/products.js';
import { createCategory } from '../../../../services/categories.js';
import { validateProduct } from '../../../../utils/validate.js';
import { formatCurrency } from '../../../../utils/format.js';
import { track } from '../../../../utils/activityTracker.js';
import { showToast } from '../../../../core/toastEmitter.js';
import { USE_BACKEND } from '../../../../core/httpClient.js';
import { canonicalizeCombination, generateCombinations } from '../../../../utils/stock.js';

const PAGE_SIZE = 10;

/**
 * Parse existing images from a product object.
 * Returns Image_Entry[] — each existing URL becomes { url, status: 'done' }.
 * Handles JSON array strings, single URL strings, and placeholder values.
 *
 * Priority order:
 *  1. product.images  — already-normalized array set by normalizeProduct() in productService
 *  2. product.image_path — raw JSON array string or single URL from the DB row
 *  3. product.image  — single resolved URL (first image only, used as fallback)
 *
 * @param {object|null} product
 * @returns {{ url: string, status: 'uploading'|'done'|'error', error?: string, file?: File }[]}
 */
function parseImages(product) {
  if (!product) return [];

  // 1. Use the pre-normalized images array when available (contains all resolved URLs)
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images
      .filter((url) => url && !url.includes('placeholder'))
      .map((url) => ({ url, status: 'done' }));
  }

  // 2. Try raw image_path from the DB (may be a JSON array string or single URL)
  const raw = product.image_path || product.image;
  if (!raw) return [];

  let urls = [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) urls = parsed;
    } catch (_err) {
      // Not valid JSON — fall through to single-URL fallback below
    }
  }

  // 3. Fall back to single URL if JSON parse didn't yield an array
  if (!urls.length && raw && !raw.includes('placeholder')) {
    urls = [raw];
  }

  return urls
    .filter((url) => url && !url.includes('placeholder'))
    .map((url) => ({ url, status: 'done' }));
}

function ProductModal({ product, categories, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    category: product?.category || '',
    priceCustomer: product?.priceCustomer ?? product?.price_customer ?? product?.price ?? '',
    priceBroker: product?.priceBroker ?? product?.price_broker ?? product?.priceCustomer ?? product?.price_customer ?? product?.price ?? '',
    shortDescription: product?.shortDescription || product?.short_description || '',
    requiresDesign: product?.requiresDesign ?? product?.requires_design ?? false,
    sizeType: product?.sizeType ?? product?.size_type ?? 'none',
    isHiddenFromCustomer: Boolean(product?.isHiddenFromCustomer ?? product?.is_hidden_from_customer ?? false),
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState(parseImages(product));
  const [imageError, setImageError] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [localCategories, setLocalCategories] = useState(categories);

  // Atribut dinamis produk — nama bebas (Warna, Tipe Laminasi, Tipe Kertas, dll).
  // values disimpan sebagai string "a, b, c" saat diedit lalu dipecah saat submit.
  // Jika affectsPrice aktif, tiap nilai punya "Tambahan harga (Rp)" yang disimpan
  // di modifiers (keyed by value string) lalu dirakit menjadi struktur baru saat submit.
  const [attributes, setAttributes] = useState(
    (Array.isArray(product?.attributes) ? product.attributes : []).map((a) => {
      const modifiers = {};
      const valueStrings = [];
      for (const v of Array.isArray(a.values) ? a.values : []) {
        // Data lama: string biasa → tanpa modifier
        if (typeof v === 'string') { valueStrings.push(v); continue; }
        if (v && typeof v === 'object' && v.value) {
          valueStrings.push(v.value);
          const pm = Number(v.priceModifier ?? 0);
          if (Number.isFinite(pm) && pm > 0) modifiers[v.value] = String(pm);
        }
      }
      return {
        name: a.name || '',
        affectsPrice: Boolean(a.affectsPrice),
        values: valueStrings.join(', '),
        modifiers,
      };
    })
  );

  const overlayRef = useRef(null);

  // Stok per kombinasi atribut — key map by JSON.stringify(kombinasi kanonik).
  // Hanya bermakna di mode backend; mode localStorage dibiarkan kosong.
  const [stockValues, setStockValues] = useState({});

  // Saat mengedit produk, ambil nilai stok existing agar form terisi.
  useEffect(() => {
    let cancelled = false;
    if (!USE_BACKEND || !product?.id) return undefined;
    (async () => {
      try {
        const rows = await listProductStock(product.id);
        if (cancelled || !Array.isArray(rows)) return;
        const map = {};
        for (const r of rows) {
          map[JSON.stringify(r.combination ?? [])] = String(r.stockQuantity ?? 0);
        }
        setStockValues(map);
      } catch (_err) {
        // Gagal memuat stok — biarkan kosong (default 0), tidak blokir form.
      }
    })();
    return () => { cancelled = true; };
  }, [product?.id]);

  // Bangun definisi atribut dari state editor ({ name, values: "a, b, c" }
  // atau array [{ value }]) untuk menghitung kombinasi stok.
  function buildAttributeDefs(list) {
    const defs = [];
    for (const attr of list ?? []) {
      const name = String(attr?.name ?? '').trim();
      const values = Array.isArray(attr?.values)
        ? attr.values
            .map((v) => (typeof v === 'string' ? v.trim() : String(v?.value ?? '').trim()))
            .filter(Boolean)
        : String(attr?.values ?? '').split(',').map((v) => v.trim()).filter(Boolean);
      if (name && values.length) defs.push({ name, values });
    }
    return defs;
  }

  // Kombinasi stok yang ditampilkan — dihitung live dari atribut editor.
  const stockCombos = generateCombinations(buildAttributeDefs(attributes));

  // Per-M2 products use panjang × lebar input at order time.
  const isPerM2 = formData.sizeType === 'per_m2';

  // Close on Escape is intentionally disabled — use the × button to close.
  // (The modal has an explicit close button so we don't need keyboard dismiss.)

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    if (name === 'category' && value === '__new__') {
      setShowNewCat(true);
      setFormData((prev) => ({ ...prev, category: '' }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleImageUpload(files) {
    if (images.length + files.length > 8) {
      setImageError('Maksimal 8 foto diperbolehkan.');
      return;
    }

    const startIdx = images.length;

    // Create placeholder entries immediately (optimistic UI)
    const placeholders = files.map((f) => ({
      url: URL.createObjectURL(f),
      status: 'uploading',
      file: f,
    }));
    setImages((prev) => [...prev, ...placeholders]);
    setImageError('');

    // Upload concurrently, using functional updates to avoid stale closures
    await Promise.allSettled(
      files.map(async (file, i) => {
        const placeholderUrl = placeholders[i].url;
        try {
          const serverUrl = await uploadProductImage(file);
          URL.revokeObjectURL(placeholderUrl);
          setImages((prev) =>
            prev.map((entry, idx) =>
              idx === startIdx + i ? { url: serverUrl, status: 'done' } : entry
            )
          );
        } catch (err) {
          setImages((prev) =>
            prev.map((entry, idx) =>
              idx === startIdx + i
                ? { ...entry, status: 'error', error: err.message }
                : entry
            )
          );
        }
      })
    );
  }

  function handleRemoveImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleMoveImage(idx, direction) {
    setImages((prev) => {
      const next = [...prev];
      if (direction === 'left' && idx > 0) {
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      } else if (direction === 'right' && idx < next.length - 1) {
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      }
      return next;
    });
  }

  // ── Atribut dinamis ──
  function handleAddAttribute() {
    setAttributes((prev) => [...prev, { name: '', affectsPrice: false, values: '', modifiers: {} }]);
  }

  function handleRemoveAttribute(idx) {
    setAttributes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAttributeChange(idx, field, value) {
    setAttributes((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    );
  }

  function handleAttributeModifierChange(idx, valueStr, amount) {
    setAttributes((prev) =>
      prev.map((a, i) =>
        i === idx ? { ...a, modifiers: { ...a.modifiers, [valueStr]: amount } } : a
      )
    );
  }

  async function handleAddCategory() {
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    if (localCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Kategori sudah ada.', 'info');
      return;
    }

    setAddingCat(true);
    try {
      await createCategory(trimmed);
      setLocalCategories((prev) => [...prev, trimmed]);
      setFormData((prev) => ({ ...prev, category: trimmed }));
      setShowNewCat(false);
      setNewCatName('');
      showToast(`Kategori "${trimmed}" ditambahkan.`, 'success');
    } catch (err) {
      console.error('Failed to create category:', err);
      showToast('Gagal membuat kategori.', 'error');
    } finally {
      setAddingCat(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const doneImages = images.filter((i) => i.status === 'done');
    const uploadingImages = images.filter((i) => i.status === 'uploading');

    if (doneImages.length === 0) {
      setFormError('Minimal 1 gambar produk wajib diunggah.');
      return;
    }

    if (uploadingImages.length > 0) {
      setFormError('Tunggu hingga semua foto selesai diunggah.');
      return;
    }

    // Bersihkan atribut kosong — baris tanpa nama atau tanpa nilai diabaikan.
    // Nama atribut duplikat juga digabulkan menjadi satu.
    // Struktur baru: { name, affectsPrice, values: [{ value, priceModifier }] }
    const cleanedAttributes = [];
    for (const attr of attributes) {
      const name = attr.name.trim();
      const rawValues = attr.values.split(',').map((v) => v.trim()).filter(Boolean);
      if (!name || rawValues.length === 0) continue;
      const valueEntries = rawValues.map((v) => ({
        value: v,
        priceModifier: attr.affectsPrice
          ? Math.max(0, Number(attr.modifiers?.[v] ?? 0) || 0)
          : 0,
      }));
      const existing = cleanedAttributes.find((a) => a.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        for (const entry of valueEntries) {
          if (!existing.values.some((m) => m.value.toLowerCase() === entry.value.toLowerCase())) {
            existing.values.push(entry);
          }
        }
        existing.affectsPrice = existing.affectsPrice || Boolean(attr.affectsPrice);
      } else {
        cleanedAttributes.push({ name, affectsPrice: Boolean(attr.affectsPrice), values: valueEntries });
      }
    }

    const data = {
      name: formData.name.trim(),
      category: formData.category,
      priceCustomer: Number(formData.priceCustomer || 0),
      priceBroker: Number(formData.priceBroker || 0),
      shortDescription: formData.shortDescription.trim(),
      requiresDesign: formData.requiresDesign,
      image: JSON.stringify(doneImages.map((i) => i.url)),
      sizeType: formData.sizeType === 'per_m2' ? 'per_m2' : 'none',
      isHiddenFromCustomer: formData.isHiddenFromCustomer,
      attributes: cleanedAttributes,
    };

    const { ok, errors } = validateProduct(data);
    if (!ok) {
      setFormError(errors.join(' '));
      return;
    }

    setSubmitting(true);
    try {
      let productId = null;
      if (product) {
        const res = await updateProduct(product.id, data);
        if (res && res.ok === false) {
          setFormError(res.message || 'Gagal memperbarui produk.');
          return;
        }
        productId = res?.product?.id ?? product.id;
        track('Update Produk', {
          targetType: 'product', targetId: product.id,
          metadata: { name: data.name },
        });
        showToast('Produk diperbarui.', 'success');
      } else {
        const res = await addProduct(data);
        productId = res?.data?.id ?? res?.id ?? null;
        track('Tambah Produk', {
          targetType: 'product', targetId: productId,
          metadata: { name: data.name, category: data.category },
        });
        showToast('Produk ditambahkan.', 'success');
      }

      // Simpan stok per kombinasi (hanya bermakna saat mode backend aktif).
      if (USE_BACKEND && productId) {
        const finalCombos = generateCombinations(buildAttributeDefs(cleanedAttributes));
        const stocks = finalCombos.map((combo) => {
          const canonical = canonicalizeCombination(combo);
          return {
            combination: canonical,
            stock: Math.max(0, Number(stockValues[JSON.stringify(canonical)]) || 0),
          };
        });
        if (stocks.length > 0) {
          try {
            await setProductStock(productId, stocks);
          } catch (stockErr) {
            setFormError(`Produk tersimpan, tapi gagal menyimpan stok: ${stockErr?.response?.data?.message || stockErr?.message || 'coba lagi.'}`);
            return;
          }
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save product:', err);
      setFormError(err?.response?.data?.message || 'Gagal menyimpan produk. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="adm-modal-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prod-modal-title"
    >
      <div className="adm-modal" style={{ maxWidth: '680px' }}>
        <div className="adm-modal-header">
          <h2 className="adm-modal-title" id="prod-modal-title">
            {product ? 'Edit Produk' : 'Tambah Produk'}
          </h2>
          <button
            className="adm-modal-close"
            type="button"
            aria-label="Tutup"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="adm-modal-body">
          <form className="adm-form" onSubmit={handleSubmit} noValidate>
            <div className="adm-field">
              <label className="adm-label" htmlFor="pf-name">Nama Produk *</label>
              <input className="adm-input" id="pf-name" name="name" value={formData.name} onChange={handleChange} required placeholder="Nama produk" />
            </div>

            <div className="adm-field">
              <label className="adm-label" htmlFor="pf-cat">Kategori *</label>
              <select className="adm-input" id="pf-cat" name="category" value={formData.category} onChange={handleChange} required>
                <option value="">Pilih kategori</option>
                {localCategories.map((c) => (<option key={c} value={c}>{c}</option>))}
                <option value="__new__">+ Buat Kategori Baru…</option>
              </select>
              {showNewCat && (
                <div style={{ marginTop: '6px' }}>
                  <input className="adm-input" placeholder="Nama kategori baru" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }} />
                  <button className="adm-btn adm-btn--primary" type="button" style={{ marginTop: '6px' }} onClick={handleAddCategory} disabled={addingCat}>
                    {addingCat ? 'Menyimpan…' : 'Tambah'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="adm-field">
                <label className="adm-label" htmlFor="pf-price-customer">
                  Harga Customer (Rp) *
                </label>
                <input className="adm-input" id="pf-price-customer" name="priceCustomer" type="number" min="0" value={formData.priceCustomer} onChange={handleChange} required placeholder="0" />
              </div>
              <div className="adm-field">
                <label className="adm-label" htmlFor="pf-price-broker">
                  Harga Broker (Rp) *
                </label>
                <input className="adm-input" id="pf-price-broker" name="priceBroker" type="number" min="0" value={formData.priceBroker} onChange={handleChange} required placeholder="0" />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
              💡 Harga broker biasanya lebih murah. Harga customer dipakai di website & order biasa, harga broker untuk order offline via dropdown tipe pembeli.
            </p>

            <div className="adm-field">
              <label className="adm-label" htmlFor="pf-desc">Deskripsi Singkat</label>
              <textarea
                className="adm-input"
                id="pf-desc"
                name="shortDescription"
                value={formData.shortDescription}
                onChange={handleChange}
                placeholder="Deskripsi singkat"
                rows={4}
                style={{ minHeight: '96px', resize: 'vertical', overflowY: 'auto' }}
              />
            </div>

            <div className="adm-field">
              <label className="adm-label" htmlFor="pf-size-type">Tipe Ukuran Produk *</label>
              <select className="adm-input" id="pf-size-type" name="sizeType" value={formData.sizeType} onChange={handleChange}>
                <option value="per_m2">Per M2 (panjang × lebar saat order)</option>
                <option value="none">Tidak Ada</option>
              </select>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                {isPerM2
                  ? '💡 Produk dihitung per m² — customer/kasir memasukkan panjang × lebar saat order.'
                  : '💡 Produk tidak memakai panjang × lebar — harga satuan langsung dipakai saat order.'}
              </p>
            </div>

            {/* ── Atribut Dinamis (Warna / Tipe Laminasi / Tipe Kertas / dll) ── */}
            <div className="adm-field">
              <label className="adm-label">
                Atribut Produk <span className="adm-hint">(opsional — nama bebas, mis. Warna, Tipe Laminasi, Tipe Kertas)</span>
              </label>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '0 0 6px 0', marginBottom: '6px' }}>
                Customer akan memilih salah satu nilai untuk setiap atribut saat memesan.
              </p>
              {attributes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '8px' }}>
                  {attributes.map((attr, idx) => {
                    const parsedValues = attr.values.split(',').map((v) => v.trim()).filter(Boolean);
                    return (
                      <div
                        key={idx}
                        style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px', alignItems: 'start' }}>
                          <input
                            className="adm-input"
                            placeholder="Nama atribut (mis. Warna)"
                            value={attr.name}
                            onChange={(e) => handleAttributeChange(idx, 'name', e.target.value)}
                            aria-label={`Nama atribut ${idx + 1}`}
                          />
                          <input
                            className="adm-input"
                            placeholder="Pilihan nilai, pisahkan dengan koma (mis. Merah, Biru, Hitam)"
                            value={attr.values}
                            onChange={(e) => handleAttributeChange(idx, 'values', e.target.value)}
                            aria-label={`Nilai atribut ${idx + 1}`}
                          />
                          <button
                            className="adm-btn adm-btn--delete"
                            type="button"
                            onClick={() => handleRemoveAttribute(idx)}
                            aria-label={`Hapus atribut ${idx + 1}`}
                            style={{ padding: '6px 10px' }}
                          >
                            ✕
                          </button>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#374151', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={attr.affectsPrice}
                            onChange={(e) => handleAttributeChange(idx, 'affectsPrice', e.target.checked)}
                            aria-label={`Pengaruhi harga ${idx + 1}`}
                          />
                          {' '}Pengaruhi harga?
                        </label>
                        {attr.affectsPrice && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>
                              Tambahan harga per pilihan — harga final = harga dasar + total tambahan:
                            </span>
                            {parsedValues.length === 0 ? (
                              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                Isi pilihan nilai terlebih dahulu.
                              </span>
                            ) : (
                              parsedValues.map((v) => (
                                <div key={v} style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '8px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '13px', color: '#374151' }}>{v}</span>
                                  <input
                                    className="adm-input"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={attr.modifiers?.[v] ?? ''}
                                    onChange={(e) => handleAttributeModifierChange(idx, v, e.target.value)}
                                    aria-label={`Tambahan harga (Rp) untuk ${v}`}
                                  />
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                className="adm-btn"
                type="button"
                onClick={handleAddAttribute}
                disabled={attributes.length >= 30}
              >
                + Tambah Atribut
              </button>
            </div>

            {/* ── Stok Per Kombinasi (Fitur Stok) ── */}
            <div className="adm-field">
              <label className="adm-label">
                Stok Per Kombinasi{' '}
                {USE_BACKEND ? (
                  <span className="adm-hint">(opsional — biarkan 0 untuk stok kosong)</span>
                ) : (
                  <span className="adm-hint">(aktif saat backend diaktifkan)</span>
                )}
              </label>
              {!USE_BACKEND ? (
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                  Mode lokal tidak menyimpan stok. Aktifkan VITE_USE_BACKEND untuk mengelola stok per kombinasi atribut.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stockCombos.map((combo) => {
                    const canonical = canonicalizeCombination(combo);
                    const key = JSON.stringify(canonical);
                    const attrsText = canonical.map((a) => `${a.name}: ${a.value}`).join(' · ') || 'Stok Barang';
                    return (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#374151', wordBreak: 'break-word' }}>{attrsText}</span>
                        <input
                          className="adm-input"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={stockValues[key] ?? ''}
                          onChange={(e) => setStockValues((prev) => ({ ...prev, [key]: e.target.value }))}
                          aria-label={`Stok ${attrsText}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Image Upload ── */}
            <div className="adm-field">
              <label className="adm-label">
                Foto Produk * <span className="adm-hint">(minimal 1, maksimal 8)</span>
              </label>
              {/* Count badge: doneCount / total */}
              {images.length > 0 && (() => {
                const doneCount = images.filter((i) => i.status === 'done').length;
                return (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                    {doneCount}/{images.length} foto berhasil diunggah
                  </p>
                );
              })()}
              {images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {images.map((entry, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img
                        src={entry.url}
                        alt={`Foto ${idx + 1}`}
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb', display: 'block' }}
                      />

                      {/* Spinner overlay — uploading */}
                      {entry.status === 'uploading' && (
                        <div style={{
                          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                          borderRadius: 4, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: '#fff', fontSize: 10,
                          textAlign: 'center', padding: '2px',
                        }}>
                          Mengunggah…
                        </div>
                      )}

                      {/* Error overlay */}
                      {entry.status === 'error' && (
                        <div style={{
                          position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.75)',
                          borderRadius: 4, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: '#fff', fontSize: 10,
                          textAlign: 'center', padding: '4px', wordBreak: 'break-word',
                        }}>
                          {entry.error || 'Gagal'}
                        </div>
                      )}

                      {/* "Foto 1" badge on first entry */}
                      {idx === 0 && (
                        <span style={{
                          position: 'absolute', bottom: 2, left: 2,
                          background: 'rgba(0,0,0,0.55)', color: '#fff',
                          fontSize: 9, padding: '1px 4px', borderRadius: 3,
                          pointerEvents: 'none',
                        }}>
                          Foto 1
                        </span>
                      )}

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, lineHeight: '20px', textAlign: 'center', padding: 0 }}
                        aria-label={`Hapus foto ${idx + 1}`}
                      >✕</button>

                      {/* Move-left / move-right buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <button
                          type="button"
                          onClick={() => handleMoveImage(idx, 'left')}
                          disabled={idx === 0}
                          style={{ flex: 1, fontSize: 12, padding: '1px 0', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, border: '1px solid #d1d5db', borderRadius: '3px 0 0 3px', background: '#f9fafb' }}
                          aria-label={`Pindah foto ${idx + 1} ke kiri`}
                        >‹</button>
                        <button
                          type="button"
                          onClick={() => handleMoveImage(idx, 'right')}
                          disabled={idx === images.length - 1}
                          style={{ flex: 1, fontSize: 12, padding: '1px 0', cursor: idx === images.length - 1 ? 'default' : 'pointer', opacity: idx === images.length - 1 ? 0.3 : 1, border: '1px solid #d1d5db', borderLeft: 'none', borderRadius: '0 3px 3px 0', background: '#f9fafb' }}
                          aria-label={`Pindah foto ${idx + 1} ke kanan`}
                        >›</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {images.length < 8 && (
                <DropZone
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onFiles={handleImageUpload}
                  label="Tambah foto produk"
                  hint="JPG, PNG, WEBP · Maks. 10 MB per foto · Maks. 8 foto"
                />
              )}
              {imageError && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '4px' }}>{imageError}</p>}
            </div>

            <div className="adm-field adm-field--check">
              <label className="adm-label">
                <input type="checkbox" name="requiresDesign" checked={formData.requiresDesign} onChange={handleChange} />
                {' '}Wajib upload desain
              </label>
            </div>

            <div className="adm-field adm-field--check">
              <label className="adm-label">
                <input type="checkbox" name="isHiddenFromCustomer" checked={formData.isHiddenFromCustomer} onChange={handleChange} />
                {' '}Sembunyikan produk ini dari customer (hanya untuk data internal/kasir)
              </label>
              {formData.isHiddenFromCustomer && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  Produk tidak muncul di homepage &amp; halaman produk customer, tapi tetap tampil &amp; bisa dipilih di kasir/admin.
                </p>
              )}
            </div>

            {formError && (
              <div className="adm-form-alert" role="alert">{formError}</div>
            )}

            <div className="adm-form-actions">
              <button className="adm-btn adm-btn--primary" type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan…' : (product ? 'Simpan Perubahan' : 'Tambah Produk')}
              </button>
              <button className="adm-btn" type="button" onClick={onClose} disabled={submitting}>Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ProductsSection() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [result, setResult] = useState({ items: [], total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  async function loadData() {
    try {
      const cats = await listCategories();
      // listCategories already normalizes to string[] via productService
      setCategories(Array.isArray(cats) ? cats : []);
      const data = await listProductsPaginated({
        page: currentPage,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
        category: filterCat || undefined,
      });
      setResult(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchQuery, filterCat]);

  function handleSearchChange(e) {
    setSearchQuery(e.target.value.trim());
    setCurrentPage(1);
  }

  function handleCatFilterChange(e) {
    setFilterCat(e.target.value);
    setCurrentPage(1);
  }

  function handleAddClick() {
    setEditingProduct(null);
    setModalOpen(true);
  }

  function handleEditClick(product) {
    setEditingProduct(product);
    setModalOpen(true);
  }

  async function handleDeleteClick(productId) {
    if (!window.confirm('Hapus produk ini?')) return;
    try {
      const res = await deleteProduct(productId);
      if (res && res.ok === false) {
        showToast(res.message || 'Gagal menghapus produk.', 'error');
        return;
      }
      track('Hapus Produk', { targetType: 'product', targetId: productId });
      showToast('Produk dihapus.', 'success');
      loadData();
    } catch (err) {
      console.error('Failed to delete product:', err);
      showToast(err?.response?.data?.message || 'Gagal menghapus produk.', 'error');
    }
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingProduct(null);
  }

  function handleSaved() {
    loadData();
  }

  return (
    <>
      <div className="adm-card">
        <div className="adm-toolbar">
          <h2 className="adm-section-title">Daftar Produk ({result.total})</h2>
          <div className="adm-toolbar-right">
            <input
              className="adm-input adm-search"
              type="search"
              placeholder="Cari nama produk…"
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Cari produk"
            />
            <select
              className="adm-input"
              value={filterCat}
              onChange={handleCatFilterChange}
              aria-label="Filter kategori"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              className="adm-btn adm-btn--primary"
              type="button"
              onClick={handleAddClick}
            >
              + Tambah
            </button>
          </div>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kategori</th>
                <th>Harga Customer</th>
                <th>Harga Broker</th>
                <th>Stok</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="adm-empty">
                    Belum ada produk.
                  </td>
                </tr>
              ) : (
                result.items.map((p) => {
                  const totalStock = USE_BACKEND ? Number(p.total_stock ?? 0) : null;
                  return (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      {p.sizeType === 'per_m2' && (
                        <span style={{ marginLeft: 6, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#ede9fe', color: '#6d28d9', fontWeight: 600, whiteSpace: 'nowrap' }}>Per M²</span>
                      )}
                      {p.isHiddenFromCustomer && (
                        <span style={{ marginLeft: 6, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#b91c1c', fontWeight: 600, whiteSpace: 'nowrap' }}>Tersembunyi</span>
                      )}
                    </td>
                    <td>{p.category || '—'}</td>
                    <td>{formatCurrency(p.priceCustomer ?? p.price)}</td>
                    <td>{formatCurrency(p.priceBroker ?? p.priceCustomer ?? p.price)}</td>
                    <td>
                      {totalStock === null ? (
                        '—'
                      ) : totalStock > 0 ? (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#dcfce7', color: '#15803d', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Stok {totalStock}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#b91c1c', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Stok Habis
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="adm-actions">
                        <button
                          className="adm-btn adm-btn--edit"
                          type="button"
                          onClick={() => handleEditClick(p)}
                        >
                          Edit
                        </button>
                        <button
                          className="adm-btn adm-btn--delete"
                          type="button"
                          onClick={() => handleDeleteClick(p.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          limit={result.limit}
          onPageChange={setCurrentPage}
        />
      </div>

      {modalOpen && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
