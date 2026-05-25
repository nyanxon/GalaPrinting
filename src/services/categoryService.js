import { readJson, writeJson } from "../core/storage.js";
import { USE_BACKEND, api } from "../core/httpClient.js";

const KEY = "gala.categories";

/**
 * Each category has:
 *  - id: unique slug
 *  - name: display name
 *  - subCategories: array of sub-category name strings
 */
const DEFAULT_CATEGORIES = [
  {
    id: "cat-stiker",
    name: "Stiker",
    subCategories: ["Stiker Vinyl", "Stiker HVS", "Stiker Art Paper", "Stiker Transparan", "Stiker Hologram"],
  },
  {
    id: "cat-brosur",
    name: "Brosur",
    subCategories: ["Brosur A4", "Brosur A5", "Brosur Lipat 3", "Brosur Lipat 4"],
  },
  {
    id: "cat-kartu-nama",
    name: "Kartu Nama",
    subCategories: ["Kartu Nama Standard", "Kartu Nama Laminasi", "Kartu Nama Emboss", "Kartu Nama Spot UV"],
  },
  {
    id: "cat-acrylic",
    name: "Acrylic",
    subCategories: ["Stand Acrylic A4", "Stand Acrylic A3", "Gantungan Acrylic", "Plakat Acrylic"],
  },
  {
    id: "cat-furniture",
    name: "Furniture",
    subCategories: ["Mug Ceramic", "Mug Kaca", "Bantal Custom", "Tote Bag"],
  },
  {
    id: "cat-custom",
    name: "Custom",
    subCategories: ["Custom Order", "Konsultasi Desain"],
  },
];

// ---------------------------------------------------------------------------
// localStorage helpers (unchanged — only used when USE_BACKEND=false)
// ---------------------------------------------------------------------------

function ensureSeeded() {
  const existing = readJson(KEY, null);
  if (!Array.isArray(existing) || !existing.length) {
    writeJson(KEY, DEFAULT_CATEGORIES);
    return;
  }
  // Merge new categories that don't exist yet
  const existingIds = new Set(existing.map((c) => c.id));
  const newItems = DEFAULT_CATEGORIES.filter((c) => !existingIds.has(c.id));
  if (newItems.length) {
    writeJson(KEY, [...existing, ...newItems]);
  }
}

// ---------------------------------------------------------------------------
// Public API — delegates to backend or localStorage based on USE_BACKEND flag
// ---------------------------------------------------------------------------

/**
 * List all categories.
 *
 * - USE_BACKEND=true : GET /api/categories
 *   Response shape: { ok: true, data: [...] } where each item is a category object
 * - USE_BACKEND=false: original localStorage implementation (unchanged)
 *
 * Requirements: 16.1
 */
export async function listCategories() {
  if (USE_BACKEND) {
    const res = await api.get("/api/categories");
    // Backend returns { ok: true, data: [...] } — array of category objects
    const raw = res.data.data ?? res.data.items ?? res.data;
    return Array.isArray(raw) ? raw : [];
  }
  ensureSeeded();
  return readJson(KEY, []);
}

export async function getCategoryById(id) {
  const cats = await listCategories();
  return cats.find((c) => c.id === id) ?? null;
}

export async function getCategoryByName(name) {
  const cats = await listCategories();
  return cats.find((c) => c.name.toLowerCase() === String(name).toLowerCase()) ?? null;
}

/** Returns just the category names — used by product filters */
export async function listCategoryNames() {
  if (USE_BACKEND) {
    const cats = await listCategories();
    return cats.map((c) => (typeof c === "string" ? c : c.name));
  }
  ensureSeeded();
  return readJson(KEY, []).map((c) => c.name);
}

/* ── Admin CRUD ──────────────────────────────────────────── */

/**
 * Create a new category.
 * @param {string} name
 */
export async function createCategory(name) {
  if (USE_BACKEND) {
    const res = await api.post("/api/categories", { name });
    return res.data.data ?? res.data;
  }
  // localStorage fallback
  ensureSeeded();
  const categories = readJson(KEY, []);
  const category   = { id: `cat-${crypto.randomUUID()}`, name, subCategories: [] };
  writeJson(KEY, [...categories, category]);
  return category;
}

/**
 * Delete a category by id.
 * @param {string} id
 */
export async function deleteCategory(id) {
  if (USE_BACKEND) {
    try {
      await api.delete(`/api/categories/${id}`);
      return { ok: true };
    } catch (err) {
      const message = err.response?.data?.message ?? "Gagal menghapus kategori.";
      return { ok: false, message };
    }
  }
  // localStorage fallback
  ensureSeeded();
  const categories = readJson(KEY, []).filter((c) => c.id !== id);
  writeJson(KEY, categories);
  return { ok: true };
}
