/**
 * CustomOrderPage.jsx — Customer custom order creation page.
 *
 * Layout: Preview kiri (uploaded design file) + Form kanan
 * Flow: Customer upload file → isi form → submit ke /api/orders/custom-customer
 *       → order tersimpan dengan status "Waiting for Design Approval"
 */

import { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { api } from '../../../core/httpClient.js';
import { showToast } from '../../../core/toastEmitter.js';
import DropZone from '../../ui/DropZone.jsx';
import '../../../styles/css/pages/customOrder.css';

export default function CustomOrderPage() {
  const { user } = useContext(AuthContext);
  const navigate  = useNavigate();
  const location  = useLocation();

  // File bawaan dari homepage drop zone (jika ada)
  const fileFromHome = location.state?.designFile || null;

  const [designFile, setDesignFile] = useState(fileFromHome);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Form fields
  const [productType, setProductType] = useState('');
  const [width,       setWidth]       = useState('');
  const [height,      setHeight]      = useState('');
  const [material,    setMaterial]    = useState('');
  const [color,       setColor]       = useState('');
  const [quantity,    setQuantity]    = useState(1);
  const [notes,       setNotes]       = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting,  setSubmitting]  = useState(false);

  // Build preview untuk file bawaan dari homepage
  useEffect(() => {
    if (fileFromHome && fileFromHome.type?.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(fileFromHome);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: harus login sebagai customer
  if (!user) {
    return (
      <main className="custom-order-page">
        <div className="container">
          <div className="custom-order-auth-guard">
            <div className="custom-order-auth-icon">🔒</div>
            <h2>Login Diperlukan</h2>
            <p>Silakan login terlebih dahulu untuk membuat custom order.</p>
            <button
              className="custom-order-btn custom-order-btn--primary"
              onClick={() => navigate('/register')}
            >
              Ke Halaman Login
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── File handler ────────────────────────────────────────────────────────────
  function handleFileUpload(files) {
    const file = files?.[0];
    if (!file) return;
    setDesignFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
    setFieldErrors((p) => ({ ...p, designFile: null }));
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate() {
    const errors = {};
    if (!designFile)              errors.designFile   = 'File desain wajib diunggah.';
    if (!productType.trim())      errors.productType  = 'Jenis produk wajib diisi.';
    if (!width  || Number(width)  <= 0) errors.width  = 'Lebar wajib diisi.';
    if (!height || Number(height) <= 0) errors.height = 'Tinggi wajib diisi.';
    if (!material.trim())         errors.material     = 'Bahan wajib diisi.';
    if (!quantity || Number(quantity) < 1) errors.quantity = 'Jumlah minimal 1.';
    return errors;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showToast('Mohon lengkapi semua field yang diperlukan.', 'error');
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      // 1. Upload design file
      const formData = new FormData();
      formData.append('file', designFile);
      const uploadRes = await api.post('/api/upload/design', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const designFilePath = uploadRes.data.path;

      // 2. Susun item notes dari field-field yang ada
      const itemNotes = [
        color  ? `Warna: ${color.trim()}`   : '',
        notes  ? `Catatan: ${notes.trim()}` : '',
      ].filter(Boolean).join('\n');

      // 3. Buat custom order via endpoint customer
      await api.post('/api/orders/custom-customer', {
        subtotal: 0, // Harga ditentukan CS
        items: [
          {
            name:            `Custom Order - ${productType.trim()}`,
            price:           0,
            quantity:        Number(quantity),
            size:            `${width} x ${height} cm`,
            material:        material.trim(),
            color:           color.trim() || null,
            notes:           itemNotes || null,
            designFilePath,
          },
        ],
      });

      showToast('Custom order berhasil dibuat! CS kami akan menghubungi Anda segera.', 'success');
      navigate('/my-orders');
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal membuat custom order. Coba lagi.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Preview helpers ─────────────────────────────────────────────────────────
  const isZip = designFile?.name?.toLowerCase().endsWith('.zip') ||
                designFile?.type === 'application/zip' ||
                designFile?.type === 'application/x-zip-compressed';

  const isAi  = designFile?.name?.toLowerCase().endsWith('.ai');
  const isCdr = designFile?.name?.toLowerCase().endsWith('.cdr');
  const isUnsupported = isZip || isAi || isCdr;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="custom-order-page">
      <div className="container">
        {/* Breadcrumb */}
        <div className="custom-order-breadcrumb">
          <button type="button" className="custom-order-back" onClick={() => navigate('/')}>
            ← Beranda
          </button>
          <span className="custom-order-breadcrumb-sep">/</span>
          <span>Custom Order</span>
        </div>

        <div className="custom-order-layout">

          {/* ── KIRI: Preview ──────────────────────────────────────────── */}
          <aside className="custom-order-preview">
            <div className="custom-order-preview-card">
              <div className="custom-order-preview-label">🖼️ Preview Desain</div>

              {!designFile ? (
                <div className="custom-order-preview-empty">
                  <div className="custom-order-preview-empty-icon">📁</div>
                  <p className="custom-order-preview-empty-text">
                    Belum ada file yang diunggah
                  </p>
                  <p className="custom-order-preview-empty-hint">
                    Upload file desain untuk melihat preview
                  </p>
                </div>

              ) : isUnsupported ? (
                <div className="custom-order-preview-unsupported">
                  <div className="custom-order-preview-unsupported-icon">
                    {isZip ? '📦' : '🎨'}
                  </div>
                  <p className="custom-order-preview-unsupported-text">
                    File not supported to be viewed
                  </p>
                  <p className="custom-order-preview-filename">{designFile.name}</p>
                </div>

              ) : previewUrl ? (
                <div className="custom-order-preview-image-wrap">
                  <img
                    src={previewUrl}
                    alt="Preview desain"
                    className="custom-order-preview-image"
                  />
                  <p className="custom-order-preview-filename">{designFile.name}</p>
                </div>

              ) : (
                <div className="custom-order-preview-file">
                  <div className="custom-order-preview-file-icon">📄</div>
                  <p className="custom-order-preview-filename">{designFile.name}</p>
                  <p className="custom-order-preview-file-type">{designFile.type || 'Tipe tidak dikenali'}</p>
                </div>
              )}
            </div>

            {/* Info box di bawah preview */}
            <div className="custom-order-info-box">
              <strong>ℹ️ Informasi</strong>
              <p>
                Setelah submit, CS kami akan menghubungi untuk konfirmasi
                harga dan spesifikasi. Pembayaran dilakukan setelah
                Anda menyetujui penawaran.
              </p>
            </div>
          </aside>

          {/* ── KANAN: Form ────────────────────────────────────────────── */}
          <div className="custom-order-form-wrap">
            <h1 className="custom-order-title">Buat Custom Order</h1>
            <p className="custom-order-subtitle">
              Isi detail pesanan Anda. Semua field bertanda{' '}
              <span className="custom-required">*</span> wajib diisi.
            </p>

            <form className="custom-order-form" onSubmit={handleSubmit} noValidate>

              {/* File Desain */}
              <div className="custom-order-field">
                <label className="custom-order-label">
                  File Desain <span className="custom-required">*</span>
                </label>
                {designFile ? (
                  <div className="custom-order-file-uploaded">
                    <span className="custom-order-file-name">📎 {designFile.name}</span>
                    <button
                      type="button"
                      className="custom-order-file-remove"
                      aria-label="Hapus file"
                      onClick={() => { setDesignFile(null); setPreviewUrl(null); }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className={`custom-order-dropzone-wrap${fieldErrors.designFile ? ' custom-order-dropzone-wrap--error' : ''}`}>
                    <DropZone
                      accept=".jpg,.jpeg,.png,.pdf,.zip,.ai,.cdr,image/jpeg,image/png,application/pdf,application/zip"
                      onFiles={handleFileUpload}
                      label="Klik atau drag & drop file desain"
                      hint="JPG, PNG, PDF, ZIP, AI, CDR — Maks. 100 MB"
                    />
                  </div>
                )}
                {fieldErrors.designFile && (
                  <span className="custom-field-error">{fieldErrors.designFile}</span>
                )}
              </div>

              {/* Jenis Produk — free text */}
              <div className="custom-order-field">
                <label className="custom-order-label" htmlFor="co-product-type">
                  Jenis Produk <span className="custom-required">*</span>
                </label>
                <input
                  id="co-product-type"
                  className={`custom-order-input${fieldErrors.productType ? ' custom-order-input--error' : ''}`}
                  type="text"
                  placeholder="Contoh: Banner, Brosur, Stiker, X-Banner, dll"
                  value={productType}
                  onChange={(e) => {
                    setProductType(e.target.value);
                    setFieldErrors((p) => ({ ...p, productType: null }));
                  }}
                />
                {fieldErrors.productType && (
                  <span className="custom-field-error">{fieldErrors.productType}</span>
                )}
              </div>

              {/* Ukuran */}
              <div className="custom-order-field-group">
                <div className="custom-order-field">
                  <label className="custom-order-label" htmlFor="co-width">
                    Lebar (cm) <span className="custom-required">*</span>
                  </label>
                  <input
                    id="co-width"
                    className={`custom-order-input${fieldErrors.width ? ' custom-order-input--error' : ''}`}
                    type="number"
                    min="1"
                    placeholder="100"
                    value={width}
                    onChange={(e) => {
                      setWidth(e.target.value);
                      setFieldErrors((p) => ({ ...p, width: null }));
                    }}
                  />
                  {fieldErrors.width && <span className="custom-field-error">{fieldErrors.width}</span>}
                </div>
                <div className="custom-order-field">
                  <label className="custom-order-label" htmlFor="co-height">
                    Tinggi (cm) <span className="custom-required">*</span>
                  </label>
                  <input
                    id="co-height"
                    className={`custom-order-input${fieldErrors.height ? ' custom-order-input--error' : ''}`}
                    type="number"
                    min="1"
                    placeholder="150"
                    value={height}
                    onChange={(e) => {
                      setHeight(e.target.value);
                      setFieldErrors((p) => ({ ...p, height: null }));
                    }}
                  />
                  {fieldErrors.height && <span className="custom-field-error">{fieldErrors.height}</span>}
                </div>
              </div>

              {/* Bahan — free text */}
              <div className="custom-order-field">
                <label className="custom-order-label" htmlFor="co-material">
                  Bahan <span className="custom-required">*</span>
                </label>
                <input
                  id="co-material"
                  className={`custom-order-input${fieldErrors.material ? ' custom-order-input--error' : ''}`}
                  type="text"
                  placeholder="Contoh: Vinyl, Art Paper, MMT, Albatross, dll"
                  value={material}
                  onChange={(e) => {
                    setMaterial(e.target.value);
                    setFieldErrors((p) => ({ ...p, material: null }));
                  }}
                />
                {fieldErrors.material && (
                  <span className="custom-field-error">{fieldErrors.material}</span>
                )}
              </div>

              {/* Warna Produk */}
              <div className="custom-order-field">
                <label className="custom-order-label" htmlFor="co-color">
                  Warna Produk
                </label>
                <input
                  id="co-color"
                  className="custom-order-input"
                  type="text"
                  placeholder="Contoh: Full Color, Hitam Putih, Merah Putih, dll"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>

              {/* Jumlah */}
              <div className="custom-order-field">
                <label className="custom-order-label" htmlFor="co-qty">
                  Jumlah <span className="custom-required">*</span>
                </label>
                <input
                  id="co-qty"
                  className={`custom-order-input${fieldErrors.quantity ? ' custom-order-input--error' : ''}`}
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setFieldErrors((p) => ({ ...p, quantity: null }));
                  }}
                />
                {fieldErrors.quantity && (
                  <span className="custom-field-error">{fieldErrors.quantity}</span>
                )}
              </div>

              {/* Catatan */}
              <div className="custom-order-field">
                <label className="custom-order-label" htmlFor="co-notes">
                  Catatan Tambahan
                </label>
                <textarea
                  id="co-notes"
                  className="custom-order-input"
                  rows={4}
                  placeholder="Contoh: Finishing glossy, lubang ring, lipatan, dll..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="custom-order-actions">
                <button
                  type="button"
                  className="custom-order-btn custom-order-btn--secondary"
                  onClick={() => navigate('/')}
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="custom-order-btn custom-order-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? 'Memproses...' : '🎨 Buat Custom Order'}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </main>
  );
}
