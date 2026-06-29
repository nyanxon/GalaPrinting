/**
 * HomepageSection.jsx — Admin panel section for managing Homepage content.
 *
 * Tabs:
 *   A. Landing Page Banner (hero)
 *   B. Design Showcase    (up to 4 design items)
 *   C. Category Banners   (per-category section banners)
 */

import { useState, useEffect, useRef } from 'react';
import { showToast } from '../../../../core/toastEmitter.js';
import { resolveApiUrl } from '../../../../core/httpClient.js';
import DropZone from '../../../shared/DropZone.jsx';
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

// ── Small shared helpers ──────────────────────────────────────────────────────

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

// ── ImagePickerField ──────────────────────────────────────────────────────────
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
        label={uploading ? 'Mengunggah…' : (preview ? 'Ganti gambar' : undefined)}
        hint="JPG, PNG, WEBP · Maks. 10 MB"
      />
    </div>
  );
}

// ── A. Hero Banners Tab (carousel — up to 8 slides) ──────────────────────────

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
          <button className="adm-modal-close" type="button" aria-label="Tutup" onClick={onClose}>✕</button>
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
                {saving ? 'Menyimpan…' : (banner ? 'Simpan Perubahan' : 'Tambah Banner')}
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
                      onClick={() => handleMove(idx, 'up')} disabled={idx === 0} aria-label="Pindah ke atas">↑</button>
                    <button className="adm-btn" type="button" style={{ padding: '3px 8px', fontSize: 12 }}
                      onClick={() => handleMove(idx, 'down')} disabled={idx >= banners.length - 1} aria-label="Pindah ke bawah">↓</button>
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

// ── B. Design Showcase Tab ────────────────────────────────────────────────────

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
    } catch (err) {
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
          <button className="adm-modal-close" type="button" aria-label="Tutup" onClick={onClose}>✕</button>
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
                {saving ? 'Menyimpan…' : (item ? 'Simpan Perubahan' : 'Tambah')}
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
          <p style={{ padding: 16, color: '#6b7280' }}>Memuat…</p>
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
                      onClick={() => handleMoveUp(idx)} disabled={idx === 0} aria-label="Pindah ke atas">↑</button>
                    <button className="adm-btn" type="button" style={{ padding: '3px 8px', fontSize: 12 }}
                      onClick={() => handleMoveDown(idx)} disabled={idx >= items.length - 1} aria-label="Pindah ke bawah">↓</button>
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

// ── C. Category Banners Tab ───────────────────────────────────────────────────

function CatBannerModal({ banner, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    categoryId: banner?.category_id  || '',
    title:      banner?.title        || '',
    imagePath:  banner?.image_path   || '',
    linkUrl:    banner?.link_url     || '',
    ctaText:    banner?.cta_text     || 'Lihat Semua →',
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
        ctaText:    form.ctaText    || 'Lihat Semua →',
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
          <button className="adm-modal-close" type="button" aria-label="Tutup" onClick={onClose}>✕</button>
        </div>
        <div className="adm-modal-body">
          <form className="adm-form" onSubmit={handleSubmit} noValidate>
            <div className="adm-field">
              <label className="adm-label" htmlFor="cb-cat">Kategori</label>
              <select className="adm-input" id="cb-cat" name="categoryId"
                value={form.categoryId} onChange={handleChange}>
                <option value="">— Produk (tanpa kategori) —</option>
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
                value={form.ctaText} onChange={handleChange} placeholder="Lihat Semua →" />
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
                    {form.title || '—'}
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
                {saving ? 'Menyimpan…' : 'Simpan'}
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
          <p style={{ padding: 16, color: '#6b7280' }}>Memuat…</p>
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
                      ) : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
                    </td>
                    <td>{b.category_name || b.categoryName || '(Produk)'}</td>
                    <td>{b.title || '—'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {b.linkUrl || '—'}
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

// ── Root HomepageSection with tab switching ───────────────────────────────────

// ── D. Design Preview Carousel (interactive preview for superadmin) ──────────

function DesignPreviewCarousel() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try { setItems(await listAllDesignItems()); }
      catch { showToast('Gagal memuat design items.', 'error'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const active = items.filter((it) => it.is_active);
  const total  = active.length;

  useEffect(() => {
    if (total <= 1 || paused) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % total);
    }, 3500);
    return () => clearInterval(timerRef.current);
  }, [total, paused]);

  useEffect(() => { setCurrent(0); }, [total]);

  function goTo(idx) { setCurrent((idx + total) % total); }

  if (loading) {
    return <p style={{ padding: 16, color: '#6b7280' }}>Memuat…</p>;
  }

  if (active.length === 0) {
    return (
      <div className="adm-card" style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
        <p style={{ fontSize: 16, marginBottom: 8 }}>Belum ada design item aktif.</p>
        <p style={{ fontSize: 13 }}>Tambahkan design di tab <strong>Design Showcase</strong> terlebih dahulu.</p>
      </div>
    );
  }

  const item = active[current];

  return (
    <div className="adm-card">
      <div className="adm-toolbar" style={{ marginBottom: 16 }}>
        <h2 className="adm-section-title">
          Preview Design Showcase
          <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>
            ({total} design aktif)
          </span>
        </h2>
      </div>

      {/* Main carousel */}
      <div
        style={{ position: 'relative', userSelect: 'none' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Slide */}
        <div style={{
          width: '100%',
          aspectRatio: '16/7',
          borderRadius: 10,
          overflow: 'hidden',
          position: 'relative',
          background: '#f3e9df',
          boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
        }}>
          {active.map((it, i) => (
            <div
              key={it.id}
              style={{
                position: 'absolute', inset: 0,
                opacity: i === current ? 1 : 0,
                transition: 'opacity 0.5s ease',
                pointerEvents: i === current ? 'auto' : 'none',
              }}
            >
              {resolveImg(it.image_path) ? (
                <img
                  src={resolveImg(it.image_path)}
                  alt={it.title || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13,
                }}>
                  Tidak ada gambar
                </div>
              )}
              {it.title && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '18px 20px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
                }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 18, color: '#fff',
                    textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>{it.title}</p>
                </div>
              )}
            </div>
          ))}

          {/* Prev / Next arrows */}
          {total > 1 && (
            <>
              <button
                type="button"
                aria-label="Slide sebelumnya"
                onClick={() => goTo(current - 1)}
                style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.18)', zIndex: 2,
                  fontSize: 16, color: '#785e40',
                }}
              >‹</button>
              <button
                type="button"
                aria-label="Slide berikutnya"
                onClick={() => goTo(current + 1)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%',
                  width: 36, height: 36, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.18)', zIndex: 2,
                  fontSize: 16, color: '#785e40',
                }}
              >›</button>
            </>
          )}
        </div>

        {/* Dot indicators */}
        {total > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            {active.map((it, i) => (
              <button
                key={it.id}
                type="button"
                aria-label={`Design ${i + 1}`}
                onClick={() => goTo(i)}
                style={{
                  width: i === current ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  border: 'none',
                  cursor: 'pointer',
                  background: i === current ? 'var(--brand-brown, #785e40)' : 'rgba(120,94,64,0.25)',
                  transition: 'width 0.3s ease, background 0.3s ease',
                  padding: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div style={{
          display: 'flex', gap: 10, marginTop: 16,
          overflowX: 'auto', paddingBottom: 4,
        }}>
          {active.map((it, i) => (
            <button
              key={it.id}
              type="button"
              aria-label={it.title || `Design ${i + 1}`}
              onClick={() => goTo(i)}
              style={{
                flex: '0 0 auto',
                width: 80, height: 56,
                borderRadius: 6,
                overflow: 'hidden',
                border: `2px solid ${i === current ? 'var(--brand-brown, #785e40)' : 'transparent'}`,
                cursor: 'pointer',
                padding: 0,
                background: '#f3e9df',
                opacity: i === current ? 1 : 0.65,
                transition: 'opacity 0.2s, border-color 0.2s',
              }}
            >
              {resolveImg(it.image_path) ? (
                <img
                  src={resolveImg(it.image_path)}
                  alt={it.title || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 10 }}>
                  —
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Current item info */}
      <div style={{ marginTop: 12, padding: '10px 14px', background: '#f9f5f1', borderRadius: 8,
        fontSize: 13, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 600, color: '#785e40' }}>#{current + 1} / {total}</span>
        <span>{item.title || <em>Tanpa judul</em>}</span>
        {item.link_url && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
            🔗 {item.link_url}
          </span>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'hero',    label: 'Landing Page Banner' },
  { id: 'design',  label: 'Design Showcase' },
  { id: 'banners', label: 'Category Banners' },
  { id: 'preview', label: '▶ Preview Design' },
];

export default function HomepageSection() {
  const [activeTab, setActiveTab] = useState('hero');

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
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
      {activeTab === 'hero'    && <HeroTab />}
      {activeTab === 'design'  && <DesignShowcaseTab />}
      {activeTab === 'banners' && <CatBannersTab />}
      {activeTab === 'preview' && <DesignPreviewCarousel />}
    </div>
  );
}
