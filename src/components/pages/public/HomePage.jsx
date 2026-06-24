/**
 * HomePage.jsx
 *
 * Hero banner, design showcase, featured products grouped by category,
 * promotional sections. All banner/hero/showcase content is driven by the
 * database (managed via Admin → Homepage Management).
 *
 * Requirements: 7.1, 13.4
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../../shared/ProductCard.jsx';
import { listProducts } from '../../../services/productService.js';
import { listCategories } from '../../../services/categoryService.js';
import {
  getHero,
  listDesignItems,
  getCatBannersMap,
} from '../../../services/homepageService.js';
import '../../../styles/css/pages/home.css';

const PER_SECTION = 8; // 4 cols × 2 rows

/** Group products by category order */
function buildGroups(products, categories) {
  const grouped = categories
    .map((cat) => ({
      category: cat,
      products: products.filter((p) => p.category === cat.name),
    }))
    .filter((g) => g.products.length > 0);

  const categorisedIds = new Set(grouped.flatMap((g) => g.products.map((p) => p.id)));
  const uncategorised = products.filter((p) => !categorisedIds.has(p.id));
  if (uncategorised.length) grouped.push({ category: null, products: uncategorised });

  return grouped;
}

/**
 * Category banner that uses the dynamic banner image from the database
 * (falls back to the solid-colour placeholder if no image is set).
 */
function CategoryBanner({ category, bannerData }) {
  const name = category ? category.name : 'Produk';
  const href = bannerData?.linkUrl
    ? bannerData.linkUrl
    : category
    ? `/products?cat=${encodeURIComponent(category.name)}`
    : '/products';
  const ctaText = bannerData?.ctaText || 'Lihat Semua →';
  const displayName = bannerData?.title || name;
  const bgImage = bannerData?.imageUrl ? `url(${bannerData.imageUrl})` : undefined;

  return (
    <Link className="home-section-banner" to={href} aria-label={`Lihat semua ${displayName}`}>
      <div
        className="home-section-banner-bg"
        style={
          bgImage
            ? {
                backgroundImage: bgImage,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      />
      <div className="home-section-banner-label">
        <span className="home-section-banner-name">{displayName}</span>
        <span className="home-section-banner-cta">{ctaText}</span>
      </div>
    </Link>
  );
}

/** A section of products with a category banner */
function ProductSection({ products, category, reverse, bannerData }) {
  const bannerEl = (
    <div className="home-section-banner-wrap" data-banner>
      <CategoryBanner category={category} bannerData={bannerData} />
    </div>
  );
  const gridEl = (
    <div className="home-section-grid" data-cols="4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );

  return (
    <section
      className={`home-product-section${reverse ? ' home-product-section--reverse' : ''}`}
      aria-label={category?.name ?? 'Produk'}
    >
      {reverse ? (
        <>
          {gridEl}
          {bannerEl}
        </>
      ) : (
        <>
          {bannerEl}
          {gridEl}
        </>
      )}
    </section>
  );
}

/** Hero / Landing Page Banner (database-driven) */
function HeroBanner({ hero }) {
  const title    = hero?.title    || 'LANDING PAGE';
  const subtitle = hero?.subtitle || '4+ PAGE';
  const bgImage  = hero?.imageUrl  ? `url(${hero.imageUrl})` : undefined;

  const inner = (
    <div className="home-hero-inner">
      <p className="home-hero-label">{title}</p>
      <p className="home-hero-sub">{subtitle}</p>
    </div>
  );

  return (
    <section
      className="home-hero"
      style={
        bgImage
          ? {
              backgroundImage: bgImage,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {hero?.ctaUrl ? (
        <Link to={hero.ctaUrl} className="home-hero-link" aria-label={title}>
          {inner}
        </Link>
      ) : (
        inner
      )}
    </section>
  );
}

/**
 * Design showcase grid — replaces the old category quick-links.
 * Shows max 4 items, each with image, optional title, and optional link.
 */
function DesignShowcase({ items }) {
  const visible = items.slice(0, 4);

  if (visible.length === 0) {
    // Render placeholder grid while loading or if no items configured
    return (
      <div className="home-cat-grid" data-cat-grid>
        <div className="home-cat-item home-cat-placeholder" />
        <div className="home-cat-item home-cat-placeholder" />
        <div className="home-cat-item home-cat-placeholder" />
        <div className="home-cat-item home-cat-placeholder" />
      </div>
    );
  }

  return (
    <div className="home-cat-grid" data-cat-grid>
      {visible.map((item) => {
        const inner = (
          <>
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.title || ''}
                className="home-cat-item-img"
              />
            )}
            {item.title && (
              <span className="home-cat-item-label">{item.title}</span>
            )}
          </>
        );

        return item.linkUrl ? (
          <Link
            key={item.id}
            className="home-cat-item home-cat-item--showcase"
            to={item.linkUrl}
          >
            {inner}
          </Link>
        ) : (
          <div key={item.id} className="home-cat-item home-cat-item--showcase">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function HomePage() {
  const [products, setProducts]       = useState([]);
  const [categories, setCategories]   = useState([]);
  const [hero, setHero]               = useState(null);
  const [designItems, setDesignItems] = useState([]);
  const [catBanners, setCatBanners]   = useState({});
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  // Drop zone state
  const [droppedFile, setDroppedFile] = useState(null);
  const [isDragOver, setIsDragOver]   = useState(false);
  const navigate     = useNavigate();
  const dropdownRef  = useRef(null);

  useEffect(() => {
    async function load() {
      // Products + categories
      try {
        const [prods, cats] = await Promise.all([listProducts(), listCategories()]);
        setProducts(prods);
        setCategories(Array.isArray(cats) ? cats : []);
      } catch (err) {
        console.error('Failed to load products/categories:', err);
      }

      // Homepage content (non-fatal — page still works without it)
      try {
        const [heroData, designData, bannersMap] = await Promise.all([
          getHero().catch(() => null),
          listDesignItems().catch(() => []),
          getCatBannersMap().catch(() => ({})),
        ]);
        setHero(heroData);
        setDesignItems(Array.isArray(designData) ? designData : []);
        setCatBanners(bannersMap || {});
      } catch (err) {
        console.error('Failed to load homepage content:', err);
      }
    }
    load();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setShowDropdown(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const groups = buildGroups(products, categories);

  function handleSearchChange(e) {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim()) {
      const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(q.toLowerCase()) ||
        (p.shortDescription || '').toLowerCase().includes(q.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 6));
      setShowDropdown(true);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      setShowDropdown(false);
      navigate(`/products?q=${encodeURIComponent(q)}`);
    }
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') handleSearchSubmit(e);
  }

  // ── Drop zone handlers ──────────────────────────────────────────────────────
  function processDropFile(file) {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setDroppedFile({ name: file.name, previewUrl: evt.target.result });
      };
      reader.readAsDataURL(file);
    } else {
      setDroppedFile({ name: file.name, previewUrl: null });
    }
  }

  function handleDropZoneFileChange(e) {
    const file = e.target.files?.[0];
    if (file) processDropFile(file);
  }

  function handleDropZoneDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDropZoneDragLeave() {
    setIsDragOver(false);
  }

  function handleDropZoneDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processDropFile(file);
  }

  function handleDropZoneClear(e) {
    e.preventDefault();
    setDroppedFile(null);
  }

  return (
    <main>
      {/* ── Hero Banner (database-driven, contained in layout) ── */}
      <div className="container">
        <HeroBanner hero={hero} />
      </div>

      <div className="container">
        {/* ── Design Showcase + Search ── */}
        <section className="home-categories" aria-label="Design showcase">
          <DesignShowcase items={designItems} />
          <div className="home-search-row">
            <span className="home-search-greeting">
              Hallo, <strong>Mau Pesan apa?</strong>
            </span>
            <div className="home-search-input-wrap" ref={dropdownRef}>
              <input
                className="home-search-input"
                type="search"
                placeholder="Cari semua produk disini..."
                aria-label="Cari produk"
                data-home-search
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
              />
              <button
                className="home-search-btn"
                type="button"
                aria-label="Cari"
                onClick={handleSearchSubmit}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                </svg>
              </button>

              {/* Search dropdown */}
              {showDropdown && (
                <div className="home-search-dropdown-wrapper">
                  <div className="home-search-dropdown">
                    {searchResults.length === 0 ? (
                      <div className="home-search-dropdown-empty">
                        Tidak ada produk yang cocok dengan &quot;<strong>{searchQuery}</strong>&quot;.
                      </div>
                    ) : (
                      <>
                        {searchResults.map((p) => (
                          <Link
                            key={p.id}
                            className="home-search-dropdown-item"
                            to={`/products/${encodeURIComponent(p.id)}`}
                            onClick={() => setShowDropdown(false)}
                          >
                            <img
                              src={p.image || '/assets/img/placeholder.svg'}
                              alt=""
                              onError={(e) => {
                                e.currentTarget.src = '/assets/img/placeholder.svg';
                              }}
                            />
                            <div className="home-search-dropdown-info">
                              <div className="home-search-dropdown-name">{p.name}</div>
                              <div className="home-search-dropdown-category">{p.category || ''}</div>
                            </div>
                          </Link>
                        ))}
                        {products.filter((p) =>
                          p.name.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length > 6 && (
                          <div className="home-search-dropdown-more">
                            +{products.filter((p) =>
                              p.name.toLowerCase().includes(searchQuery.toLowerCase())
                            ).length - 6} produk lainnya
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Custom Order ── */}
        <section className="home-custom-order card" aria-label="Custom Order">
          <div
            className={`home-custom-drop${isDragOver ? ' home-custom-drop--over' : ''}`}
            id="home-drop-zone"
            role="region"
            aria-label="Drop design area"
            onDragOver={handleDropZoneDragOver}
            onDragLeave={handleDropZoneDragLeave}
            onDrop={handleDropZoneDrop}
          >
            {droppedFile ? (
              <div className="home-custom-drop-preview">
                {droppedFile.previewUrl ? (
                  <img
                    src={droppedFile.previewUrl}
                    alt={droppedFile.name}
                    className="home-custom-drop-img"
                  />
                ) : (
                  <div className="home-custom-drop-file-icon">📄</div>
                )}
                <span className="home-custom-drop-filename">{droppedFile.name}</span>
                <button
                  className="home-custom-drop-clear"
                  type="button"
                  aria-label="Hapus file"
                  onClick={handleDropZoneClear}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <span className="home-custom-drop-label">Drop your design here</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.ai,.cdr"
                  className="home-custom-file-input"
                  id="home-file-input"
                  aria-label="Upload design file"
                  onChange={handleDropZoneFileChange}
                />
              </>
            )}
          </div>
          <div className="home-custom-info">
            <h2 className="home-custom-title">Custom Order</h2>
            <p className="home-custom-desc">
              Silahkan masukkan design kamu ke dalam kotak yang telah disediakan.
            </p>
            <p className="home-custom-desc">
              Kamu akan diminta untuk mengisi beberapa keterangan mengenai pesanan kamu.
            </p>
            <Link className="btn home-custom-btn" to="/cara-order">
              Buat Pesanan
            </Link>
          </div>
        </section>

        {/* ── Product Sections grouped by category ── */}
        <div id="home-product-sections" data-product-sections>
          {groups.length === 0 ? (
            <p className="muted" style={{ padding: '24px 0' }}>
              Belum ada produk.
            </p>
          ) : (
            groups.map((group, idx) => {
              const chunks = [];
              for (let i = 0; i < group.products.length; i += PER_SECTION) {
                chunks.push(group.products.slice(i, i + PER_SECTION));
              }
              // Look up the category banner for this group
              const bannerKey = group.category?.id ?? '__uncategorised__';
              const bannerData = catBanners[bannerKey] || null;

              return chunks.map((chunk, chunkIdx) => (
                <ProductSection
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
  );
}

export default HomePage;
