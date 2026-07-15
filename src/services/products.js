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
    colors: ["Hitam", "Putih", "Emas", "Perak"],
    sizes: ["5x5cm", "5x10cm", "8x8cm", "10x10cm", "12x12cm", "Full Badan", "Full All", "Polos"],
    materials: ["Vinyl", "HVS", "Art Paper"],
  },
  {
    id: "p-brosur",
    category: "Brosur",
    name: "Brosur A5",
    price: 350000,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Brosur promosi full color.",
    requiresDesign: true,
    colors: ["Full Color", "Hitam Putih"],
    sizes: ["A5", "A4"],
    materials: ["Art Paper 150gsm", "Art Paper 210gsm"],
  },
  {
    id: "p-kartu-nama",
    category: "Kartu Nama",
    name: "Kartu Nama",
    price: 120000,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Kartu nama elegan untuk profesional.",
    requiresDesign: true,
    colors: ["Full Color", "Hitam Putih"],
    sizes: ["9x5.5cm"],
    materials: ["Art Carton 260gsm", "Art Carton 310gsm"],
  },
  {
    id: "p-custom",
    category: "Custom",
    name: "Custom Order",
    price: 0,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Tidak menemukan yang cocok? Buat pesanan custom.",
    requiresDesign: false,
    colors: [],
    sizes: [],
    materials: ["Konsultasi dulu"],
  },
  {
    id: "p-mug",
    category: "Furniture",
    name: "Mug Ceramic",
    price: 240000,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Gelas keramik berkualitas dengan tempelan warna custom",
    requiresDesign: false,
    colors: [],
    sizes: [],
    materials: ["Ceramic", "Transparent Glass"],
  },
  {
    id: "p-acrylic",
    category: "Acrylic",
    name: "Stand Acrylic",
    price: 210000,
    image: "/assets/img/placeholder.svg",
    shortDescription: "Stand akrilik berkualitas dengan custom design",
    requiresDesign: false,
    colors: [],
    sizes: [],
    materials: ["Stand A4", "Stand A3"],
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

function parseArrayField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
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
    colors:    parseArrayField(raw.colors),
    sizes:     parseArrayField(raw.sizes),
    materials: parseArrayField(raw.materials),
  };
}

/**
 * Resolve the price for a specific variant combination.
 *
 * Pricing rules:
 *  - Color does NOT affect price.
 *  - Size and Material each independently affect price.
 *  - Key format: `{size}|{material}` — color is intentionally excluded.
 *  - Falls back to `product.price` (base price) when no variant price is set.
 *
 * @param {object} product
 * @param {string|null|undefined} color    — ignored for pricing
 * @param {string|null|undefined} size
 * @param {string|null|undefined} material
 * @returns {number}
 */
export function resolveVariantPrice(product, color, size, material) {
  // Build key from size + material only (color does not affect price)
  const key = `${size ?? ''}|${material ?? ''}`;

  let variantPrices = product?.variantPrices ?? product?.variant_prices ?? null;

  if (typeof variantPrices === 'string' && variantPrices.trim()) {
    try {
      variantPrices = JSON.parse(variantPrices);
    } catch {
      variantPrices = null;
    }
  }

  if (variantPrices && typeof variantPrices === 'object') {
    const price = variantPrices[key];
    if (typeof price === 'number' && isFinite(price)) {
      return price;
    }
  }

  return product?.price ?? 0;
}

// ---------------------------------------------------------------------------
// Public API — delegates to backend or localStorage based on USE_BACKEND flag
// ---------------------------------------------------------------------------

export async function listProducts() {
  if (USE_BACKEND) {
    const res = await api.get("/api/products");
    const items = res.data.items ?? [];
    return items.map(normalizeProduct);
  }
  return listProductsFromLocalStorage();
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

export async function getProductById(productId) {
  if (USE_BACKEND) {
    try {
      const res = await api.get(`/api/products/${productId}`);
      return normalizeProduct(res.data.data ?? null);
    } catch (err) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  }
  const products = listProductsFromLocalStorage();
  return products.find((p) => p.id === productId) ?? null;
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
