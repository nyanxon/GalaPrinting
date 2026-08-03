/**
 * CatalogProductPage.jsx
 *
 * Product detail view matching vanilla catalogProduct.html exactly:
 *   .product-detail > .detail-grid > .gallery + .product-info-stack
 *   .detail-tabs > .tab-row + .tab-panel
 *
 * Requirements: 7.3, 13.4
 */

import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { CartContext } from '../../context/CartContext.jsx';
import { AuthContext } from '../../context/AuthContext.jsx';
import { getProductById, resolveVariantPrice } from '../../../services/products.js';
import { listReviews } from '../../../services/reviews.js';
import DropZone from '../../ui/DropZone.jsx';
import placeholderImg from '../../../assets/placeholder.svg';
import { showToast } from '../../../core/toastEmitter.js';
import '../../../styles/css/pages/catalogProduct.css';

/**
 * Parse a field that may be a JSON string array or already an array.
 * Backend stores colors/sizes/materials as JSON strings in MySQL.
 */
function parseArrayField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function CatalogProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useContext(CartContext);
  const { user } = useContext(AuthContext);

  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Gallery
  const [activeIndex, setActiveIndex] = useState(0);
  // Thumbnail window: always show exactly 3 (or fewer if < 3 images)
  const THUMB_VISIBLE = 3;
  const [thumbStart, setThumbStart] = useState(0);
  // Zoom state
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const galleryMainRef = useRef(null);
  // Fullscreen lightbox (mobile)
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Selectors
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  // Design file
  const [designFile, setDesignFile] = useState(null);
  const [designDataUrl, setDesignDataUrl] = useState(null);
  const [designReadReady, setDesignReadReady] = useState(true);

  // Active tab
  const [activeTab, setActiveTab] = useState('rincian');

  // Reviews
  const [reviews, setReviews] = useState([]);

  // Rating summary
  const totalReviews = reviews.length;

  const averageRating =
    totalReviews > 0
      ? reviews.reduce(
          (sum, r) => sum + (Number(r.rating) || 0),
          0
        ) / totalReviews
      : 0;

  const roundedRating = Math.round(averageRating);

  useEffect(() => {
    async function load() {
      try {
        const raw = await getProductById(id);
        if (!raw) { setNotFound(true); return; }

        // Normalize backend snake_case fields and parse JSON array fields
        const prod = {
          ...raw,
          shortDescription: raw.shortDescription || raw.short_description || '',
          requiresDesign:   raw.requiresDesign   ?? raw.requires_design   ?? false,
          image:            raw.image            || raw.image_path        || null,
          colors:    parseArrayField(raw.colors),
          sizes:     parseArrayField(raw.sizes),
          materials: parseArrayField(raw.materials),
          variantPrices: (() => {
            const vp = raw.variantPrices ?? raw.variant_prices ?? null;
            if (typeof vp === 'string' && vp.trim()) {
              try { return JSON.parse(vp); } catch { return null; }
            }
            return vp;
          })(),
        };

        setProduct(prod);
        setThumbStart(0);
        setActiveIndex(0);
        setSelectedColor(prod.colors[0] || null);
        setSelectedSize(prod.sizes[0] || null);
        setSelectedMaterial(prod.materials[0] || '');

        // Load reviews for this product
        try {
          const reviewData = await listReviews(id);
          setReviews(Array.isArray(reviewData) ? reviewData : []);
        } catch {
          setReviews([]);
        }
      } catch (err) {
        console.error('Failed to load product:', err);
        setNotFound(true);
      }
    }
    load();
  }, [id]);

  function handleFileChange(files) {
    const f = files?.[0] ?? null;
    if (!f) { setDesignFile(null); setDesignDataUrl(null); setDesignReadReady(true); return; }
    setDesignFile(f);
    setDesignReadReady(false);
    const reader = new FileReader();
    reader.onload = (ev) => { setDesignDataUrl(ev.target.result); setDesignReadReady(true); };
    reader.onerror = () => { setDesignDataUrl(null); setDesignReadReady(true); };
    reader.readAsDataURL(f);
  }

  function handleAddToCart() {
    if (!user) {
      showToast('Silakan login terlebih dahulu untuk menambahkan produk ke keranjang.', 'error');
      setTimeout(() => navigate('/register'), 1500);
      return;
    }

    if (product.requiresDesign !== false && !designFile) {
      showToast('Silakan upload desain terlebih dahulu.', 'error');
      return;
    }
    if (designFile) {
      if (!['image/jpeg', 'image/png', 'application/pdf', 'application/zip', 'application/x-zip-compressed'].includes(designFile.type)) {
        showToast('Format file harus JPG, PNG, PDF, atau ZIP.', 'error');
        return;
      }
      if (designFile.size > 100 * 1024 * 1024) { // 100 MB (updated from 10 MB)
        showToast('Ukuran file maksimal 100MB.', 'error');
        return;
      }
      if (!designReadReady) {
        showToast('File sedang diproses, coba lagi sebentar.', 'error');
        return;
      }
    }
    if ((product.colors || []).length > 0 && !selectedColor) {
      showToast('Silakan pilih warna.', 'error');
      return;
    }
    if ((product.sizes || []).length > 0 && !selectedSize) {
      showToast('Silakan pilih ukuran.', 'error');
      return;
    }

    addItem({
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      price: displayPrice,
      image: product.image,
      quantity: Math.max(1, quantity),
      color: selectedColor,
      size: selectedSize,
      material: selectedMaterial,
      notes,
      designFileName: designFile ? designFile.name : null,
      designDataUrl: designFile ? designDataUrl : null,
    });
    showToast('Produk ditambahkan ke keranjang.', 'success');
  }

  // ── Gallery helpers ────────────────────────────────────────────────────────

  const images = product?.images?.length > 0 ? product.images : (product?.image ? [product.image] : [placeholderImg]);
  const totalImages = images.length;

  const goNext = useCallback(() => {
    setActiveIndex((i) => {
      const next = (i + 1) % totalImages;
      // Shift thumb window so the active thumb stays visible
      setThumbStart((s) => {
        if (next >= s + THUMB_VISIBLE) return Math.min(next - THUMB_VISIBLE + 1, totalImages - THUMB_VISIBLE);
        if (next < s) return next;
        return s;
      });
      return next;
    });
  }, [totalImages]);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => {
      const prev = (i - 1 + totalImages) % totalImages;
      setThumbStart((s) => {
        if (prev < s) return Math.max(prev, 0);
        if (prev >= s + THUMB_VISIBLE) return Math.min(prev - THUMB_VISIBLE + 1, totalImages - THUMB_VISIBLE);
        return s;
      });
      return prev;
    });
  }, [totalImages]);

  // Arrow buttons for the thumbnail strip itself
  const thumbCanPrev = thumbStart > 0;
  const thumbCanNext = thumbStart + THUMB_VISIBLE < totalImages;

  const thumbNext = () => {
    setThumbStart((s) => Math.min(s + 1, totalImages - THUMB_VISIBLE));
  };
  const thumbPrev = () => {
    setThumbStart((s) => Math.max(s - 1, 0));
  };

  // ── Zoom handlers ──────────────────────────────────────────────────────────

  function handleMouseMove(e) {
    const rect = galleryMainRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }

  function handleMouseEnter() { setZoomActive(true); }
  function handleMouseLeave() { setZoomActive(false); }

  if (notFound) {
    return (
      <main className="container product-detail">
        <p className="muted" style={{ padding: '48px 0', textAlign: 'center' }}>
          Produk tidak ditemukan.{' '}
          <a href="/products">Kembali ke produk</a>
        </p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="container product-detail">
        <p className="muted" style={{ padding: '48px 0', textAlign: 'center' }}>Memuat produk...</p>
      </main>
    );
  }

  const hasColors    = (product.colors    || []).length > 0;
  const hasSizes     = (product.sizes     || []).length > 0;
  const hasMaterials = (product.materials || []).length > 0;

  const displayPrice = resolveVariantPrice(product, selectedColor, selectedSize, selectedMaterial);

  return (
    <main className="container product-detail">
      <div className="detail-grid">

        {/* ── Gallery ── */}
        <section className="gallery" aria-label="Galeri produk">
          {/* Main image with zoom */}
          <div
            className={`gallery-main${zoomActive ? ' gallery-main--zoom' : ''}`}
            ref={galleryMainRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onClick={() => setLightboxOpen(true)}
            style={{ cursor: zoomActive ? 'crosshair' : 'zoom-in' }}
            role="button"
            tabIndex={0}
            aria-label="Lihat gambar lebih besar"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLightboxOpen(true); }}
          >
            <img
              src={images[activeIndex] || placeholderImg}
              alt={`${product.name} — foto ${activeIndex + 1}`}
              onError={(e) => { e.currentTarget.src = placeholderImg; }}
              style={zoomActive ? {
                transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                transform: 'scale(2)',
                transition: 'transform 0.1s ease',
              } : {
                transform: 'scale(1)',
                transition: 'transform 0.2s ease',
              }}
            />
          </div>

          {/* Thumbnails row — only show when there are images */}
          {totalImages > 0 && (
            <div className="gallery-thumbs-row">
              <button
                className="gallery-nav-btn"
                type="button"
                aria-label="Sebelumnya"
                onClick={thumbPrev}
                disabled={!thumbCanPrev}
              >
                &#8249;
              </button>
              <div className="gallery-thumbs">
                {images.slice(thumbStart, thumbStart + THUMB_VISIBLE).map((src, idx) => {
                  const realIdx = thumbStart + idx;
                  return (
                    <button
                      key={realIdx}
                      type="button"
                      className={`gallery-thumb${activeIndex === realIdx ? ' active' : ''}`}
                      aria-label={`Lihat foto ${realIdx + 1}`}
                      aria-pressed={activeIndex === realIdx}
                      onClick={() => setActiveIndex(realIdx)}
                    >
                      <img
                        src={src}
                        alt={`${product.name} — thumbnail ${realIdx + 1}`}
                        width="72"
                        height="72"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = placeholderImg; }}
                      />
                    </button>
                  );
                })}
              </div>
              <button
                className="gallery-nav-btn"
                type="button"
                aria-label="Berikutnya"
                onClick={thumbNext}
                disabled={!thumbCanNext}
              >
                &#8250;
              </button>
            </div>
          )}
        </section>

        {/* ── Fullscreen Lightbox (mobile tap / desktop click) ── */}
        {lightboxOpen && (
          <div
            className="gallery-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Tampilan penuh gambar produk"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              className="gallery-lightbox-close"
              type="button"
              aria-label="Tutup"
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            >
              ✕
            </button>
            <button
              className="gallery-lightbox-nav gallery-lightbox-nav--prev"
              type="button"
              aria-label="Sebelumnya"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
            >
              &#8249;
            </button>
            <img
              src={images[activeIndex] || placeholderImg}
              alt={`${product.name} — foto ${activeIndex + 1}`}
              className="gallery-lightbox-img"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => { e.currentTarget.src = placeholderImg; }}
            />
            <button
              className="gallery-lightbox-nav gallery-lightbox-nav--next"
              type="button"
              aria-label="Berikutnya"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
            >
              &#8250;
            </button>
            {totalImages > 1 && (
              <div className="gallery-lightbox-dots" onClick={(e) => e.stopPropagation()}>
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`gallery-lightbox-dot${activeIndex === idx ? ' active' : ''}`}
                    aria-label={`Foto ${idx + 1}`}
                    onClick={() => setActiveIndex(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Product Info & Options ── */}
        <section className="stack product-info-stack">
          <div>
            <h1 className="product-info-name" data-product-name>{product.name}</h1>
            <p className="product-info-short muted" data-product-short>
              {product.shortDescription || ''}
            </p>
          </div>
          <p className="product-info-price">
            Rp {displayPrice.toLocaleString('id-ID')}
            {displayPrice !== (product.price ?? 0) && (
              <span style={{ fontSize: '13px', color: '#6b7280', marginLeft: '8px', fontWeight: 400 }}>
                {/* (harga dasar: Rp {(product.price ?? 0).toLocaleString('id-ID')}) */}
              </span>
            )}
          </p>

          {/* Star Rating */}
          <div className="product-rating" aria-label="Rating produk">
            <span
              className="product-stars"
              aria-hidden="true"
              style={{ color: '#f59e0b' }}
            >
              {'★'.repeat(roundedRating)}
              {'☆'.repeat(5 - roundedRating)}
            </span>

            <span className="product-rating-count muted" data-rating-count>
              ({averageRating.toFixed(1)} • {totalReviews} Ulasan)
            </span>
          </div>

          {/* Pilih Produk dan Bahan */}
          {hasMaterials && (
            <div className="option-group">
              <div className="option-label">Pilih Produk dan Bahan</div>
              <select
                className="select"
                data-material
                aria-label="Pilih produk dan bahan"
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
              >
                {product.materials.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Warna */}
          {hasColors && (
            <div className="option-group">
              <div className="option-label">Warna</div>
              <div className="chip-row" data-colors>
                {product.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="chip"
                    aria-pressed={selectedColor === color ? 'true' : 'false'}
                    data-value={encodeURIComponent(color)}
                    onClick={() => setSelectedColor(color)}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ukuran Print */}
          {hasSizes && (
            <div className="option-group">
              <div className="option-label">Ukuran Print</div>
              <div className="chip-row" data-sizes>
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className="chip"
                    aria-pressed={selectedSize === size ? 'true' : 'false'}
                    data-value={encodeURIComponent(size)}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keterangan */}
          <div className="option-group">
            <div className="option-label">Keterangan</div>
            <textarea
              className="textarea"
              placeholder="Tulis catatan untuk pesanan..."
              data-notes
              aria-label="Keterangan pesanan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Upload File */}
          <div className="option-group">
            <div className="option-label">
              Upload File{' '}
              <span className="muted" style={{ fontWeight: 400, fontSize: '14px' }}>
                (JPG, JPEG, PNG)
              </span>
            </div>

            {!designDataUrl ? (
              <DropZone
                accept=".jpg,.jpeg,.png,.pdf,.zip,image/jpeg,image/png,application/pdf,application/zip"
                onFiles={handleFileChange}
                label="Upload desain kamu"
                hint="JPG, PNG, PDF, ZIP · Maks. 100 MB"
              />
            ) : (
              <div className="design-preview-box">
                <img
                  src={designDataUrl}
                  alt="Preview desain"
                  className="design-preview-img"
                />
                <div className="design-preview-meta">
                  <span className="design-preview-name">📎 {designFile?.name}</span>
                  <button
                    type="button"
                    className="design-preview-remove"
                    aria-label="Hapus file desain"
                    onClick={() => {
                      setDesignFile(null);
                      setDesignDataUrl(null);
                    }}
                  >
                    ✕ Hapus
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Jumlah + Add to Cart */}
          <div className="option-group">
            <div className="option-label">
              Jumlah :{' '}
              <span className="muted" style={{ fontWeight: 400, fontSize: '14px' }}>
                (Min Order : 1 Pcs)
              </span>
            </div>
            <div className="qty-add-row">
              <div className="qty" role="group" aria-label="Jumlah produk">
                <button
                  type="button"
                  data-qty-minus
                  aria-label="Kurangi jumlah"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={quantity}
                  data-qty
                  aria-label="Jumlah"
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                />
                <button
                  type="button"
                  data-qty-plus
                  aria-label="Tambah jumlah"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </button>
              </div>
              <button
                className="btn-add-to-cart"
                type="button"
                data-add-to-cart
                onClick={handleAddToCart}
              >
                Tambah ke Keranjang
              </button>
            </div>
          </div>

        </section>
      </div>

      {/* ── Tabs ── */}
      <section className="detail-tabs">
        <div className="tab-row" role="tablist" aria-label="Tab detail produk">
          <button
            type="button"
            className={activeTab === 'rincian' ? 'active' : ''}
            role="tab"
            aria-selected={activeTab === 'rincian'}
            data-tab="rincian"
            onClick={() => setActiveTab('rincian')}
          >
            Rincian Produk
          </button>
          <button
            type="button"
            className={activeTab === 'spesifikasi' ? 'active' : ''}
            role="tab"
            aria-selected={activeTab === 'spesifikasi'}
            data-tab="spesifikasi"
            onClick={() => setActiveTab('spesifikasi')}
          >
            Spesifikasi
          </button>
          <button
            type="button"
            className={activeTab === 'ulasan' ? 'active' : ''}
            role="tab"
            aria-selected={activeTab === 'ulasan'}
            data-tab="ulasan"
            onClick={() => setActiveTab('ulasan')}
          >
            Ulasan ({reviews.length})
          </button>
        </div>
        <div className="tab-panel" data-tab-panel>
          {activeTab === 'rincian' && (
            <>
              <div className="section-title" data-panel-title>{product.name}</div>
              <p className="muted product-panel-body" data-panel-body>
                {product.shortDescription || 'Silakan pilih opsi, tambahkan catatan, lalu unggah desain.'}
              </p>
            </>
          )}
          {activeTab === 'spesifikasi' && (
            <>
              <div className="section-title">Spesifikasi</div>
              <p className="muted">
                {hasMaterials && `Bahan: ${product.materials.join(', ')}. `}
                {hasSizes && `Ukuran: ${product.sizes.slice(0, 6).join(', ')}.`}
              </p>
            </>
          )}
          {activeTab === 'ulasan' && (
            <>
              <div className="section-title">Ulasan ({reviews.length})</div>
              {reviews.length === 0 ? (
                <p className="muted">Belum ada ulasan untuk produk ini.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                  {reviews.map((r) => (
                    <div key={r.id} style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.customer_name ?? r.customerName ?? 'Anonim'}</span>
                        <span style={{ color: '#f59e0b', fontSize: '14px' }}>
                          {'⭐'.repeat(Math.min(5, Math.max(1, Number(r.rating) || 5)))}
                        </span>
                        <span style={{ color: '#9ca3af', fontSize: '12px', marginLeft: 'auto' }}>
                          {new Date(r.created_at ?? r.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default CatalogProductPage;
