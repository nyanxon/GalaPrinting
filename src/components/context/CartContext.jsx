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
    try {
      localStorage.setItem('gala.designCache', JSON.stringify(cache));
    } catch (_err) {
      // localStorage may be unavailable (private browsing quota, etc.) — silently ignore
    }
  }
  function mergeDesignData(serverItems) {
    const cache = getDesignCache();
    return serverItems.map((item) => {
      // Use item id as the primary cache key (unique per cart slot).
      // Fall back to "productId|name" for backwards-compat with old cache entries.
      const itemId = item.id ?? '';
      const pid = item.productId ?? item.product_id ?? '';
      const legacyKey = `${pid}|${item.name}`;
      const cached = cache[itemId] || cache[legacyKey];
      if (cached) {
        // Update cache to use server ID going forward (removes stale temp IDs)
        if (!cache[itemId] && cache[legacyKey]) {
          cache[itemId] = cache[legacyKey];
          setDesignCache(cache);
        }
        return {
          ...item,
          designDataUrl: cached.designDataUrl ?? null,
          designFileName: cached.designFileName ?? item.designFileName ?? item.design_file_path,
        };
      }
      return item;
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
  // mergeDesignData is defined inside the component and recreated on every render,
  // but we intentionally only reload the cart when the logged-in user changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const tempId = itemId || crypto.randomUUID();
        const tempItem = { ...item, id: tempId };
        setItems((prev) => [...prev, tempItem]);

        // Cache design data locally keyed by a stable fingerprint:
        // productId + name + timestamp. This fingerprint is stored on the
        // tempItem so we can match it against server items after refresh.
        const fingerprint = `${item.productId ?? ''}|${item.name ?? ''}|${Date.now()}`;
        const tempItemWithFP = { ...tempItem, _designFP: fingerprint };
        setItems((prev) => prev.map((i) => i.id === tempId ? tempItemWithFP : i));

        if (item.designDataUrl || item.designFileName) {
          const cache = getDesignCache();
          // Store under both the tempId AND the fingerprint for robust matching
          cache[tempId] = {
            designDataUrl: item.designDataUrl ?? null,
            designFileName: item.designFileName ?? null,
            fingerprint,
          };
          cache[fingerprint] = {
            designDataUrl: item.designDataUrl ?? null,
            designFileName: item.designFileName ?? null,
          };
          setDesignCache(cache);
        }

        const result = await addToCart(user?.id, item);
        if (result.ok) {
          // Refresh to get the server-assigned id, then merge design data back.
          // mergeDesignData will match by item.id first, then legacyKey.
          // We also try to match by fingerprint for the newly added item.
          const { items: refreshed } = await getCart(user?.id);
          const merged = mergeDesignData(refreshed);

          // Extra pass: find the server item that corresponds to the temp item
          // (same productId + name, not yet in previous state) and apply its
          // fingerprint cache entry so it picks up the design file.
          const cache = getDesignCache();
          const finalItems = merged.map((serverItem) => {
            if (serverItem.designDataUrl) return serverItem; // already resolved
            // Try fingerprint — the server item for the newly-added product
            // will have the same productId + name
            const pid = serverItem.productId ?? serverItem.product_id ?? '';
            const fpEntry = cache[fingerprint];
            if (fpEntry && pid === (item.productId ?? '') && serverItem.name === item.name) {
              // Update cache to use server-assigned ID going forward
              cache[serverItem.id] = fpEntry;
              setDesignCache(cache);
              return {
                ...serverItem,
                designDataUrl: fpEntry.designDataUrl ?? null,
                designFileName: fpEntry.designFileName ?? serverItem.designFileName,
              };
            }
            return serverItem;
          });

          setItems(finalItems);
        } else {
          // Rollback on failure — log untuk debugging
          console.warn('[CartContext] addItem failed:', result);
          setItems((prev) => prev.filter((i) => i.id !== tempId));
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
    // Clear design cache for this item (keyed by item id)
    if (removedItem) {
      const cache = getDesignCache();
      delete cache[itemId];
      // Also clean up legacy "productId|name" key if present
      const pid = removedItem.productId ?? removedItem.product_id ?? '';
      delete cache[`${pid}|${removedItem.name}`];
      // Clean up fingerprint key if present
      if (removedItem._designFP) {
        delete cache[removedItem._designFP];
      }
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
