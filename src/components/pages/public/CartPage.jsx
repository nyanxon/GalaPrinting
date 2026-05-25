/**
 * CartPage.jsx
 *
 * Cart item list matching vanilla cart.html exactly:
 *   .cart-page > h1.page-title + .cart-grid > section[data-cart-items] + aside.card.summary
 *
 * Requirements: 7.4, 13.4
 */

import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { CartContext } from '../../context/CartContext.jsx';
import { formatCurrency } from '../../../core/helpers.js';
import placeholderImg from '../../../assets/placeholder.svg';
import '../../../styles/css/pages/cart.css';

function CartPage() {
  const { items, removeItem, addItem } = useContext(CartContext);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function handleQtyMinus(item) {
    if (item.quantity <= 1) {
      removeItem(item.id);
    } else {
      addItem({ ...item, quantity: item.quantity - 1 });
      removeItem(item.id);
      // Replace with updated quantity
      addItem({ ...item, quantity: item.quantity - 1 });
    }
  }

  function handleQtyPlus(item) {
    addItem({ ...item, id: item.id, quantity: item.quantity + 1 });
    removeItem(item.id);
    addItem({ ...item, quantity: item.quantity + 1 });
  }

  return (
    <main className="container cart-page">
      <h1 className="page-title">Daftar Belanja</h1>

      <div className="cart-grid">
        {/* Cart items */}
        <section className="stack" aria-label="Item keranjang" data-cart-items>
          {items.length === 0 ? (
            <div className="alert muted">
              Keranjang kamu masih kosong.{' '}
              <Link className="btn" to="/products" style={{ marginLeft: '10px' }}>
                Lihat Produk
              </Link>
            </div>
          ) : (
            items.map((item) => {
              const meta = [item.material, item.color, item.size].filter(Boolean).join(' • ');
              return (
                <div key={item.id} className="cart-item" data-item-id={item.id}>
                  <img
                    src={item.image || placeholderImg}
                    alt={item.name}
                    onError={(e) => { e.currentTarget.src = placeholderImg; }}
                  />
                  <div>
                    <div className="cart-item-title">{item.name}</div>
                    {meta && <div className="cart-item-meta">{meta}</div>}
                    {item.designFileName && (
                      <div className="cart-item-meta">Desain: {item.designFileName}</div>
                    )}
                    {item.notes && (
                      <div className="cart-item-meta">Catatan: {item.notes}</div>
                    )}
                    <div className="cart-item-actions">
                      <div className="nav-pill" style={{ gap: '12px' }}>
                        <button
                          className="btn ghost"
                          style={{ padding: '6px 10px' }}
                          type="button"
                          data-qty-minus
                          onClick={() => {
                            if (item.quantity <= 1) {
                              removeItem(item.id);
                            } else {
                              removeItem(item.id);
                              addItem({ ...item, quantity: item.quantity - 1 });
                            }
                          }}
                        >
                          -
                        </button>
                        <strong data-qty>{item.quantity}</strong>
                        <button
                          className="btn ghost"
                          style={{ padding: '6px 10px' }}
                          type="button"
                          data-qty-plus
                          onClick={() => {
                            removeItem(item.id);
                            addItem({ ...item, quantity: item.quantity + 1 });
                          }}
                        >
                          +
                        </button>
                      </div>
                      <strong>{formatCurrency(item.price * item.quantity)}</strong>
                      <button
                        className="btn"
                        type="button"
                        data-remove
                        onClick={() => removeItem(item.id)}
                        aria-label={`Hapus ${item.name} dari keranjang`}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Summary sidebar */}
        <aside className="card summary">
          <div className="card-body">
            <div className="card-title">Ringkasan</div>
            <div className="summary-row">
              <span className="muted">Subtotal</span>
              <strong data-cart-subtotal>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="form-actions" style={{ marginTop: '10px' }}>
              <Link
                className="btn primary"
                to="/checkout"
                data-checkout-link
                style={{ pointerEvents: items.length === 0 ? 'none' : 'auto', opacity: items.length === 0 ? 0.5 : 1 }}
              >
                Checkout
              </Link>
              <button
                className="btn"
                type="button"
                data-clear
                onClick={() => items.forEach((i) => removeItem(i.id))}
              >
                Hapus Keranjang
              </button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default CartPage;
