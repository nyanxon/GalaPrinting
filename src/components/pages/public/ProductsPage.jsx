/**
 * ProductsPage.jsx
 *
 * Product catalog with category sidebar and search.
 * Matches vanilla products.html structure exactly:
 *   .catalog-page > .catalog-layout > .catalog-sidebar + .catalog-grid-area
 *
 * Requirements: 7.2, 13.4, 16.4
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import ProductCard from '../../ui/ProductCard.jsx';
import { listProducts } from '../../../services/products.js';
import { listCategories } from '../../../services/categories.js';
import { debounce } from '../../../utils/dom.js';
import '../../../styles/css/pages/products.css';

function ProductsPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialise filters from URL params on first render
  useEffect(() => {
    const cat = searchParams.get('cat') || '';
    const q   = searchParams.get('q')   || '';
    setActiveCategory(cat);
    setSearchQuery(q);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function load() {
      try { setProducts(await listProducts()); }
      catch (err) { console.error('Failed to load products:', err); }
      try { setCategories(await listCategories()); }
      catch (err) { console.error('Failed to load categories:', err); }
    }
    load();
  }, []);

  const handleCategoryClick = useCallback((catName) => {
    const next = activeCategory === catName ? '' : catName;
    setActiveCategory(next);
    setSearchParams(next ? { cat: next } : {});
  }, [activeCategory, setSearchParams]);

  const handleSearchChange = useMemo(
    () => debounce((value) => setSearchQuery(value), 1),
    []
  );

  const handleSearchSubmit = useCallback((e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setSearchParams(q ? { q } : {});
  }, [searchQuery, setSearchParams]);

  const handleClearFilters = useCallback(() => {
    setActiveCategory('');
    setSearchQuery('');
    setSearchParams({});
  }, [setSearchParams]);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchCat = !activeCategory || p.category === activeCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.shortDescription || '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const hasFilters = activeCategory || searchQuery.trim();

  return (
    <main className="container catalog-page">
      <h1 className="catalog-title">{t('products.title')}</h1>

      <div className="catalog-layout">
        {/* Sidebar: Category Tree — matches vanilla .catalog-sidebar */}
        <aside className="catalog-sidebar" aria-label={t('products.filterLabel')}>
          <nav className="catalog-cat-tree" data-cat-tree aria-label={t('products.categoryLabel')}>
            {categories.map((cat) => {
              const isActive = cat.name === activeCategory;
              const subCats  = cat.subCategories || [];
              return (
                <div
                  key={cat.id}
                  className={`cat-item${isActive ? ' open' : ''}`}
                  data-cat={cat.name}
                >
                  <div
                    className={`cat-item-header${isActive ? ' active' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isActive}
                    data-cat-header
                    onClick={() => handleCategoryClick(cat.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCategoryClick(cat.name);
                      }
                    }}
                  >
                    <span>{cat.name}</span>
                    {subCats.length > 0 && (
                      <span className="cat-toggle-icon">▾</span>
                    )}
                  </div>
                  {subCats.length > 0 && (
                    <div className="cat-sub-list">
                      {subCats.map((sub) => (
                        <div
                          key={sub}
                          className="cat-sub-item"
                          data-sub={sub}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleCategoryClick(cat.name)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleCategoryClick(cat.name);
                            }
                          }}
                        >
                          {sub}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Product Grid Area — matches vanilla .catalog-grid-area */}
        <section className="catalog-grid-area" aria-label={t('products.productList')}>
          {/* Search bar + filter controls */}
          <form
            className="catalog-search-form"
            onSubmit={handleSearchSubmit}
            role="search"
            style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}
          >
            <input
              className="catalog-search-input"
              type="search"
              placeholder={t('products.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label={t('products.searchPlaceholder')}
              style={{ flex: 1, minWidth: '160px', padding: '9px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
            />
            <button className="btn" type="submit">{t('products.searchButton')}</button>
            {hasFilters && (
              <button
                className="btn btn--ghost"
                type="button"
                onClick={handleClearFilters}
              >
                {t('products.reset')}
              </button>
            )}
          </form>

          {/* Active category badge */}
          {activeCategory && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '14px', color: 'var(--muted)' }}
            >
              <span>{t('products.category')}: <strong style={{ color: 'var(--brand-brown)' }}>{activeCategory}</strong></span>
              <button
                className="btn btn--ghost"
                type="button"
                style={{ padding: '2px 8px', fontSize: '12px' }}
                onClick={() => handleCategoryClick(activeCategory)}
                aria-label={`${t('products.removeFilter')} ${activeCategory}`}
              >
                ✕
              </button>
            </div>
          )}

          {/* Product grid — matches vanilla .catalog-product-grid.grid.cols-4 */}
          <div className="catalog-product-grid grid cols-4" data-product-grid>
            {filteredProducts.length === 0 ? (
              <p
                className="muted"
                style={{ gridColumn: '1/-1', padding: '16px 0' }}
              >
                {searchQuery.trim()
                  ? `${t('products.noResultsFor')} "${searchQuery}".`
                  : t('products.noProducts')}
              </p>
            ) : (
              filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default ProductsPage;
