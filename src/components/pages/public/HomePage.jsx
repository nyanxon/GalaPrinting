/**
 * HomePage.jsx
 *
 * Hero banner, design showcase, featured products grouped by category,
 * promotional sections. All banner/hero/showcase content is driven by the
 * database (managed via Admin → Homepage Management).
 *
 * Requirements: 7.1, 13.4
 */

import { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext.jsx';
import { showToast } from '../../../core/toastEmitter.js';
import ProductCard from '../../ui/ProductCard.jsx';
import DropZone from '../../ui/DropZone.jsx';
import { listProducts } from '../../../services/products.js';
import { listCategories } from '../../../services/categories.js';
import {
  listHeroBanners,
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
 * Includes fade-in transition to avoid flash when image loads.
 */
function CategoryBanner({ category, bannerData }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const name = category ? category.name : 'Produk';
  const href = bannerData?.linkUrl
    ? bannerData.linkUrl
    : category
    ? `/products?cat=${encodeURIComponent(category.name)}`
    : '/products';
  const ctaText = bannerData?.ctaText || 'Lihat Semua →';
  const displayName = bannerData?.title || name;
  const bgImage = bannerData?.imageUrl;

  // Preload image to trigger onLoad callback
  useEffect(() => {
    if (!bgImage) {
      setImageLoaded(true); // No image — consider "loaded" so label is visible
      return;
    }
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(true); // Even on error, show content
    img.src = bgImage;
  }, [bgImage]);

  return (
    <Link className="home-section-banner" to={href} aria-label={`Lihat semua ${displayName}`}>
      <div
        className={`home-section-banner-bg${imageLoaded ? ' loaded' : ''}`}
        style={
          bgImage
            ? {
                backgroundImage: `url(${bgImage})`,
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
function ProductSection({ products, category, reverse, bannerData, eager = false }) {
  const bannerEl = (
    <div className="home-section-banner-wrap" data-banner>
      <CategoryBanner category={category} bannerData={bannerData} />
    </div>
  );
  const gridEl = (
    <div className="home-section-grid" data-cols="4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} eager={eager} />
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

/**
 * Hero Carousel — auto-plays through up to 8 database-managed banner slides.
 * Features: auto-advance every 5 s, pause on hover, prev/next buttons, dot nav.
 * Falls back to a solid-colour placeholder when no slides are configured.
 * Images are preloaded eagerly — slides only become visible once their image
 * is ready, preventing the "flash of empty box" on initial render.
 */
function HeroCarousel({ slides }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  // Track which slide images have finished loading
  const [loadedMap, setLoadedMap] = useState({});
  const timerRef = useRef(null);

  const total = slides.length;

  // Preload all slide images as soon as the slides array is available
  useEffect(() => {
    slides.forEach((s) => {
      if (!s.imageUrl) {
        setLoadedMap((prev) => ({ ...prev, [s.id]: true }));
        return;
      }
      const img = new Image();
      img.onload  = () => setLoadedMap((prev) => ({ ...prev, [s.id]: true }));
      img.onerror = () => setLoadedMap((prev) => ({ ...prev, [s.id]: true }));
      img.src = s.imageUrl;
    });
  }, [slides]);

  const goTo = useCallback((idx) => {
    setCurrent((idx + total) % total);
  }, [total]);

  // Auto-advance
  useEffect(() => {
    if (total <= 1 || paused) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % total);
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, [total, paused]);

  // Reset to first slide when slides change
  useEffect(() => { setCurrent(0); }, [total]);

  // No slides configured — render placeholder
  if (total === 0) {
    return (
      <section className="home-hero" aria-label="Hero banner">
        <div className="home-hero-inner">
          <p className="home-hero-label">{t('home.heroLabel')}</p>
          <p className="home-hero-sub">{t('home.heroSub')}</p>
        </div>
      </section>
    );
  }

  const slide = slides[current];
  const bgImage = slide.imageUrl ? `url(${slide.imageUrl})` : undefined;

  const slideContent = (
    <div className="home-hero-inner">
      {slide.title    && <p className="home-hero-label">{slide.title}</p>}
      {slide.subtitle && <p className="home-hero-sub">{slide.subtitle}</p>}
    </div>
  );

  return (
    <section
      className="home-hero home-hero--carousel"
      aria-label="Hero banner"
      aria-roledescription="carousel"
      data-has-image={bgImage ? 'true' : 'false'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide backgrounds — stack all, only active one visible */}
      <div className="home-hero-slides" aria-live="off">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`home-hero-slide${i === current ? ' home-hero-slide--active' : ''}${loadedMap[s.id] ? ' home-hero-slide--ready' : ''}`}
            style={
              s.imageUrl
                ? { backgroundImage: `url(${s.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : undefined
            }
            aria-hidden={i !== current}
          />
        ))}
      </div>

      {/* Content */}
      <div className="home-hero-content">
        {slide.ctaUrl ? (
          <Link to={slide.ctaUrl} className="home-hero-link" aria-label={slide.title || 'Lihat lebih lanjut'}>
            {slideContent}
          </Link>
        ) : (
          slideContent
        )}
      </div>

      {/* Prev / Next arrows — only show when > 1 slide */}
      {total > 1 && (
        <>
          <button
            className="home-hero-arrow home-hero-arrow--prev"
            type="button"
            aria-label={t('orderStatus.prevSlide')}
            onClick={() => goTo(current - 1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            className="home-hero-arrow home-hero-arrow--next"
            type="button"
            aria-label={t('orderStatus.nextSlide')}
            onClick={() => goTo(current + 1)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="home-hero-dots" role="tablist" aria-label={t('orderStatus.selectSlide')}>
          {slides.map((s, i) => (
            <button
              key={s.id}
              className={`home-hero-dot${i === current ? ' home-hero-dot--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Design showcase grid — replaces the old category quick-links.
 * Shows max 4 items, each with image, optional title, and optional link.
 * Images fade in on load to avoid flash of empty box.
 */
function DesignShowcaseItem({ item }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const inner = (
    <>
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={item.title || ''}
          width="280"
          height="210"
          loading="lazy"
          className={`home-cat-item-img${imageLoaded ? ' loaded' : ''}`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
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
}

function DesignShowcase({ items }) {
  const visible = items.slice(0, 4);

  if (visible.length === 0) {
    // Render shimmer placeholder grid while loading or if no items configured
    return (
      <div className="home-cat-grid" data-cat-grid>
        <div className="home-cat-item home-cat-placeholder home-cat-shimmer" />
        <div className="home-cat-item home-cat-placeholder home-cat-shimmer" />
        <div className="home-cat-item home-cat-placeholder home-cat-shimmer" />
        <div className="home-cat-item home-cat-placeholder home-cat-shimmer" />
      </div>
    );
  }

  return (
    <div className="home-cat-grid" data-cat-grid>
      {visible.map((item) => (
        <DesignShowcaseItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [products, setProducts]           = useState([]);
  const [categories, setCategories]       = useState([]);
  const [heroBanners, setHeroBanners]     = useState([]);
  const [designItems, setDesignItems]     = useState([]);
  const [catBanners, setCatBanners]       = useState({});
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [droppedFile, setDroppedFile]     = useState(null);
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
        const [bannersData, designData, catBannersMap] = await Promise.all([
          listHeroBanners().catch(() => []),
          listDesignItems().catch(() => []),
          getCatBannersMap().catch(() => ({})),
        ]);
        setHeroBanners(Array.isArray(bannersData) ? bannersData : []);
        setDesignItems(Array.isArray(designData) ? designData : []);
        setCatBanners(catBannersMap || {});
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

  const groups = useMemo(() => buildGroups(products, categories), [products, categories]);

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

  // ── Drop zone: handle dropped/selected design file ──────────────────────────
  function handleDesignFile(files) {
    const file = files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (evt) => setDroppedFile({ name: file.name, previewUrl: evt.target.result, __fileObject: file });
      reader.readAsDataURL(file);
    } else {
      setDroppedFile({ name: file.name, previewUrl: null, __fileObject: file });
    }
  }

  return (
    <main>
      {/* ── Hero Carousel (database-driven, contained in layout) ── */}
      <div className="container">
        <HeroCarousel slides={heroBanners} />
      </div>

      <div className="container">
        {/* ── Design Showcase + Search ── */}
        <section className="home-categories" aria-label="Design showcase">
          <DesignShowcase items={designItems} />
          <div className="home-search-row">
            <span className="home-search-greeting">
              {t('home.greeting')}, <strong>{t('home.whatToPrint')}</strong>
            </span>
            <div className="home-search-input-wrap" ref={dropdownRef}>
              <input
                className="home-search-input"
                type="search"
                placeholder={t('home.searchPlaceholder')}
                aria-label={t('home.searchPlaceholder')}
                data-home-search
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
              />
              <button
                className="home-search-btn"
                type="button"
                aria-label={t('home.searchButton')}
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
                        {t('home.noResults')} &quot;<strong>{searchQuery}</strong>&quot;.
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
                              width="48"
                              height="48"
                              loading="lazy"
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
          <div className="home-custom-drop" id="home-drop-zone">
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
                  aria-label={t('home.removeFile')}
                  onClick={() => setDroppedFile(null)}
                >
                  ✕
                </button>
              </div>
            ) : (
              <DropZone
                accept=".jpg,.jpeg,.png,.pdf,.zip,.ai,.cdr,image/jpeg,image/png,application/pdf,application/zip"
                onFiles={handleDesignFile}
                label={t('home.dropDesignHere')}
                hint={t('home.fileHint')}
              />
            )}
          </div>
          <div className="home-custom-info">
            <h2 className="home-custom-title">{t('home.customOrder')}</h2>
            <p className="home-custom-desc">
              {t('home.customOrderDesc')}
            </p>
            <p className="home-custom-desc">
              {t('home.customOrderDesc2')}
            </p>
            <button
              className="btn home-custom-btn"
              type="button"
              onClick={() => {
                if (!user) {
                  showToast('Silakan login terlebih dahulu untuk membuat custom order.', 'info', 5000);
                  setTimeout(() => {
                    navigate('/register');
                  }, 2500);
                } else {
                  navigate('/custom-order', { state: { designFile: droppedFile?.__fileObject } });
                }
              }}
            >
              {t('home.createOrder')}
            </button>
          </div>
        </section>

        {/* ── Product Sections grouped by category ── */}
        <div id="home-product-sections" data-product-sections>
          {groups.length === 0 ? (
            <p className="muted" style={{ padding: '24px 0' }}>
              {t('home.noProducts')}
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
                  eager={idx === 0 && chunkIdx === 0}
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
