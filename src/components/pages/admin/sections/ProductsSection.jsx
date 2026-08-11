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
} from '../../../../services/products.js';
import { createCategory } from '../../../../services/categories.js';
import { validateProduct } from '../../../../utils/validate.js';
import { formatCurrency } from '../../../../utils/format.js';
import { showToast } from '../../../../core/toastEmitter.js';

const PAGE_SIZE = 10;

/**
 * Parse a field that may be a JSON string array or already an array.
 * Backend stores colors/sizes/materials as JSON strings.
 */
function parseArrayField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Not JSON — treat as comma-separated plain string
      return val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];
    }
  }
  return [];
}

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
  // Parse existing variantPrices — stored as { "size|material": price }.
  // Format baru: { "size|material": { customer, broker } }.
  // Format lama (angka tunggal) dinormalisasi → sama untuk customer & broker.
  function parseVariantPrices(raw) {
    if (!raw) return {};
    let obj = raw;
    if (typeof raw === 'string') {
      try { obj = JSON.parse(raw); } catch { return {}; }
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const out = {};
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'number' && isFinite(val)) {
        out[key] = { customer: val, broker: val };
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        const customer = Number(val.customer);
        const broker = Number(val.broker);
        out[key] = {
          customer: Number.isFinite(customer) ? customer : undefined,
          broker: Number.isFinite(broker) ? broker : undefined,
        };
      }
    }
    return out;
  }

  const [formData, setFormData] = useState({
    name: product?.name || '',
    category: product?.category || '',
    priceCustomer: product?.priceCustomer ?? product?.price_customer ?? product?.price ?? '',
    priceBroker: product?.priceBroker ?? product?.price_broker ?? product?.priceCustomer ?? product?.price_customer ?? product?.price ?? '',
    shortDescription: product?.shortDescription || product?.short_description || '',
    colors: parseArrayField(product?.colors).join(', '),
    sizes: parseArrayField(product?.sizes).join(', '),
    materials: parseArrayField(product?.materials).join(', '),
    requiresDesign: product?.requiresDesign ?? product?.requires_design ?? false,
    sizeType: product?.sizeType ?? product?.size_type ?? 'fixed',
    isHiddenFromCustomer: Boolean(product?.isHiddenFromCustomer ?? product?.is_hidden_from_customer ?? false),
  });
  const [variantPrices, setVariantPrices] = useState(
    parseVariantPrices(product?.variantPrices ?? product?.variant_prices ?? null)
  );
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState(parseImages(product));
  const [imageError, setImageError] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [localCategories, setLocalCategories] = useState(categories);

  const overlayRef = useRef(null);

  // Derive size/material arrays from current form values
  const splitField = (v) =>
    String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

  const currentSizes     = splitField(formData.sizes);
  const currentMaterials = splitField(formData.materials);

  // Per-M2 products use panjang × lebar input at order time — size table is disabled.
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

  function handleVariantPriceChange(size, material, side, value) {
    const key = `${size}|${material}`;
    const num = value === '' ? undefined : Number(value);
    const valid = num !== undefined && !isNaN(num) && num >= 0;
    setVariantPrices((prev) => {
      const next = { ...prev };
      const current = { ...(next[key] || {}) };
      if (valid) {
        current[side] = num;
      } else {
        delete current[side];
      }
      if (Object.keys(current).length === 0) {
        delete next[key];
      } else {
        next[key] = current;
      }
      return next;
    });
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

    const split = (v) =>
      String(v || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const data = {
      name: formData.name.trim(),
      category: formData.category,
      priceCustomer: Number(formData.priceCustomer || 0),
      priceBroker: Number(formData.priceBroker || 0),
      shortDescription: formData.shortDescription.trim(),
      colors: split(formData.colors),
      // Per-M2: size table tidak dipakai — kirim kosong agar DB tidak menyimpan data ukuran.
      sizes: isPerM2 ? [] : split(formData.sizes),
      materials: isPerM2 ? [] : split(formData.materials),
      requiresDesign: formData.requiresDesign,
      image: JSON.stringify(doneImages.map((i) => i.url)),
      // Only save non-empty variant prices
      variantPrices: isPerM2 || Object.keys(variantPrices).length === 0 ? null : variantPrices,
      sizeType: formData.sizeType === 'per_m2' ? 'per_m2' : 'fixed',
      isHiddenFromCustomer: formData.isHiddenFromCustomer,
    };

    const { ok, errors } = validateProduct(data);
    if (!ok) {
      setFormError(errors.join(' '));
      return;
    }

    setSubmitting(true);
    try {
      if (product) {
        const res = await updateProduct(product.id, data);
        if (res && res.ok === false) {
          setFormError(res.message || 'Gagal memperbarui produk.');
          return;
        }
        showToast('Produk diperbarui.', 'success');
      } else {
        await addProduct(data);
        showToast('Produk ditambahkan.', 'success');
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
                <option value="fixed">Fix Size (ukuran sudah ditentukan)</option>
                <option value="per_m2">Per M2 (panjang × lebar saat order)</option>
              </select>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                {isPerM2
                  ? '💡 Produk dihitung per m² — customer/kasir memasukkan panjang × lebar saat order, tabel ukuran tidak dipakai.'
                  : '💡 Produk memakai tabel ukuran (fix size) seperti sekarang — isi daftar ukuran & bahan di bawah.'}
              </p>
            </div>

            <div className="adm-field">
              <label className="adm-label" htmlFor="pf-colors">
                Warna <span className="adm-hint">(pisahkan koma — tidak mempengaruhi harga)</span>
              </label>
              <input className="adm-input" id="pf-colors" name="colors" value={formData.colors} onChange={handleChange} placeholder="Hitam, Putih, Merah" />
            </div>

            <div className="adm-field">
              <label className="adm-label" htmlFor="pf-sizes">
                Ukuran <span className="adm-hint">(pisahkan koma — mempengaruhi harga)</span>
              </label>
              <input className="adm-input" id="pf-sizes" name="sizes" value={formData.sizes} onChange={handleChange} disabled={isPerM2} placeholder={isPerM2 ? 'Tidak dipakai untuk produk per m²' : 'A4, A5, Custom'} style={isPerM2 ? { opacity: 0.5, background: '#f3f4f6', cursor: 'not-allowed' } : undefined} />
            </div>

            <div className="adm-field">
              <label className="adm-label" htmlFor="pf-mats">
                Bahan <span className="adm-hint">(pisahkan koma — mempengaruhi harga)</span>
              </label>
              <input className="adm-input" id="pf-mats" name="materials" value={formData.materials} onChange={handleChange} disabled={isPerM2} placeholder={isPerM2 ? 'Tidak dipakai untuk produk per m²' : 'Vinyl, Art Paper'} style={isPerM2 ? { opacity: 0.5, background: '#f3f4f6', cursor: 'not-allowed' } : undefined} />
            </div>

            {/* ── Variant Price Grid ── */}
            {!isPerM2 && (currentSizes.length > 0 || currentMaterials.length > 0) && (
              <div className="adm-field">
                <label className="adm-label">
                  Harga per Varian
                  <span className="adm-hint" style={{ marginLeft: '6px' }}>— kosongkan untuk pakai harga dasar</span>
                </label>
                <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '6px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', textAlign: 'left', fontWeight: 600 }}>
                          Ukuran \ Bahan
                        </th>
                        {currentMaterials.length > 0
                          ? currentMaterials.map((mat) => (
                              <th key={mat} style={{ padding: '6px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {mat}
                              </th>
                            ))
                          : (
                              <th style={{ padding: '6px 10px', background: '#f3f4f6', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 600 }}>
                                (semua bahan)
                              </th>
                            )
                        }
                      </tr>
                    </thead>
                    <tbody>
                      {(currentSizes.length > 0 ? currentSizes : ['']).map((size) => (
                        <tr key={size}>
                          <td style={{ padding: '6px 10px', border: '1px solid #e5e7eb', fontWeight: 500, background: '#fafafa', whiteSpace: 'nowrap' }}>
                            {size || '(semua ukuran)'}
                          </td>
                          {(currentMaterials.length > 0 ? currentMaterials : ['']).map((mat) => {
                            const key = `${size}|${mat}`;
                            const entry = variantPrices[key] || {};
                            const inputStyle = { width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', textAlign: 'right' };
                            return (
                              <td key={mat} style={{ padding: '4px 6px', border: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 11, color: '#6b7280', width: 50, flexShrink: 0, textAlign: 'left' }}>Cust</span>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder={String(formData.priceCustomer || 0)}
                                      value={entry.customer !== undefined ? entry.customer : ''}
                                      onChange={(e) => handleVariantPriceChange(size, mat, 'customer', e.target.value)}
                                      style={inputStyle}
                                      aria-label={`Harga customer ${size} / ${mat}`}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 11, color: '#6b7280', width: 50, flexShrink: 0, textAlign: 'left' }}>Brkr</span>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder={String(formData.priceBroker || 0)}
                                      value={entry.broker !== undefined ? entry.broker : ''}
                                      onChange={(e) => handleVariantPriceChange(size, mat, 'broker', e.target.value)}
                                      style={inputStyle}
                                      aria-label={`Harga broker ${size} / ${mat}`}
                                    />
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  💡 Warna tidak mempengaruhi harga. Isi Harga Customer &amp; Harga Broker per kombinasi ukuran + bahan; kosongkan untuk memakai harga dasar sesuai tipe pembeli.
                </p>
              </div>
            )}

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
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="adm-empty">
                    Belum ada produk.
                  </td>
                </tr>
              ) : (
                result.items.map((p) => (
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
                ))
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
