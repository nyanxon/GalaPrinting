import { readJson, writeJson } from "../core/storage.js";
import { listCategoryNames } from "./categories.js";
import { normalizePagination } from "../utils/validate.js";
import { USE_BACKEND, api, resolveApiUrl } from "../core/httpClient.js";

const KEY = "gala.products";

const DEFAULT_PRODUCTS = [
  {
    id: "p-stiker",
    category: "Stiker",
    name: "Stiker Vinyl",
    price: 25000,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Stiker tahan air, cocok untuk branding.",
    requiresDesign: true,
    sizeType: "none",
  },
  {
    id: "p-brosur",
    category: "Brosur",
    name: "Brosur A5",
    price: 350000,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Brosur promosi full color.",
    requiresDesign: true,
    sizeType: "none",
  },
  {
    id: "p-kartu-nama",
    category: "Kartu Nama",
    name: "Kartu Nama",
    price: 120000,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Kartu nama elegan untuk profesional.",
    requiresDesign: true,
    sizeType: "none",
  },
  {
    id: "p-custom",
    category: "Custom",
    name: "Custom Order",
    price: 0,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Tidak menemukan yang cocok? Buat pesanan custom.",
    requiresDesign: false,
    sizeType: "none",
  },
  {
    id: "p-mug",
    category: "Furniture",
    name: "Mug Ceramic",
    price: 240000,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Gelas keramik berkualitas dengan tempelan warna custom",
    requiresDesign: false,
    sizeType: "none",
  },
  {
    id: "p-acrylic",
    category: "Acrylic",
    name: "Stand Acrylic",
    price: 210000,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Stand akrilik berkualitas dengan custom design",
    requiresDesign: false,
    sizeType: "none",
  },
];

function ensureSeeded() {
  const existing = readJson(KEY, null);
  if (!Array.isArray(existing) || !existing.length) {
    // First time: write all defaults
    writeJson(KEY, DEFAULT_PRODUCTS);
    return;
  }
  // Merge: add any new default products that aren't in storage yet
  const existingIds = new Set(existing.map((p) => p.id));
  const newItems = DEFAULT_PRODUCTS.filter((p) => !existingIds.has(p.id));
  if (newItems.length) {
    writeJson(KEY, [...existing, ...newItems]);
  }
}

// ---------------------------------------------------------------------------
// localStorage implementations (unchanged — only used when USE_BACKEND=false)
// ---------------------------------------------------------------------------

function listProductsFromLocalStorage() {
  ensureSeeded();
  return readJson(KEY, []);
}

function listProductsPaginatedFromLocalStorage(opts = {}) {
  const { page, limit } = normalizePagination(opts);
  let items = listProductsFromLocalStorage();

  if (opts.category) items = items.filter((p) => p.category === opts.category);
  if (opts.search)   items = items.filter((p) => p.name.toLowerCase().includes(opts.search.toLowerCase()));

  const total      = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * limit;

  return { items: items.slice(start, start + limit), total, page: safePage, limit, totalPages };
}

// ---------------------------------------------------------------------------
// Helper: normalize a raw product row from the backend
// Converts snake_case fields and parses JSON array fields
// ---------------------------------------------------------------------------

/**
 * Parse dynamic product attributes from a raw product row.
 * Accepts a JSON array string or an already-parsed array of
 * { name, affectsPrice, values[] } objects. Returns [] when empty/invalid.
 *
 * Struktur baru: values berupa [{ value: string, priceModifier: number }].
 * Backward compatible — data lama (values string biasa) dinormalisasi menjadi
 * { value, priceModifier: 0 } dengan affectsPrice: false.
 */
export function parseAttributes(raw) {
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
    .map((attr) => {
      if (!attr || typeof attr !== 'object') return null;
      const name = String(attr.name ?? '').trim();
      if (!name) return null;
      const affectsPrice = Boolean(attr.affectsPrice);
      const values = (Array.isArray(attr.values) ? attr.values : [])
        .map((v) => {
          // Data lama: string biasa
          if (typeof v === 'string') {
            const trimmed = v.trim();
            return trimmed ? { value: trimmed, priceModifier: 0 } : null;
          }
          if (!v || typeof v !== 'object') return null;
          const value = String(v.value ?? '').trim();
          if (!value) return null;
          const pm = Number(v.priceModifier ?? 0);
          return {
            value,
            priceModifier: affectsPrice && Number.isFinite(pm) && pm > 0 ? pm : 0,
          };
        })
        .filter(Boolean);
      return { name, affectsPrice, values };
    })
    .filter(Boolean);
}

function normalizeProduct(raw) {
  if (!raw) return raw;
  // Parse image_path — may be a JSON array string (new format) or a single URL (legacy)
  let imagePrimary = raw.image || raw.image_path || null;
  if (typeof imagePrimary === 'string' && imagePrimary.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(imagePrimary);
      if (Array.isArray(parsed) && parsed.length > 0) {
        imagePrimary = parsed[0];
      }
    } catch (_err) {
      // Not a valid JSON array — use the raw string as-is
    }
  }
  // Resolve relative upload paths to absolute URLs (e.g. /uploads/products/xxx.jpg
  // needs to be prefixed with VITE_API_URL when running on a different origin)
  const resolveImg = (url) => {
    if (!url) return url;
    // Placeholder SVG — keep as-is (served from frontend build)
    if (url.includes('placeholder')) return url;
    return resolveApiUrl(url) || url;
  };

  const resolvedPrimary = resolveImg(imagePrimary);

  return {
    ...raw,
    image:            resolvedPrimary,
    images:           (() => {
      const raw2 = raw.image || raw.image_path || null;
      if (typeof raw2 === 'string' && raw2.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(raw2);
          if (Array.isArray(parsed)) return parsed.map(resolveImg).filter(Boolean);
        } catch (_err) {
          // Not a JSON array — fall through to single-URL path below
        }
      }
      if (raw2 && !raw2.includes('placeholder')) return [resolveImg(raw2)].filter(Boolean);
      return [];
    })(),
    shortDescription: raw.shortDescription || raw.short_description || '',
    requiresDesign:   raw.requiresDesign   ?? raw.requires_design   ?? false,
    sizeType:         raw.sizeType         ?? raw.size_type         ?? 'none',
    isHiddenFromCustomer: Boolean(raw.isHiddenFromCustomer ?? raw.is_hidden_from_customer ?? false),
    attributes:       parseAttributes(raw.attributes),
    // Harga Customer/Broker — raw.price_customer adalah sumber utama (kolom DB).
    // `price` dipertahankan sebagai alias harga customer agar public site tetap berfungsi.
    priceCustomer:    Number(raw.priceCustomer ?? raw.price_customer ?? raw.price ?? 0),
    priceBroker:      Number(raw.priceBroker   ?? raw.price_broker   ?? raw.priceCustomer ?? raw.price_customer ?? raw.price ?? 0),
    price:            Number(raw.priceCustomer ?? raw.price_customer ?? raw.price ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Public API — delegates to backend or localStorage based on USE_BACKEND flag
// ---------------------------------------------------------------------------

/**
 * List all products (unpaginated).
 * @param {{ visible?: boolean }} [opts] - when `visible` is true, only
 *   products that are not hidden from the customer storefront are returned
 *   (filter diterapkan di backend: WHERE is_hidden_from_customer = 0).
 * @returns {Promise<object[]>}
 */
export async function listProducts(opts = {}) {
  if (USE_BACKEND) {
    const params = {};
    if (opts.visible) params.visible = 'true';
    const res = await api.get("/api/products", { params });
    const items = res.data.items ?? [];
    return items.map(normalizeProduct);
  }
  let items = listProductsFromLocalStorage();
  if (opts.visible) items = items.filter((p) => !p.isHiddenFromCustomer);
  return items;
}

/**
 * Paginated product list.
 * @param {{ page?: number, limit?: number, category?: string, search?: string }} opts
 * @returns {Promise<{ items: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listProductsPaginated(opts = {}) {
  if (USE_BACKEND) {
    const { page, limit } = normalizePagination(opts);
    const params = { page, limit };
    if (opts.category) params.category = opts.category;
    if (opts.search)   params.search   = opts.search;

    const res = await api.get("/api/products", { params });
    const { items, total, totalPages } = res.data;
    return { items: (items ?? []).map(normalizeProduct), total: total ?? 0, page, limit, totalPages: totalPages ?? 1 };
  }
  return listProductsPaginatedFromLocalStorage(opts);
}

/**
 * Search products by name keyword (cashier autocomplete).
 * @param {string} q keyword
 * @returns {Promise<object[]>} lightweight rows: id, name, price_customer,
 *   price_broker, category, size_type dan attributes ter-parse (untuk form
 *   order offline).
 */
export async function searchProducts(q) {
  const keyword = String(q || '').trim();
  if (!keyword) return [];
  if (USE_BACKEND) {
    const res = await api.get('/api/products/search', { params: { q: keyword, limit: 10 } });
    return (res.data.items ?? []).map((row) => ({
      ...row,
      attributes: parseAttributes(row.attributes),
    }));
  }
  return listProductsFromLocalStorage()
    .filter((p) => p.name.toLowerCase().includes(keyword.toLowerCase()))
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price_customer: Number(p.price_customer ?? p.price ?? 0),
      price_broker:   Number(p.price_broker   ?? p.price ?? 0),
      category: p.category || null,
      size_type: p.size_type ?? p.sizeType ?? 'none',
      attributes: parseAttributes(p.attributes),
    }));
}

/**
 * Get a single product by id.
 * @param {string} productId
 * @param {{ visible?: boolean }} [opts] - when `visible` is true, a product
 *   hidden from the customer storefront is treated as not found (backend:
 *   AND is_hidden_from_customer = 0).
 * @returns {Promise<object|null>}
 */
export async function getProductById(productId, opts = {}) {
  if (USE_BACKEND) {
    try {
      const params = {};
      if (opts.visible) params.visible = 'true';
      const res = await api.get(`/api/products/${productId}`, { params });
      return normalizeProduct(res.data.data ?? null);
    } catch (err) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  }
  const products = listProductsFromLocalStorage();
  const product = products.find((p) => p.id === productId) ?? null;
  if (opts.visible && product?.isHiddenFromCustomer) return null;
  return product;
}

export async function listCategories() {
  if (USE_BACKEND) {
    const res = await api.get("/api/categories");
    const raw = res.data.data ?? res.data.items ?? res.data;
    if (Array.isArray(raw)) return raw.map((c) => (typeof c === "string" ? c : c.name));
    return [];
  }
  return listCategoryNames();
}

/* ── Admin CRUD ──────────────────────────────────────────── */

/**
 * Add a new product.
 * @param {Omit<object, "id">} data
 */
export async function addProduct(data) {
  if (USE_BACKEND) {
    const res = await api.post("/api/products", data);
    return res.data.data ?? res.data;
  }
  const products = listProductsFromLocalStorage();
  const product  = { id: crypto.randomUUID(), ...data };
  writeJson(KEY, [...products, product]);
  return product;
}

/**
 * Update an existing product by id.
 * @param {string} productId
 * @param {Partial<object>} patch
 */
export async function updateProduct(productId, patch) {
  if (USE_BACKEND) {
    try {
      const res = await api.put(`/api/products/${productId}`, patch);
      return { ok: true, product: res.data.data ?? res.data };
    } catch (err) {
      const message = err.response?.data?.message ?? "Gagal memperbarui produk.";
      return { ok: false, message };
    }
  }
  const products = listProductsFromLocalStorage();
  const idx      = products.findIndex((p) => p.id === productId);
  if (idx === -1) return { ok: false, message: "Produk tidak ditemukan." };
  products[idx] = { ...products[idx], ...patch };
  writeJson(KEY, products);
  return { ok: true, product: products[idx] };
}

/**
 * Upload a single product image file to the server.
 * @param {File} file
 * @returns {Promise<string>} The server URL of the uploaded image
 */
export async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await api.post('/api/products/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  if (!res.data.ok) throw new Error(res.data.message);
  return res.data.url;
}

/**
 * Delete a product by id.
 * @param {string} productId
 */
export async function deleteProduct(productId) {
  if (USE_BACKEND) {
    try {
      await api.delete(`/api/products/${productId}`);
      return { ok: true };
    } catch (err) {
      const message = err.response?.data?.message ?? "Gagal menghapus produk.";
      return { ok: false, message };
    }
  }
  const products = listProductsFromLocalStorage().filter((p) => p.id !== productId);
  writeJson(KEY, products);
  return { ok: true };
}
