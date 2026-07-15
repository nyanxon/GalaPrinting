/**
 * CategoriesSection.jsx — Full category management for admin/owner.
 *
 * Features:
 *   - List all categories with product count
 *   - Add new category
 *   - Inline rename (edit)
 *   - Delete with confirmation (warns when products are still assigned)
 */

import { useState, useEffect, useRef } from 'react';
import { showToast } from '../../../../core/toastEmitter.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../../../services/categories.js';
import { api } from '../../../../core/httpClient.js';

// Fetch category list with product counts from the raw API
async function fetchCategoriesWithCount() {
  // listCategories returns [{id, name}]
  const cats = await listCategories();
  // Fetch product counts per category via the products API
  let countMap = {};
  try {
    // GET /api/products returns paginated, use limit=1 per category is expensive —
    // instead get /api/categories with counts if available, otherwise fall back to 0
    const res = await api.get('/api/categories');
    const raw = res.data.data ?? res.data.items ?? res.data ?? [];
    if (Array.isArray(raw)) {
      raw.forEach((c) => {
        if (c.product_count !== undefined) countMap[c.id] = c.product_count;
      });
    }
  } catch {
    // non-fatal
  }
  return Array.isArray(cats)
    ? cats.map((c) => ({
        id:    typeof c === 'string' ? c : c.id,
        name:  typeof c === 'string' ? c : c.name,
        count: countMap[c.id] ?? 0,
      }))
    : [];
}

// ── Inline edit actions (renders action buttons only, used inside ExpandableRow) ──
function EditableRow({ cat, onSaved, onDelete }) {
  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(cat.name);
  const [saving, setSaving]     = useState(false);
  const inputRef = useRef(null);

  function startEdit() {
    setName(cat.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setName(cat.name);
    setEditing(false);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed === cat.name) { setEditing(false); return; }
    setSaving(true);
    const res = await updateCategory(cat.id, trimmed);
    setSaving(false);
    if (res.ok) {
      showToast(`Kategori diubah menjadi "${trimmed}".`, 'success');
      setEditing(false);
      onSaved();
    } else {
      showToast(res.message || 'Gagal mengubah kategori.', 'error');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter')  handleSave();
    if (e.key === 'Escape') cancelEdit();
  }

  async function handleDelete() {
    const warning = cat.count > 0
      ? `Kategori "${cat.name}" masih digunakan oleh ${cat.count} produk. Produk tersebut akan menjadi tanpa kategori. Hapus?`
      : `Hapus kategori "${cat.name}"?`;
    if (!window.confirm(warning)) return;
    const res = await deleteCategory(cat.id);
    if (res.ok) {
      showToast(`Kategori "${cat.name}" dihapus.`, 'success');
      onDelete();
    } else {
      showToast(res.message || 'Gagal menghapus.', 'error');
    }
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          ref={inputRef}
          className="adm-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          style={{ width: 200 }}
          aria-label="Nama kategori"
        />
        <button className="adm-btn adm-btn--primary" type="button" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
        <button className="adm-btn" type="button" onClick={cancelEdit} disabled={saving}>Batal</button>
      </div>
    );
  }

  return (
    <>
      <button className="adm-btn adm-btn--edit" type="button" onClick={startEdit}>Edit</button>
      <button className="adm-btn adm-btn--delete" type="button" onClick={handleDelete}>Hapus</button>
    </>
  );
}

// ── Product list per category (expandable) ───────────────────────────────────
function CategoryProductList({ categoryId, categoryName }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/api/products', { params: { categoryId, limit: 200 } });
        const raw = res.data.data ?? res.data.items ?? res.data ?? [];
        // filter by category name as fallback if API doesn't support categoryId filter
        const list = Array.isArray(raw) ? raw : [];
        const filtered = list.filter(
          (p) => p.category_id === categoryId || p.categoryId === categoryId ||
                 (p.category && p.category.toLowerCase() === categoryName.toLowerCase())
        );
        setProducts(filtered);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [categoryId, categoryName]);

  if (loading) return <p style={{ color: '#9ca3af', fontSize: 12, margin: '4px 0 8px 0', padding: '0 8px' }}>Memuat produk…</p>;
  if (products.length === 0) return <p style={{ color: '#9ca3af', fontSize: 12, margin: '4px 0 8px 0', padding: '0 8px', fontStyle: 'italic' }}>Tidak ada produk.</p>;

  return (
    <div style={{ padding: '4px 8px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {products.map((p) => (
        <span key={p.id} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#f3f4f6', borderRadius: 6, padding: '3px 8px', fontSize: 12,
          border: '1px solid #e5e7eb',
        }}>
          {p.image && (
            <img src={p.image} alt="" style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 3 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
          <span>{p.name}</span>
        </span>
      ))}
    </div>
  );
}

// ── Expandable row ────────────────────────────────────────────────────────────
function ExpandableRow({ cat, onSaved, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr>
        <td>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontWeight: 500, fontSize: 14, color: 'inherit', padding: 0,
            }}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Sembunyikan' : 'Tampilkan'} produk ${cat.name}`}
          >
            <span style={{ fontSize: 11, color: '#785e40', transition: 'transform 0.2s',
              display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
            {cat.name}
          </button>
        </td>
        <td style={{ color: '#6b7280', fontSize: 13 }}>
          {cat.count > 0 ? `${cat.count} produk` : '—'}
        </td>
        <td>
          <div className="adm-actions">
            <EditableRow cat={cat} onSaved={onSaved} onDelete={onDelete} />
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={3} style={{ padding: 0, background: '#fafaf9' }}>
            <CategoryProductList categoryId={cat.id} categoryName={cat.name} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function CategoriesSection() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [newName, setNewName]       = useState('');
  const [adding, setAdding]         = useState(false);
  const [addError, setAddError]     = useState('');
  const newInputRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const cats = await fetchCategoriesWithCount();
      setCategories(cats);
    } catch {
      showToast('Gagal memuat kategori.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) { setAddError('Nama kategori tidak boleh kosong.'); return; }

    const exists = categories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) { setAddError('Kategori sudah ada.'); return; }

    setAdding(true);
    setAddError('');
    try {
      await createCategory(trimmed);
      showToast(`Kategori "${trimmed}" ditambahkan.`, 'success');
      setNewName('');
      await load();
      newInputRef.current?.focus();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Gagal menambahkan kategori.', 'error');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="adm-card">
      {/* Header + Add form in one row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 className="adm-section-title" style={{ margin: 0, alignSelf: 'center', whiteSpace: 'nowrap' }}>
          Kategori ({categories.length})
        </h2>
        <form
          className="adm-form"
          onSubmit={handleAdd}
          noValidate
          style={{ flex: '1 1 360px', display: 'flex', gap: 8, alignItems: 'flex-start', margin: 0 }}
        >
          <div style={{ flex: 1 }}>
            <input
              ref={newInputRef}
              className="adm-input"
              placeholder="Nama kategori baru…"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setAddError(''); }}
              disabled={adding}
              aria-label="Nama kategori baru"
              style={{ width: '100%' }}
            />
            {addError && (
              <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>{addError}</p>
            )}
          </div>
          <button
            className="adm-btn adm-btn--primary"
            type="submit"
            disabled={adding || !newName.trim()}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {adding ? 'Menyimpan…' : '+ Tambah Kategori'}
          </button>
        </form>
      </div>

      {/* Category table */}
      {loading ? (
        <p style={{ color: '#6b7280', padding: '12px 0' }}>Memuat…</p>
      ) : categories.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '12px 0' }}>Belum ada kategori.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Nama Kategori</th>
                <th>Produk</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <ExpandableRow
                  key={cat.id}
                  cat={cat}
                  onSaved={load}
                  onDelete={load}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
