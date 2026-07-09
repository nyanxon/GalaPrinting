/**
 * CustomOrderPage.jsx — Customer custom order creation page.
 *
 * Layout: Preview kiri (uploaded design file) + Form kanan
 * Pattern: Mengikuti struktur ProductPage dengan preview/form split layout
 *
 * Flow: Customer upload file → isi form → submit → order dengan status "Waiting for Design Approval"
 */

import { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { api } from '../../../core/httpClient.js';
import { formatCurrency } from '../../../core/helpers.js';
import { showToast } from '../../../core/toastEmitter.js';
import DropZone from '../../shared/DropZone.jsx';
import '../../../styles/css/pages/customOrder.css';

const PRODUCT_TYPES = [
  'Banner',
  'Brosur',
  'Kartu Nama',
  'Stiker',
  'X-Banner',
  'Poster',
  'Lainnya',
];

const MATERIALS = [
  'Vinyl',
  'Art Paper',
  'Glossy',
  'Matte',
  'Lainnya',
];

export default function CustomOrderPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // File dari homepage (jika ada)
  const uploadedFileFromHome = location.state?.designFile;

  const [designFile, setDesignFile]       = useState(uploadedFileFromHome || null);
  const [previewUrl, setPreviewUrl]       = useState(null);
  const [productType, setProductType]     = useState('');
  const [customProductType, setCustomProductType] = useState('');
  const [width, setWidth]                 = useState('');
  const [height, setHeight]               = useState('');
  const [material, setMaterial]           = useState('');
  const [customMaterial, setCustomMaterial] = useState('');
  const [quantity, setQuantity]           = useState(1);
  const [deadline, setDeadline]           = useState('');
  const [needDesign, setNeedDesign]       = useState(false);
  const [notes, setNotes]                 = useState('');

  const [fieldErrors, setFieldErrors]     = useState({});
  const [submitting, setSubmitting]       = useState(false);

  // Load preview jika file dari homepage ada
  useEffect(() => {
    if (uploadedFileFromHome) {
      if (uploadedFileFromHome.type?.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target.result);
        reader.readAsDataURL(uploadedFileFromHome);
      }
    }
  }, [uploadedFileFromHome]);

  if (!user) {
    showToast('Silakan login terlebih dahulu untuk membuat custom order.', 'info');
    navigate('/register');
    return null;
  }

  if (user.role !== 'customer') {
    showToast('Halaman ini khusus untuk customer.', 'error');
    navigate('/');
    return null;
  }

  function handleFileUpload(files) {
    const file = files?.[0];
    if (!file) return;

    setDesignFile(file);

    // Preview untuk image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }

    if (fieldErrors.designFile) {
      setFieldErrors((p) => ({ ...p, designFile: null }));
    }
  }

  function validate() {
    const errors = {};
    if (!designFile) errors.designFile = 'File desain wajib diunggah.';
    if (!productType) errors.productType = 'Jenis produk wajib dipilih.';
    if (productType === 'Lainnya' && !customProductType.trim()) {
      errors.customProductType = 'Sebutkan jenis produk.';
    }
    if (!width || Number(width) <= 0) errors.width = 'Lebar wajib diisi.';
    if (!height || Number(height) <= 0) errors.height = 'Tinggi wajib diisi.';
    if (!material) errors.material = 'Bahan wajib dipilih.';
    if (material === 'Lainnya' && !customMaterial.trim()) {
      errors.customMaterial = 'Sebutkan bahan.';
    }
    if (!quantity || Number(quantity) < 1) errors.quantity = 'Jumlah minimal 1.';
    return errors;
  }

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
      // Upload design file terlebih dahulu
      const formData = new FormData();
      formData.append('file', designFile);

      const uploadRes = await api.post('/api/upload/design', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const designFilePath = uploadRes.data.path;

      // Buat custom order
      const finalProductType = productType === 'Lainnya' ? customProductType.trim() : productType;
      const finalMaterial = material === 'Lainnya' ? customMaterial.trim() : material;

      const orderPayload = {
        items: [
          {
            name: `Custom Order - ${finalProductType}`,
            price: 0, // Harga akan ditentukan oleh CS saat nego
            quantity: Number(quantity),
            size: `${width} x ${height} cm`,
            material: finalMaterial,
            notes: `${needDesign ? '[BUTUH DESAIN] ' : ''}${notes || ''}`.trim(),
            designFilePath,
          },
        ],
        subtotal: 0,
        customerName: user.name,
        customerPhone: user.phone || '',
        customerAddress: user.address || '',
      };

      if (deadline) {
        orderPayload.items[0].notes += `\nDeadline: ${deadline}`;
      }

      const orderRes = await api.post('/api/orders/custom', orderPayload);

      showToast('Custom order berhasil dibuat! CS kami akan menghubungi Anda segera.', 'success');
      navigate('/my-orders');
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal membuat custom order.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const isZipFile = designFile?.name?.toLowerCase().endsWith('.zip') ||
                    designFile?.type === 'application/zip';

  return (
    <main className="custom-order-page">
      <div className="container">
        <div className="custom-order-layout">
          {/* ── Preview Kiri ── */}
          <div className="custom-order-preview">
            <div className="custom-order-preview-card">
              <div className="custom-order-preview-label">Preview Desain</div>
              {!designFile ? (
                <div className="custom-order-preview-empty">
                  <div className="custom-order-preview-empty-icon">📁</div>
                  <div className="custom-order-preview-empty-text">
                    Belum ada file yang diunggah
                  </div>
                </div>
              ) : isZipFile ? (
                <div className="custom-order-preview-not-supported">
                  <div className="custom-order-preview-zip-icon">📦</div>
                  <div className="custom-order-preview-zip-text">
                    File ZIP tidak dapat di-preview
                  </div>
                  <div className="custom-order-preview-filename">{designFile.name}</div>
                </div>
              ) : previewUrl ? (
                <div className="custom-order-preview-image-wrap">
                  <img
                    src={previewUrl}
                    alt="Preview desain"
                    className="custom-order-preview-image"
                  />
                  <div className="custom-order-preview-filename">{designFile.name}</div>
                </div>
              ) : (
                <div className="custom-order-preview-file">
                  <div className="custom-order-preview-file-icon">📄</div>
                  <div className="custom-order-preview-filename">{designFile.name}</div>
                  <div className="custom-order-preview-file-type">
                    {designFile.type || 'File tidak dapat di-preview'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Form Kanan ── */}
          <div className="custom-order-form-wrap">
            <h1 className="custom-order-title">Buat Custom Order</h1>
            <p className="custom-order-subtitle">
              Isi detail pesanan Anda di bawah ini. CS kami akan menghubungi untuk konfirmasi harga dan spesifikasi.
            </p>

            <form className="custom-order-form" onSubmit={handleSubmit} noValidate>
              {/* Upload Design File */}
              <div className="custom-order-field">
                <label className="custom-order-label">
                  File Desain <span className="custom-required">*</span>
                </label>
                {designFile ? (
                  <div className="custom-order-file-uploaded">
                    <span className="custom-order-file-name">
                      📎 {designFile.name}
                    </span>
                    <button
                      type="button"
                      className="custom-order-file-remove"
                      onClick={() => {
                        setDesignFile(null);
                        setPreviewUrl(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="custom-order-dropzone-compact">
                    <DropZone
                      accept=".jpg,.jpeg,.png,.pdf,.zip,.ai,.cdr,image/jpeg,image/png,application/pdf,application/zip"
                      onFiles={handleFileUpload}
                      label="Klik atau drag & drop file desain"
                      hint="JPG, PNG, PDF, ZIP, AI, CDR (Max 10MB)"
                    />
                  </div>
                )}
                {fieldErrors.designFile && (
                  <span className="custom-field-error">{fieldErrors.designFile}</span>
                )}
              </div>

              {/* Jenis Produk */}
              <div className="custom-order-field">
                <label className="custom-order-label">
                  Jenis Produk <span className="custom-required">*</span>
                </label>
                <select
                  className={`custom-order-input${fieldErrors.productType ? ' custom-order-input--error' : ''}`}
                  value={productType}
                  onChange={(e) => {
                    setProductType(e.target.value);
                    if (fieldErrors.productType) setFieldErrors((p) => ({ ...p, productType: null }));
                  }}
                >
                  <option value="">-- Pilih jenis produk --</option>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {fieldErrors.productType && (
                  <span className="custom-field-error">{fieldErrors.productType}</span>
                )}
              </div>

              {productType === 'Lainnya' && (
                <div className="custom-order-field">
                  <label className="custom-order-label">Sebutkan Jenis Produk</label>
                  <input
                    className={`custom-order-input${fieldErrors.customProductType ? ' custom-order-input--error' : ''}`}
                    type="text"
                    placeholder="Contoh: Spanduk, Roll Banner, dll"
                    value={customProductType}
                    onChange={(e) => {
                      setCustomProductType(e.target.value);
                      if (fieldErrors.customProductType) setFieldErrors((p) => ({ ...p, customProductType: null }));
                    }}
                  />
                  {fieldErrors.customProductType && (
                    <span className="custom-field-error">{fieldErrors.customProductType}</span>
                  )}
                </div>
              )}

              {/* Ukuran */}
              <div className="custom-order-field-group">
                <div className="custom-order-field">
                  <label className="custom-order-label">
                    Lebar (cm) <span className="custom-required">*</span>
                  </label>
                  <input
                    className={`custom-order-input${fieldErrors.width ? ' custom-order-input--error' : ''}`}
                    type="number"
                    min="1"
                    placeholder="100"
                    value={width}
                    onChange={(e) => {
                      setWidth(e.target.value);
                      if (fieldErrors.width) setFieldErrors((p) => ({ ...p, width: null }));
                    }}
                  />
                  {fieldErrors.width && (
                    <span className="custom-field-error">{fieldErrors.width}</span>
                  )}
                </div>

                <div className="custom-order-field">
                  <label className="custom-order-label">
                    Tinggi (cm) <span className="custom-required">*</span>
                  </label>
                  <input
                    className={`custom-order-input${fieldErrors.height ? ' custom-order-input--error' : ''}`}
                    type="number"
                    min="1"
                    placeholder="150"
                    value={height}
                    onChange={(e) => {
                      setHeight(e.target.value);
                      if (fieldErrors.height) setFieldErrors((p) => ({ ...p, height: null }));
                    }}
                  />
                  {fieldErrors.height && (
                    <span className="custom-field-error">{fieldErrors.height}</span>
                  )}
                </div>
              </div>

              {/* Bahan */}
              <div className="custom-order-field">
                <label className="custom-order-label">
                  Bahan <span className="custom-required">*</span>
                </label>
                <select
                  className={`custom-order-input${fieldErrors.material ? ' custom-order-input--error' : ''}`}
                  value={material}
                  onChange={(e) => {
                    setMaterial(e.target.value);
                    if (fieldErrors.material) setFieldErrors((p) => ({ ...p, material: null }));
                  }}
                >
                  <option value="">-- Pilih bahan --</option>
                  {MATERIALS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {fieldErrors.material && (
                  <span className="custom-field-error">{fieldErrors.material}</span>
                )}
              </div>

              {material === 'Lainnya' && (
                <div className="custom-order-field">
                  <label className="custom-order-label">Sebutkan Bahan</label>
                  <input
                    className={`custom-order-input${fieldErrors.customMaterial ? ' custom-order-input--error' : ''}`}
                    type="text"
                    placeholder="Contoh: Albatross, MMT, dll"
                    value={customMaterial}
                    onChange={(e) => {
                      setCustomMaterial(e.target.value);
                      if (fieldErrors.customMaterial) setFieldErrors((p) => ({ ...p, customMaterial: null }));
                    }}
                  />
                  {fieldErrors.customMaterial && (
                    <span className="custom-field-error">{fieldErrors.customMaterial}</span>
                  )}
                </div>
              )}

              {/* Jumlah */}
              <div className="custom-order-field">
                <label className="custom-order-label">
                  Jumlah <span className="custom-required">*</span>
                </label>
                <input
                  className={`custom-order-input${fieldErrors.quantity ? ' custom-order-input--error' : ''}`}
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    if (fieldErrors.quantity) setFieldErrors((p) => ({ ...p, quantity: null }));
                  }}
                />
                {fieldErrors.quantity && (
                  <span className="custom-field-error">{fieldErrors.quantity}</span>
                )}
              </div>

              {/* Deadline (opsional) */}
              <div className="custom-order-field">
                <label className="custom-order-label">Deadline (Opsional)</label>
                <input
                  className="custom-order-input"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              {/* Butuh Jasa Desain */}
              <div className="custom-order-field">
                <label className="custom-order-checkbox-label">
                  <input
                    type="checkbox"
                    checked={needDesign}
                    onChange={(e) => setNeedDesign(e.target.checked)}
                  />
                  <span>Saya butuh jasa desain dari Gala Print</span>
                </label>
              </div>

              {/* Catatan */}
              <div className="custom-order-field">
                <label className="custom-order-label">Catatan Tambahan (Opsional)</label>
                <textarea
                  className="custom-order-input"
                  rows={4}
                  placeholder="Contoh: Finishing glossy, tambahan lubang ring, dll..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="custom-order-info-box">
                <strong>ℹ️ Informasi:</strong>
                <p>
                  Setelah Anda submit, CS kami akan menghubungi untuk konfirmasi harga,
                  spesifikasi detail, dan estimasi pengerjaan. Pembayaran dilakukan
                  setelah Anda menyetujui harga yang ditawarkan.
                </p>
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
