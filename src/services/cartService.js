/**
 * services/cartService.js
 *
 * Cart business logic — dual-mode implementation.
 *
 * USE_BACKEND=false (default):
 *   All operations read/write from localStorage under "gala.cart".
 *   This is the original behaviour, preserved exactly.
 *
 * USE_BACKEND=true:
 *   - When user is logged in (token present): calls the Cart API.
 *   - When user is NOT logged in: falls back to localStorage cart.
 *   - On login: call syncCartOnLogin(items) to merge localStorage cart
 *     into the server cart via POST /api/cart/sync.
 *
 * Requirements: 16.1, 8.6, 8.7
 */

import { readJson, writeJson } from "../core/storage.js";
import { USE_BACKEND, api, getAccessToken } from "../core/httpClient.js";

// ---------------------------------------------------------------------------
// localStorage key for the guest / offline cart
// ---------------------------------------------------------------------------

const CART_KEY = "gala.cart";

// ---------------------------------------------------------------------------
// localStorage helpers (used when USE_BACKEND=false OR user is not logged in)
// ---------------------------------------------------------------------------

/** @returns {CartItem[]} */
function loadLocalCart() {
  return readJson(CART_KEY, []);
}

/** @param {CartItem[]} items */
function saveLocalCart(items) {
  writeJson(CART_KEY, items);
}

/**
 * Parse selected attribute values from a raw cart item.
 * Accepts a JSON array string or an already-parsed array of
 * { name, value } objects. Returns [] when empty/invalid.
 */
function parseSelectedAttributes(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const name = String(a.name ?? '').trim();
      const value = String(a.value ?? '').trim();
      if (!name || !value) return null;
      return { name, value };
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Auth token presence check
// We detect "logged in" by checking whether an access token is currently
// stored in memory (i.e. setAccessToken was called after login).
// ---------------------------------------------------------------------------

/**
 * Returns true when USE_BACKEND=true AND an access token is currently stored
 * in memory (meaning the user is authenticated).
 */
function isLoggedIn() {
  return USE_BACKEND && getAccessToken() !== null;
}

// ---------------------------------------------------------------------------
// getCart
// ---------------------------------------------------------------------------

/**
 * Return the current cart.
 *
 * - USE_BACKEND=true + logged in : GET /api/cart → returns array of items
 * - Otherwise                    : reads from localStorage
 *
 * @param {string} [userId] - kept for signature compatibility (ignored in backend mode)
 * @returns {Promise<{ items: CartItem[] }>}
 */
export async function getCart(_userId) {
  if (isLoggedIn()) {
    try {
      const res = await api.get("/api/cart");
      const raw = res.data?.data ?? [];
      // Normalize snake_case server fields to camelCase
      const resolveCartImage = (rawPath) => {
        if (!rawPath) return null;
        // Already an absolute URL or data URL — use as-is
        if (rawPath.startsWith('http') || rawPath.startsWith('data:')) return rawPath;
        // JSON array format: pick the first image
        if (rawPath.trim().startsWith('[')) {
          try {
            const arr = JSON.parse(rawPath);
            if (Array.isArray(arr) && arr.length > 0) rawPath = arr[0];
          } catch { /* not a JSON array — use raw string */ }
        }
        if (!rawPath) return null;
        // Relative path — prepend API base
        const base = import.meta.env.VITE_API_URL || '';
        return rawPath.startsWith('/') ? `${base}${rawPath}` : `${base}/${rawPath}`;
      };
      const items = raw.map((item) => ({
        ...item,
        productId: item.productId ?? item.product_id ?? null,
        image:     resolveCartImage(item.image ?? item.image_path ?? null),
        attributes: parseSelectedAttributes(item.attributes),
      }));
      return { items };
    } catch {
      // Fall back to localStorage on network error
      return { items: loadLocalCart() };
    }
  }

  // localStorage path (USE_BACKEND=false OR not logged in)
  return { items: loadLocalCart() };
}

// ---------------------------------------------------------------------------
// addToCart
// ---------------------------------------------------------------------------

/**
 * Add an item to the cart.
 *
 * - USE_BACKEND=true + logged in : POST /api/cart/items
 * - Otherwise                    : writes to localStorage
 *
 * @param {string} [userId]
 * @param {{ productId: string, name: string, price: number, quantity?: number, notes?: string, designFileName?: string, designDataUrl?: string, image?: string }} item
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function addToCart(_userId, item) {
  if (isLoggedIn()) {
    try {
      await api.post("/api/cart/items", {
        productId:      item.productId,
        name:           item.name,
        price:          item.price,
        quantity:       Math.max(1, Number(item.quantity || 1)),
        attributes:     Array.isArray(item.attributes) && item.attributes.length > 0 ? item.attributes : null,
        notes:          item.notes   || "",
        designFileName: item.designFileName || null,
      });
      return { ok: true, message: "Produk ditambahkan ke keranjang." };
    } catch (err) {
      const msg = err.response?.data?.message || "Gagal menambahkan ke keranjang.";
      return { ok: false, message: msg };
    }
  }

  // localStorage path
  const cart = loadLocalCart();
  /** @type {CartItem} */
  const newItem = {
    id:             crypto.randomUUID(),
    productId:      item.productId,
    name:           item.name,
    price:          item.price,
    image:          item.image || null,
    quantity:       Math.max(1, Number(item.quantity || 1)),
    attributes:     Array.isArray(item.attributes) ? item.attributes : [],
    notes:          item.notes    || "",
    designFileName: item.designFileName || null,
    designDataUrl:  item.designDataUrl  || null,
    createdAt:      new Date().toISOString(),
  };
  saveLocalCart([...cart, newItem]);
  return { ok: true, message: "Produk ditambahkan ke keranjang." };
}

// ---------------------------------------------------------------------------
// updateCartItemQty
// ---------------------------------------------------------------------------

/**
 * Update the quantity of a cart item.
 *
 * - USE_BACKEND=true + logged in : PATCH /api/cart/items/:itemId
 * - Otherwise                    : updates localStorage
 *
 * @param {string} [userId]
 * @param {string} itemId
 * @param {number} quantity
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function updateCartItemQty(_userId, itemId, quantity) {
  if (isLoggedIn()) {
    try {
      await api.patch(`/api/cart/items/${itemId}`, { quantity: Math.max(1, Number(quantity || 1)) });
      return { ok: true, message: "Jumlah diperbarui." };
    } catch (err) {
      const msg = err.response?.data?.message || "Gagal memperbarui jumlah.";
      return { ok: false, message: msg };
    }
  }

  // localStorage path
  const cart = loadLocalCart().map((i) =>
    i.id === itemId ? { ...i, quantity: Math.max(1, Number(quantity || 1)) } : i
  );
  saveLocalCart(cart);
  return { ok: true, message: "Jumlah diperbarui." };
}

// ---------------------------------------------------------------------------
// removeFromCart
// ---------------------------------------------------------------------------

/**
 * Remove a single item from the cart.
 *
 * - USE_BACKEND=true + logged in : DELETE /api/cart/items/:itemId
 * - Otherwise                    : removes from localStorage
 *
 * @param {string} [userId]
 * @param {string} itemId
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function removeFromCart(_userId, itemId) {
  if (isLoggedIn()) {
    try {
      await api.delete(`/api/cart/items/${itemId}`);
      return { ok: true, message: "Item dihapus dari keranjang." };
    } catch (err) {
      const msg = err.response?.data?.message || "Gagal menghapus item.";
      return { ok: false, message: msg };
    }
  }

  // localStorage path
  const cart = loadLocalCart().filter((i) => i.id !== itemId);
  saveLocalCart(cart);
  return { ok: true, message: "Item dihapus dari keranjang." };
}

// ---------------------------------------------------------------------------
// clearCart
// ---------------------------------------------------------------------------

/**
 * Clear all items from the cart.
 *
 * - USE_BACKEND=true + logged in : DELETE /api/cart
 * - Otherwise                    : clears localStorage
 *
 * @param {string} [userId]
 * @returns {Promise<void>}
 */
export async function clearCart(_userId) {
  if (isLoggedIn()) {
    try {
      await api.delete("/api/cart");
    } catch {
      // Best-effort — also clear localStorage fallback
    }
  }

  // Always clear localStorage (covers fallback and USE_BACKEND=false)
  saveLocalCart([]);
}

// ---------------------------------------------------------------------------
// syncCart
// ---------------------------------------------------------------------------

/**
 * Sync a localStorage cart to the server after login.
 *
 * Calls POST /api/cart/sync with the provided items array.
 * The server merges them into the user's server-side cart
 * (skipping the sync if the server cart is already non-empty).
 *
 * Only called when USE_BACKEND=true and user is logged in.
 *
 * @param {string} [userId]
 * @param {CartItem[]} items  - items from localStorage cart
 * @returns {Promise<{ ok: boolean }>}
 */
export async function syncCart(_userId, items) {
  if (!USE_BACKEND) return { ok: true };
  try {
    await api.post("/api/cart/sync", { items });
    // Clear the localStorage cart after successful sync
    saveLocalCart([]);
    return { ok: true };
  } catch (err) {
    console.warn("[cartService] syncCart failed:", err?.response?.data?.message || err.message);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// syncCartOnLogin — called by authService after successful login
// ---------------------------------------------------------------------------

/**
 * Merge the current localStorage cart into the server cart.
 *
 * This is the integration point called by authService.js (or CartContext.jsx)
 * immediately after a successful login, following the same pattern as
 * registerSocketHandlers in authService.js.
 *
 * Flow:
 *   1. Read the current localStorage cart.
 *   2. If it has items, call POST /api/cart/sync.
 *   3. Clear localStorage cart on success.
 *
 * @returns {Promise<void>}
 */
export async function syncCartOnLogin() {
  if (!USE_BACKEND) return;
  const localItems = loadLocalCart();
  if (localItems.length === 0) return;
  // Strip base64 design data — can be megabytes and exceeds the 1 MB body limit
  const sanitized = localItems.map(({ designDataUrl: _ddu, ...rest }) => rest);
  await syncCart(undefined, sanitized);
}

// ---------------------------------------------------------------------------
// cartSummary — convenience helper (localStorage path only)
// ---------------------------------------------------------------------------

/**
 * Return a quick summary of the localStorage cart.
 * Used by components that need count/subtotal without an async call.
 *
 * @returns {{ count: number, subtotal: number }}
 */
export function cartSummary() {
  const cart = loadLocalCart();
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return { count: cart.length, subtotal };
}

// ---------------------------------------------------------------------------
// Legacy aliases — kept so any existing import of the old function names
// continues to compile without changes.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use removeFromCart instead.
 * @param {string} itemId
 */
export function removeCartItem(itemId) {
  const cart = loadLocalCart().filter((i) => i.id !== itemId);
  saveLocalCart(cart);
}

/**
 * @deprecated Use updateCartItemQty instead.
 * @param {string} itemId
 * @param {number} quantity
 */
export function updateCartItemQuantity(itemId, quantity) {
  const cart = loadLocalCart().map((i) =>
    i.id === itemId ? { ...i, quantity: Math.max(1, Number(quantity || 1)) } : i
  );
  saveLocalCart(cart);
}
