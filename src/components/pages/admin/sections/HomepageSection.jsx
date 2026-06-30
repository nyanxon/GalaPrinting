/**
 * HomepageSection.jsx â€” Admin panel section for managing Homepage content.
 *
 * Tabs:
 *   A. Landing Page Banner (hero)
 *   B. Design Showcase    (up to 4 design items)
 *   C. Category Banners   (per-category section banners)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { showToast } from '../../../../core/toastEmitter.js';
import { resolveApiUrl } from '../../../../core/httpClient.js';
import DropZone from '../../../shared/DropZone.jsx';
import ProductCard from '../../../shared/ProductCard.jsx';
import '../../../../styles/css/pages/home.css';
import {
  listAllHeroBanners,
  createHeroBanner,
  updateHeroBanner,
  deleteHeroBanner,
  reorderHeroBanners,
  uploadHomepageImage,
  listAllDesignItems,
  createDesignItem,
  updateDesignItem,
  deleteDesignItem,
  reorderDesignItems,
  listCatBanners,
  saveCatBanner,
  deleteCatBanner,
} from '../../../../services/homepageService.js';
import { api } from '../../../../core/httpClient.js';
import { listProducts } from '../../../../services/productService.js';

// Fetch categories as [{id, name}] objects (not the name-only array from productService)
async function fetchCategoriesWithIds() {
  try {
    const res = await api.get('/api/categories');
    const raw = res.data.data ?? res.data.items ?? res.data ?? [];
    if (Array.isArray(raw)) {
      return raw.map((c) => (typeof c === 'string' ? { id: c, name: c } : c));
    }
    return [];
  } catch {
    return [];
  }
}

// â”€â”€ Small shared helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function resolveImg(url) {
  if (!url) return null;
  return resolveApiUrl(url) || url;
}

/** Upload an image and return its server URL. Shows a toast on error. */
async function doUpload(file) {
  try {
    return await uploadHomepageImage(file);
  } catch (err) {
    showToast(err?.message || 'Upload gagal.', 'error');
    return null;
  }
}

// â”€â”€ ImagePickerField â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Reusable image-picker: shows current image preview + DropZone.
 * Calls onUrlChange(url) after upload completes.
 */
function ImagePickerField({ label, currentUrl, onUrlChange, uploading, setUploading }) {
  const [preview, setPreview] = useState(resolveImg(currentUrl) || '');

  useEffect(() => {
    setPreview(resolveImg(currentUrl) || '');
  }, [currentUrl]);

  async function handleFiles(files) {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    const url = await doUpload(file);
    setUploading(false);
    if (url) {
      setPreview(resolveImg(url));
      onUrlChange(url);
    }
  }

  return (
    <div className="adm-field">
      <label className="adm-label">{label}</label>
      {preview && (
        <img
          src={preview}
          alt="Preview"
          style={{ maxWidth: 320, maxHeight: 180, objectFit: 'cover',
            borderRadius: 6, border: '1px solid var(--border)', marginBottom: 8, display: 'block' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <DropZone
        accept="image/jpeg,image/png,image/webp"
        onFiles={handleFiles}
        disabled={uploading}
        compact
        label={uploading ? 'Mengunggahâ€¦' : (preview ? 'Ganti gambar' : undefined)}
        hint="JPG, PNG, WEBP Â· Maks. 10 MB"
      />
    </div>
  );
}

// â”€â”€ A. Hero Banners Tab (carousel â€” up to 8 slides) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function HeroBannerModal({ banner, onClose, onSaved }) {
  const [form, setForm] = useState({
    title:     banner?.title      || '',
    subtitle:  banner?.subtitle   || '',
    imagePath: banner?.image_path || '',
    ctaUrl:    banner?.cta_url    || '',
    sortOrder: banner?.sort_order ?? 0,
    isActive:  banner ? Boolean(banner.is_active) : true,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title:     form.title     || null,
        subtitle:  form.subtitle  || null,
        imagePath: form.imagePath || null,
        ctaUrl:    form.ctaUrl    || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive:  form.isActive,
      };
      if (banner) {
        await updateHeroBanner(banner.id, payload);
        showToast('Banner diperbarui.', 'success');
      } else {
        await createHeroBanner(payload);
        showToast('Banner ditambahkan.', 'success');
      }
      onSaved();
      onClose();
    } catch {
      setError('Gagal menyimpan banner.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="hb-modal-title">
      <div className="adm-modal" style={{ maxWidth: 560 }}>
        <div className="adm-modal-header">
          <h2 className="adm-modal-title" id="hb-modal-title">
            {banner ? 'Edit Banner' : 'Tambah Banner'}
          </h2>
          <button className="adm-modal-close" type="button" aria-label="Tutup" onClick={onClose}>âœ•</button>
        </div>
        <div className="adm-modal-body">
          <form className="adm-form" onSubmit={handleSubmit} noValidate>
            <ImagePickerField
              label="Gambar Banner"
              currentUrl={form.imagePath}
              onUrlChange={(url) => setForm((prev) => ({ ...prev, imagePath: url }))}
              uploading={uploading}
              setUploading={setUploading}
            />
            <div className="adm-field">
              <label className="adm-label" htmlFor="hb-title">Judul (opsional)</label>
              <input className="adm-input" id="hb-title" name="title"
                value={form.title} onChange={handleChange} placeholder="LANDING PAGE" />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="hb-subtitle">Subtitle (opsional)</label>
              <input className="adm-input" id="hb-subtitle" name="subtitle"
                value={form.subtitle} onChange={handleChange} placeholder="4+ PAGE" />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="hb-cta">Link Tujuan (opsional)</label>
              <input className="adm-input" id="hb-cta" name="ctaUrl"
                value={form.ctaUrl} onChange={handleChange} placeholder="https://... atau /products" />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="hb-order">Urutan Tampil</label>
              <input className="adm-input" id="hb-order" name="sortOrder" type="number" min="0"
                value={form.sortOrder} onChange={handleChange} />
            </div>
            <div className="adm-field adm-field--check">
              <label className="adm-label">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
                {' '}Aktifkan slide ini
              </label>
            </div>
            {/* Mini preview */}
            <div style={{ marginBottom: 12 }}>
              <p className="adm-label" style={{ marginBottom: 6 }}>Preview</p>
              <div style={{
                height: 100, borderRadius: 6, overflow: 'hidden', position: 'relative',
                background: form.imagePath ? 'none' : 'rgba(237,200,174,0.45)',
                backgroundImage: form.imagePath ? `url(${resolveImg(form.imagePath)})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
              }}>
                {form.imagePath && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />}
                <div style={{ position: 'relative', textAlign: 'center', padding: '8px 16px' }}>
                  {form.title && (
                    <p style={{ fontWeight: 900, fontSize: 18, margin: 0,
                      color: form.imagePath ? '#fff' : '#1f1f1f',
                      textShadow: form.imagePath ? '0 2px 8px rgba(0,0,0,0.5)' : 'none' }}>
                      {form.title}
                    </p>
                  )}
                  {form.subtitle && (
                    <p style={{ fontWeight: 700, fontSize: 13, margin: 0,
                      color: form.imagePath ? 'rgba(255,255,255,0.9)' : '#555',
                      textShadow: form.imagePath ? '0 1px 4px rgba(0,0,0,0.4)' : 'none' }}>
                      {form.subtitle}
                    </p>
                  )}
                  {!form.title && !form.subtitle && (
                    <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>Tidak ada teks</p>
                  )}
                </div>
              </div>
            </div>
            {error && <div className="adm-form-alert" role="alert">{error}</div>}
            <div className="adm-form-actions">
              <button className="adm-btn adm-btn--primary" type="submit" disabled={saving || uploading}>
                {saving ? 'Menyimpanâ€¦' : (banner ? 'Simpan Perubahan' : 'Tambah Banner')}
              </button>
              <button className="adm-btn" type="button" onClick={onClose} disabled={saving}>Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function HeroTab() {
  const [banners, setBanners]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);

  async function load() {
    setLoading(true);
    try { setBanners(await listAllHeroBanners()); }
    catch { showToast('Gagal memuat banner.', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!window.confirm('Hapus banner ini?')) return;
    try {
      await deleteHeroBanner(id);
      showToast('Banner dihapus.', 'success');
      load();
    } catch { showToast('Gagal menghapus.', 'error'); }
  }

  async function handleMove(idx, dir) {
    const updated = [...banners];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= updated.length) return;
    [updated[idx], updated[swap]] = [updated[swap], updated[idx]];
    const reordered = updated.map((b, i) => ({ id: b.id, sortOrder: i }));
    try {
      await reorderHeroBanners(reordered);
      setBanners(updated.map((b, i) => ({ ...b, sort_order: i })));
    } catch { showToast('Gagal menyimpan urutan.', 'error'); }
  }

  return (
    <>
      <div className="adm-card">
        <div className="adm-toolbar">
          <h2 className="adm-section-title">
            Landing Page Banner
            <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>
              (carousel · maks. 8 slide)
            </span>
          </h2>
          <div className="adm-toolbar-right">
            <button className="adm-btn adm-btn--primary" type="button"
              onClick={() => { setEditing(null); setModalOpen(true); }}
              disabled={banners.length >= 8}>
              + Tambah Banner
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: 16, color: '#6b7280' }}>Memuat…</p>
        ) : banners.length === 0 ? (
          <p style={{ padding: 16, color: '#6b7280' }}>
            Belum ada banner. Tambahkan slide pertama untuk carousel Homepage.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 14, padding: '4px 0' }}>
            {banners.map((b, idx) => (
              <div key={b.id} style={{
                border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
                opacity: b.is_active ? 1 : 0.5, position: 'relative',
              }}>
                {/* Slide number badge */}
                <span style={{
                  position: 'absolute', top: 6, left: 6,
                  background: b.is_active ? 'var(--brand-brown)' : '#9ca3af',
                  color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, zIndex: 1,
                }}>
                  Slide {idx + 1}{!b.is_active && ' (nonaktif)'}
                </span>
                {/* Thumbnail */}
                {resolveImg(b.image_path) ? (
                  <img src={resolveImg(b.image_path)} alt={b.title || ''}
                    style={{ width: '100%', aspectRatio: '16/7', objectFit: 'cover', display: 'block' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/7',
                    background: 'rgba(237,200,174,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#aaa', fontSize: 12 }}>
                    Tidak ada gambar
                  </div>
                )}
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                    {b.title || <span style={{ color: '#aaa' }}>Tanpa judul</span>}
                  </p>
                  {b.subtitle && (
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{b.subtitle}</p>
                  )}
                  {b.cta_url && (
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.cta_url}
                    </p>
                  )}
                  <div className="adm-actions" style={{ marginTop: 8 }}>
                    <button className="adm-btn" type="button" style={{ padding: '3px 8px', fontSize: 12 }}
                      onClick={() => handleMove(idx, 'up')} disabled={idx === 0} aria-label="Pindah ke atas">â†‘</button>
                    <button className="adm-btn" type="button" style={{ padding: '3px 8px', fontSize: 12 }}
                      onClick={() => handleMove(idx, 'down')} disabled={idx >= banners.length - 1} aria-label="Pindah ke bawah">â†“</button>
                    <button className="adm-btn adm-btn--edit" type="button"
                      onClick={() => { setEditing(b); setModalOpen(true); }}>Edit</button>
                    <button className="adm-btn adm-btn--delete" type="button"
                      onClick={() => handleDelete(b.id)}>Hapus</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <HeroBannerModal
          banner={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </>
  );
}

// â”€â”€ B. Design Showcase Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DesignItemModal({ item, onClose, onSaved }) {
  const [form, setForm]           = useState({
    title:     item?.title     || '',
    imagePath: item?.image_path || '',
    linkUrl:   item?.link_url  || '',
    sortOrder: item?.sort_order ?? 0,
    isActive:  item ? Boolean(item.is_active) : true,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.imagePath) { setError('Gambar wajib diunggah.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title:     form.title     || null,
        imagePath: form.imagePath,
        linkUrl:   form.linkUrl   || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive:  form.isActive,
      };
      if (item) {
        await updateDesignItem(item.id, payload);
        showToast('Design item diperbarui.', 'success');
      } else {
        await createDesignItem(payload);
        showToast('Design item ditambahkan.', 'success');
      }
      onSaved();
      onClose();
    } catch (_err) {
      setError('Gagal menyimpan design item.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="di-modal-title">
      <div className="adm-modal" style={{ maxWidth: 540 }}>
        <div className="adm-modal-header">
          <h2 className="adm-modal-title" id="di-modal-title">
            {item ? 'Edit Design Item' : 'Tambah Design Item'}
          </h2>
          <button className="adm-modal-close" type="button" aria-label="Tutup" onClick={onClose}>âœ•</button>
        </div>
        <div className="adm-modal-body">
          <form className="adm-form" onSubmit={handleSubmit} noValidate>
            <ImagePickerField
              label="Gambar Design *"
              currentUrl={form.imagePath}
              onUrlChange={(url) => setForm((prev) => ({ ...prev, imagePath: url }))}
              uploading={uploading}
              setUploading={setUploading}
            />
            <div className="adm-field">
              <label className="adm-label" htmlFor="di-title">Judul (opsional)</label>
              <input className="adm-input" id="di-title" name="title"
                value={form.title} onChange={handleChange} placeholder="Nama design" />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="di-link">Link Tujuan (opsional)</label>
              <input className="adm-input" id="di-link" name="linkUrl"
                value={form.linkUrl} onChange={handleChange} placeholder="/products atau https://..." />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="di-order">Urutan Tampil</label>
              <input className="adm-input" id="di-order" name="sortOrder" type="number" min="0"
                value={form.sortOrder} onChange={handleChange} />
            </div>
            <div className="adm-field adm-field--check">
              <label className="adm-label">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
                {' '}Tampilkan di Homepage
              </label>
            </div>
            {error && <div className="adm-form-alert" role="alert">{error}</div>}
            <div className="adm-form-actions">
              <button className="adm-btn adm-btn--primary" type="submit" disabled={saving || uploading}>
                {saving ? 'Menyimpanâ€¦' : (item ? 'Simpan Perubahan' : 'Tambah')}
              </button>
              <button className="adm-btn" type="button" onClick={onClose} disabled={saving}>Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function DesignShowcaseTab() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState(null);

  async function load() {
    setLoading(true);
    try { setItems(await listAllDesignItems()); }
    catch { showToast('Gagal memuat design items.', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!window.confirm('Hapus design item ini?')) return;
    try {
      await deleteDesignItem(id);
      showToast('Design item dihapus.', 'success');
      load();
    } catch { showToast('Gagal menghapus.', 'error'); }
  }

  async function handleMoveUp(idx) {
    if (idx === 0) return;
    const updated = [...items];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    const reordered = updated.map((it, i) => ({ id: it.id, sortOrder: i }));
    try {
      await reorderDesignItems(reordered);
      setItems(updated.map((it, i) => ({ ...it, sort_order: i })));
    } catch { showToast('Gagal menyimpan urutan.', 'error'); }
  }

  async function handleMoveDown(idx) {
    if (idx >= items.length - 1) return;
    const updated = [...items];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    const reordered = updated.map((it, i) => ({ id: it.id, sortOrder: i }));
    try {
      await reorderDesignItems(reordered);
      setItems(updated.map((it, i) => ({ ...it, sort_order: i })));
    } catch { showToast('Gagal menyimpan urutan.', 'error'); }
  }

  return (
    <>
      <div className="adm-card">
        <div className="adm-toolbar">
          <h2 className="adm-section-title">Design Showcase
            <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>
              (maks. 4 tampil di Homepage)
            </span>
          </h2>
          <div className="adm-toolbar-right">
            <button className="adm-btn adm-btn--primary" type="button"
              onClick={() => { setEditing(null); setModalOpen(true); }}
              disabled={items.length >= 8}>
              + Tambah Design
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: 16, color: '#6b7280' }}>Memuatâ€¦</p>
        ) : items.length === 0 ? (
          <p style={{ padding: 16, color: '#6b7280' }}>Belum ada design item.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 14, padding: '4px 0' }}>
            {items.map((item, idx) => (
              <div key={item.id} style={{
                border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
                opacity: item.is_active ? 1 : 0.5, position: 'relative',
              }}>
                {idx < 4 && (
                  <span style={{
                    position: 'absolute', top: 6, left: 6, background: 'var(--brand-brown)',
                    color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, zIndex: 1,
                  }}>Tampil #{idx + 1}</span>
                )}
                {resolveImg(item.image_path) ? (
                  <img src={resolveImg(item.image_path)} alt={item.title || ''}
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '4/3', background: 'rgba(237,200,174,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>
                    Tidak ada gambar
                  </div>
                )}
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    {item.title || <span style={{ color: '#aaa' }}>Tanpa judul</span>}
                  </p>
                  {item.link_url && (
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.link_url}
                    </p>
                  )}
                  <div className="adm-actions" style={{ marginTop: 8 }}>
                    <button className="adm-btn" type="button" style={{ padding: '3px 8px', fontSize: 12 }}
                      onClick={() => handleMoveUp(idx)} disabled={idx === 0} aria-label="Pindah ke atas">â†‘</button>
                    <button className="adm-btn" type="button" style={{ padding: '3px 8px', fontSize: 12 }}
                      onClick={() => handleMoveDown(idx)} disabled={idx >= items.length - 1} aria-label="Pindah ke bawah">â†“</button>
                    <button className="adm-btn adm-btn--edit" type="button"
                      onClick={() => { setEditing(item); setModalOpen(true); }}>Edit</button>
                    <button className="adm-btn adm-btn--delete" type="button"
                      onClick={() => handleDelete(item.id)}>Hapus</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <DesignItemModal
          item={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </>
  );
}

// â”€â”€ C. Category Banners Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CatBannerModal({ banner, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    categoryId: banner?.category_id  || '',
    title:      banner?.title        || '',
    imagePath:  banner?.image_path   || '',
    linkUrl:    banner?.link_url     || '',
    ctaText:    banner?.cta_text     || 'Lihat Semua â†’',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveCatBanner({
        categoryId: form.categoryId || null,
        title:      form.title      || null,
        imagePath:  form.imagePath  || null,
        linkUrl:    form.linkUrl    || null,
        ctaText:    form.ctaText    || 'Lihat Semua â†’',
      });
      showToast('Category banner disimpan.', 'success');
      onSaved();
      onClose();
    } catch {
      setError('Gagal menyimpan banner.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cb-modal-title">
      <div className="adm-modal" style={{ maxWidth: 540 }}>
        <div className="adm-modal-header">
          <h2 className="adm-modal-title" id="cb-modal-title">
            {banner ? 'Edit Category Banner' : 'Tambah Category Banner'}
          </h2>
          <button className="adm-modal-close" type="button" aria-label="Tutup" onClick={onClose}>âœ•</button>
        </div>
        <div className="adm-modal-body">
          <form className="adm-form" onSubmit={handleSubmit} noValidate>
            <div className="adm-field">
              <label className="adm-label" htmlFor="cb-cat">Kategori</label>
              <select className="adm-input" id="cb-cat" name="categoryId"
                value={form.categoryId} onChange={handleChange}>
                <option value="">â€” Produk (tanpa kategori) â€”</option>
                {categories.map((c) => (
                  <option key={c.id || c} value={c.id || c}>{c.name || c}</option>
                ))}
              </select>
            </div>
            <ImagePickerField
              label="Gambar Banner"
              currentUrl={form.imagePath}
              onUrlChange={(url) => setForm((prev) => ({ ...prev, imagePath: url }))}
              uploading={uploading}
              setUploading={setUploading}
            />
            <div className="adm-field">
              <label className="adm-label" htmlFor="cb-title">Judul Banner (opsional)</label>
              <input className="adm-input" id="cb-title" name="title"
                value={form.title} onChange={handleChange} placeholder="Nama kategori" />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="cb-link">Link Tujuan (opsional)</label>
              <input className="adm-input" id="cb-link" name="linkUrl"
                value={form.linkUrl} onChange={handleChange} placeholder="/products?cat=..." />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="cb-cta">Teks Tombol CTA</label>
              <input className="adm-input" id="cb-cta" name="ctaText"
                value={form.ctaText} onChange={handleChange} placeholder="Lihat Semua â†’" />
            </div>
            {/* Preview */}
            <div style={{ marginBottom: 12 }}>
              <p className="adm-label" style={{ marginBottom: 6 }}>Preview Banner</p>
              <div style={{
                width: 160, height: 200, borderRadius: 6, overflow: 'hidden',
                position: 'relative', background: 'rgba(237,200,174,0.5)',
                backgroundImage: form.imagePath ? `url(${resolveImg(form.imagePath)})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '10px 12px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)',
                }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff',
                    textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                    {form.title || 'â€”'}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                    {form.ctaText}
                  </p>
                </div>
              </div>
            </div>
            {error && <div className="adm-form-alert" role="alert">{error}</div>}
            <div className="adm-form-actions">
              <button className="adm-btn adm-btn--primary" type="submit" disabled={saving || uploading}>
                {saving ? 'Menyimpanâ€¦' : 'Simpan'}
              </button>
              <button className="adm-btn" type="button" onClick={onClose} disabled={saving}>Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CatBannersTab() {
  const [banners, setBanners]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [b, cats] = await Promise.all([
        listCatBanners(),
        fetchCategoriesWithIds(),
      ]);
      setBanners(b);
      setCategories(cats);
    } catch {
      showToast('Gagal memuat category banners.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!window.confirm('Hapus category banner ini?')) return;
    try {
      await deleteCatBanner(id);
      showToast('Banner dihapus.', 'success');
      load();
    } catch { showToast('Gagal menghapus.', 'error'); }
  }

  return (
    <>
      <div className="adm-card">
        <div className="adm-toolbar">
          <h2 className="adm-section-title">Category Banners</h2>
          <div className="adm-toolbar-right">
            <button className="adm-btn adm-btn--primary" type="button"
              onClick={() => { setEditing(null); setModalOpen(true); }}>
              + Tambah Banner
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ padding: 16, color: '#6b7280' }}>Memuatâ€¦</p>
        ) : banners.length === 0 ? (
          <p style={{ padding: 16, color: '#6b7280' }}>
            Belum ada category banner. Tambahkan banner untuk setiap section kategori di Homepage.
          </p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Gambar</th>
                  <th>Kategori</th>
                  <th>Judul</th>
                  <th>Link</th>
                  <th>CTA</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.imageUrl ? (
                        <img src={b.imageUrl} alt="" style={{ width: 60, height: 40,
                          objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : <span style={{ color: '#ccc', fontSize: 12 }}>â€”</span>}
                    </td>
                    <td>{b.category_name || b.categoryName || '(Produk)'}</td>
                    <td>{b.title || 'â€”'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {b.linkUrl || 'â€”'}
                    </td>
                    <td style={{ fontSize: 12 }}>{b.ctaText}</td>
                    <td>
                      <div className="adm-actions">
                        <button className="adm-btn adm-btn--edit" type="button"
                          onClick={() => { setEditing(b); setModalOpen(true); }}>Edit</button>
                        <button className="adm-btn adm-btn--delete" type="button"
                          onClick={() => handleDelete(b.id)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <CatBannerModal
          banner={editing}
          categories={categories}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </>
  );
}

// â”€â”€ Root HomepageSection with tab switching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ E. Full Homepage Preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Uses the exact same CSS classes as home.css + real ProductCard component
// so the preview looks pixel-identical to what the customer sees.

const PER_SECTION = 8;

function PreviewHeroCarousel({ slides }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  const timerRef = useRef(null);
  const total = slides.length;

  const goTo = useCallback((idx) => setCurrent((idx + total) % total), [total]);

  useEffect(() => {
    if (total <= 1 || paused) return;
    timerRef.current = setInterval(() => setCurrent((p) => (p + 1) % total), 5000);
    return () => clearInterval(timerRef.current);
  }, [total, paused]);

  useEffect(() => { setCurrent(0); }, [total]);

  if (total === 0) {
    return (
      <section className="home-hero" aria-label="Hero banner">
        <div className="home-hero-inner">
          <p className="home-hero-label">LANDING PAGE</p>
          <p className="home-hero-sub">4+ PAGE</p>
        </div>
      </section>
    );
  }

  const slide = slides[current];
  return (
    <section
      className="home-hero home-hero--carousel"
      aria-label="Hero banner"
      data-has-image={slide.image_path ? 'true' : 'false'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="home-hero-slides">
        {slides.map((s, i) => (
          <div key={s.id}
            className={`home-hero-slide${i === current ? ' home-hero-slide--active' : ''}`}
            style={s.image_path ? { backgroundImage: `url(${resolveImg(s.image_path)})`,
              backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            aria-hidden={i !== current} />
        ))}
      </div>
      <div className="home-hero-content">
        <div className="home-hero-inner">
          {slide.title    && <p className="home-hero-label">{slide.title}</p>}
          {slide.subtitle && <p className="home-hero-sub">{slide.subtitle}</p>}
        </div>
      </div>
      {total > 1 && (
        <>
          <button className="home-hero-arrow home-hero-arrow--prev" type="button"
            aria-label="Slide sebelumnya" onClick={() => goTo(current - 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="home-hero-arrow home-hero-arrow--next" type="button"
            aria-label="Slide berikutnya" onClick={() => goTo(current + 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <div className="home-hero-dots">
            {slides.map((s, i) => (
              <button key={s.id}
                className={`home-hero-dot${i === current ? ' home-hero-dot--active' : ''}`}
                type="button" aria-label={`Slide ${i + 1}`} onClick={() => goTo(i)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PreviewDesignShowcase({ items }) {
  const visible = items.slice(0, 4);
  return (
    <div className="home-cat-grid">
      {(visible.length > 0 ? visible : Array(4).fill(null)).map((item, i) => (
        <div key={item?.id ?? i} className={`home-cat-item ${item ? 'home-cat-item--showcase' : 'home-cat-placeholder'}`}>
          {item?.image_path && (
            <img src={resolveImg(item.image_path)} alt={item?.title || ''} className="home-cat-item-img"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
          {item?.title && <span className="home-cat-item-label">{item.title}</span>}
        </div>
      ))}
    </div>
  );
}

function PreviewProductSection({ products, category, reverse, bannerData }) {
  const name    = bannerData?.title || category?.name || 'Produk';
  const ctaText = bannerData?.cta_text || 'Lihat Semua â†’';
  const bgImage = bannerData?.image_path ? `url(${resolveImg(bannerData.image_path)})` : undefined;

  const bannerEl = (
    <div className="home-section-banner-wrap">
      <div className="home-section-banner">
        <div className="home-section-banner-bg"
          style={bgImage ? { backgroundImage: bgImage, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
        <div className="home-section-banner-label">
          <span className="home-section-banner-name">{name}</span>
          <span className="home-section-banner-cta">{ctaText}</span>
        </div>
      </div>
    </div>
  );

  const gridEl = (
    <div className="home-section-grid" data-cols="4">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );

  return (
    <section className={`home-product-section${reverse ? ' home-product-section--reverse' : ''}`}
      aria-label={category?.name ?? 'Produk'}>
      {reverse ? <>{gridEl}{bannerEl}</> : <>{bannerEl}{gridEl}</>}
    </section>
  );
}

function HomepageFullPreview() {
  const [heroBanners, setHeroBanners] = useState([]);
  const [designItems, setDesignItems] = useState([]);
  const [catBanners, setCatBanners]   = useState({});
  const [products, setProducts]       = useState([]);
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [bannersData, designData, catBannersData, prods, catsRes] = await Promise.all([
          listAllHeroBanners().catch(() => []),
          listAllDesignItems().catch(() => []),
          listCatBanners().catch(() => []),
          // listProducts() uses normalizeProduct() which calls resolveApiUrl on image paths
          listProducts().catch(() => []),
          api.get('/api/categories').catch(() => ({ data: [] })),
        ]);

        setHeroBanners(Array.isArray(bannersData) ? bannersData.filter((b) => b.is_active) : []);
        setDesignItems(Array.isArray(designData)  ? designData.filter((d) => d.is_active).slice(0, 4) : []);

        const catBannerMap = {};
        (Array.isArray(catBannersData) ? catBannersData : []).forEach((b) => {
          const key = b.category_id ?? b.categoryId ?? '__uncategorised__';
          catBannerMap[String(key)] = b;
        });
        setCatBanners(catBannerMap);

        // prods already has resolved image URLs from normalizeProduct()
        setProducts(Array.isArray(prods) ? prods : []);

        const rawCats = catsRes.data?.data ?? catsRes.data?.items ?? catsRes.data ?? [];
        setCategories(Array.isArray(rawCats) ? rawCats.map((c) =>
          typeof c === 'string' ? { id: c, name: c } : c
        ) : []);
      } catch (err) {
        console.error('[HomepageFullPreview] load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="adm-card" style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
        <p>Memuat preview homepageâ€¦</p>
      </div>
    );
  }

  // Group products by category â€” same logic as real HomePage
  const grouped = categories
    .map((cat) => ({
      category: cat,
      products: products.filter((p) => p.category === cat.name),
    }))
    .filter((g) => g.products.length > 0);

  const categorisedIds = new Set(grouped.flatMap((g) => g.products.map((p) => p.id)));
  const uncategorised  = products.filter((p) => !categorisedIds.has(p.id));
  if (uncategorised.length) grouped.push({ category: null, products: uncategorised });

  return (
    <div style={{ border: '2px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Admin label bar */}
      <div style={{
        padding: '9px 16px', background: 'var(--brand-brown, #785e40)', color: '#fff',
        fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>ðŸ  PREVIEW HOMEPAGE â€” tampilan customer</span>
        <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12, opacity: 0.75 }}>
          scroll untuk melihat seluruh halaman
        </span>
      </div>

      {/* â”€â”€ Exact same structure as public HomePage â”€â”€ */}
      <main style={{ background: '#fff' }}>
        {/* Hero carousel */}
        <div className="container">
          <PreviewHeroCarousel slides={heroBanners} />
        </div>

        <div className="container">
          {/* Design Showcase + Search */}
          <section className="home-categories" aria-label="Design showcase">
            <PreviewDesignShowcase items={designItems} />
            <div className="home-search-row">
              <span className="home-search-greeting">
                Hallo, <strong>Mau Pesan apa?</strong>
              </span>
              <div className="home-search-input-wrap">
                <input
                  className="home-search-input"
                  type="search"
                  placeholder="Cari semua produk disini..."
                  aria-label="Cari produk"
                  readOnly
                />
                <button className="home-search-btn" type="button" aria-label="Cari">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                  </svg>
                </button>
              </div>
            </div>
          </section>

          {/* Custom Order section */}
          <section className="home-custom-order card" aria-label="Custom Order">
            <div className="home-custom-drop">
              <DropZone
                accept=".jpg,.jpeg,.png,.pdf,.ai,.cdr,image/jpeg,image/png,application/pdf"
                onFiles={() => {}}
                label="Drop your design here"
                hint="JPG, PNG, PDF, AI, CDR"
              />
            </div>
            <div className="home-custom-info">
              <h2 className="home-custom-title">Custom Order</h2>
              <p className="home-custom-desc">
                Silahkan masukkan design kamu ke dalam kotak yang telah disediakan.
              </p>
              <p className="home-custom-desc">
                Kamu akan diminta untuk mengisi beberapa keterangan mengenai pesanan kamu.
              </p>
              <span className="btn home-custom-btn" style={{ cursor: 'default' }}>
                Buat Pesanan
              </span>
            </div>
          </section>

          {/* Product sections grouped by category */}
          <div id="home-product-sections">
            {grouped.length === 0 ? (
              <p className="muted" style={{ padding: '24px 0' }}>Belum ada produk.</p>
            ) : (
              grouped.map((group, idx) => {
                const chunks = [];
                for (let i = 0; i < group.products.length; i += PER_SECTION) {
                  chunks.push(group.products.slice(i, i + PER_SECTION));
                }
                const bannerKey  = group.category?.id ? String(group.category.id) : '__uncategorised__';
                const bannerData = catBanners[bannerKey] || null;
                return chunks.map((chunk, chunkIdx) => (
                  <PreviewProductSection
                    key={`${group.category?.id ?? 'uncategorised'}-${chunkIdx}`}
                    products={chunk}
                    category={group.category}
                    reverse={idx % 2 !== 0}
                    bannerData={bannerData}
                  />
                ));
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const TABS = [
  { id: 'hero',        label: 'Landing Page Banner' },
  { id: 'design',      label: 'Design Showcase' },
  { id: 'banners',     label: 'Category Banners' },
  { id: 'fullpreview', label: 'ðŸ  Preview Homepage' },
];

export default function HomepageSection() {
  const [activeTab, setActiveTab] = useState('hero');

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0, flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--brand-brown)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--brand-brown)' : '#555',
              cursor: 'pointer',
              marginBottom: -2,
              borderRadius: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'hero'        && <HeroTab />}
      {activeTab === 'design'      && <DesignShowcaseTab />}
      {activeTab === 'banners'     && <CatBannersTab />}
      {activeTab === 'fullpreview' && <HomepageFullPreview />}
    </div>
  );
}
