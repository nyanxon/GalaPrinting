/**
 * CartContext.jsx
 *
 * Provides cart state to the entire component tree.
 *
 * USE_BACKEND=false (default):
 *   Cart items are stored in localStorage via cartService.js.
 *   State is kept in sync with localStorage on every mutation.
 *
 * USE_BACKEND=true:
 *   - When user is logged in: cart operations call the Cart API via cartService.js.
 *   - When user is NOT logged in: falls back to localStorage cart.
 *   - After login, authService.js calls syncCartOnLogin() to merge the
 *     localStorage cart into the server cart.
 *
 * The context API is intentionally kept identical to the original so that
 * no consumer component (CartPage, CatalogProductPage, CheckoutPage, etc.)
 * needs to change.
 */

import { createContext, useState, useEffect, useContext } from 'react';
import { USE_BACKEND } from '../../core/httpClient.js';
import {
  getCart,
  addToCart,
  removeFromCart,
  updateCartItemQty,
  clearCart as clearCartService,
} from '../../services/cartService.js';
import { AuthContext } from './AuthContext.jsx';

export const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [cartLoadWarning, setCartLoadWarning] = useState('');

  // Access auth context to know when the user logs in/out.
  // AuthContext is a parent provider so this is safe.
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user ?? null;

  // ---------------------------------------------------------------------------
  // Design data cache — persisted in localStorage so it survives page refreshes.
  // Keyed by "productId|name" since server cart items don't store designDataUrl.
  // ---------------------------------------------------------------------------

  function getDesignCache() {
    try { return JSON.parse(localStorage.getItem('gala.designCache') || '{}'); } catch { return {}; }
  }
  function setDesignCache(cache) {
    try { localStorage.setItem('gala.designCache', JSON.stringify(cache)); } catch {}
  }
  function mergeDesignData(serverItems) {
    const cache = getDesignCache();
    return serverItems.map((item) => {
      // Server returns snake_case (product_id), frontend uses camelCase (productId)
      const pid = item.productId ?? item.product_id ?? '';
      const key = `${pid}|${item.name}`;
      const cached = cache[key];
      return cached
        ? { ...item, designDataUrl: cached.designDataUrl ?? null, designFileName: cached.designFileName ?? item.designFileName ?? item.design_file_path }
        : item;
    });
  }

  // ---------------------------------------------------------------------------
  // Load cart on mount and whenever the logged-in user changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadCart() {
      try {
        const result = await getCart(user?.id);
        const loaded = Array.isArray(result?.items) ? result.items : [];
        setItems(mergeDesignData(loaded));
      } catch (err) {
        console.error('[CartContext] Failed to load cart:', err);
        setItems([]);
        if (USE_BACKEND && user !== null) {
          setCartLoadWarning('Keranjang server tidak dapat dimuat. Menampilkan keranjang lokal.');
        }
      }
    }
    loadCart();
  }, [user?.id]);

  // ---------------------------------------------------------------------------
  // addItem — adds a fully-formed item object (as passed by CatalogProductPage)
  //
  // CartPage uses a remove+addItem pattern to update quantities. When addItem
  // receives an item whose id already exists in the current state, we treat it
  // as a quantity update rather than a new insertion to avoid duplicates in
  // backend mode.
  // ---------------------------------------------------------------------------

  async function addItem(item) {
    const itemId = item.id;
    const existsInState = items.some((i) => i.id === itemId);

    if (USE_BACKEND) {
      if (existsInState) {
        // Treat as a quantity update (CartPage remove+add pattern)
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...item } : i))
        );
        await updateCartItemQty(user?.id, itemId, item.quantity);
      } else {
        // New item — optimistic add then refresh from server
        const tempItem = { ...item, id: itemId || crypto.randomUUID() };
        setItems((prev) => [...prev, tempItem]);

        // Cache design data locally so it survives server cart refresh
        if (item.designDataUrl || item.designFileName) {
          const cache = getDesignCache();
          const pid = item.productId ?? item.product_id ?? '';
          cache[`${pid}|${item.name}`] = {
            designDataUrl: item.designDataUrl ?? null,
            designFileName: item.designFileName ?? null,
          };
          setDesignCache(cache);
        }

        const result = await addToCart(user?.id, item);
        if (result.ok) {
          // Refresh to get the server-assigned id, then merge design data back
          const { items: refreshed } = await getCart(user?.id);
          setItems(mergeDesignData(refreshed));
        } else {
          // Rollback on failure
          setItems((prev) => prev.filter((i) => i.id !== tempItem.id));
        }
      }
    } else {
      // localStorage path — optimistic update
      if (existsInState) {
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...item } : i))
        );
        await updateCartItemQty(user?.id, itemId, item.quantity);
      } else {
        const newItem = { ...item, id: itemId || crypto.randomUUID() };
        setItems((prev) => [...prev, newItem]);
        await addToCart(user?.id, newItem);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // removeItem
  // ---------------------------------------------------------------------------

  async function removeItem(itemId) {
    // Optimistic update
    const removedItem = items.find((i) => i.id === itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    // Clear design cache for this item
    if (removedItem) {
      const cache = getDesignCache();
      const pid = removedItem.productId ?? removedItem.product_id ?? '';
      delete cache[`${pid}|${removedItem.name}`];
      setDesignCache(cache);
    }
    await removeFromCart(user?.id, itemId);
  }

  // ---------------------------------------------------------------------------
  // updateItemQty — direct quantity update (not used by current components
  // but exported for future use)
  // ---------------------------------------------------------------------------

  async function updateItemQty(itemId, quantity) {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: Math.max(1, Number(quantity || 1)) } : i))
    );
    await updateCartItemQty(user?.id, itemId, quantity);
  }

  // ---------------------------------------------------------------------------
  // clearCart
  // ---------------------------------------------------------------------------

  async function clearCart() {
    setItems([]);
    setDesignCache({});
    await clearCartService(user?.id);
  }

  function clearCartLoadWarning() {
    setCartLoadWarning('');
  }

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateItemQty, clearCart, cartLoadWarning, clearCartLoadWarning }}>
      {children}
    </CartContext.Provider>
  );
}
