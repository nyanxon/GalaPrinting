import { Link } from 'react-router-dom';
import { formatCurrency } from '../../core/helpers.js';
import placeholderImg from '../../assets/placeholder.svg';

/**
 * ProductCard component
 *
 * Reusable card component used by ProductsPage and HomePage.
 *
 * Props:
 *   product {object} — product data with id, name, price, image, category
 *
 * Renders name, price, image, and a link to /products/:id.
 * Uses Link from react-router-dom for navigation.
 * Uses formatCurrency from src/core/helpers.js for price display.
 *
 * Requirements: 7.2, 14.2, 14.3
 */
function ProductCard({ product }) {
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
            onError={(e) => { e.currentTarget.src = placeholderImg; }}
            loading="lazy"
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
