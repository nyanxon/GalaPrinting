import { useState } from 'react';
import { Link } from 'react-router';
import { formatCurrency } from '../../utils/format.js';
import placeholderImg from '../../assets/placeholder.svg';

/**
 * ProductCard component
 *
 * Reusable card component used by ProductsPage and HomePage.
 *
 * Props:
 *   product {object} — product data with id, name, price, image, category
 *   eager   {boolean} — when true, disables lazy loading (use for above-the-fold cards)
 *
 * Renders name, price, image, and a link to /products/:id.
 * Uses Link from react-router for navigation.
 * Uses formatCurrency from src/utils/format.js for price display.
 * Image fades in on load to avoid flash of empty placeholder box.
 *
 * Requirements: 7.2, 14.2, 14.3
 */
function ProductCard({ product, eager = false }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const name = product?.name || '';
  const price = formatCurrency(product?.price || 0);
  const imageSrc = product?.image || placeholderImg;
  const productId = product?.id || '';

  return (
    <article className="product-card">
      <Link
        className="product-card-link"
        to={`/products/${productId}`}
        aria-label={name}
      >
        <div className="product-card-media">
          <img
            src={imageSrc}
            alt={name}
            width="300"
            height="300"
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              e.currentTarget.src = placeholderImg;
              setImageLoaded(true);
            }}
            loading={eager ? 'eager' : 'lazy'}
            className={imageLoaded ? 'img-loaded' : ''}
          />
        </div>
        <div className="product-card-body">
          <p className="product-card-name">{name}</p>
          {product?.category && (
            <p className="product-card-category">{product.category}</p>
          )}
          <p className="product-card-price">{price}</p>
        </div>
      </Link>
    </article>
  );
}

export default ProductCard;
