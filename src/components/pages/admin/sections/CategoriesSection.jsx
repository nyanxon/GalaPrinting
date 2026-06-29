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
} from '../../../../services/categoryService.js';
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

// ── Inline edit row ───────────────────────────────────────────────────────────
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

  return (
    <tr>
      <td>
        {editing ? (
          <input
            ref={inputRef}
            className="adm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
            style={{ width: '100%', maxWidth: 300 }}
            aria-label="Nama kategori"
          />
        ) : (
          <span style={{ fontWeight: 500 }}>{cat.name}</span>
        )}
      </td>
      <td style={{ color: '#6b7280', fontSize: 13 }}>
        {cat.count > 0 ? `${cat.count} produk` : '—'}
      </td>
      <td>
        <div className="adm-actions">
          {editing ? (
            <>
              <button
                className="adm-btn adm-btn--primary"
                type="button"
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button
                className="adm-btn"
                type="button"
                onClick={cancelEdit}
                disabled={saving}
              >
                Batal
              </button>
            </>
          ) : (
            <>
              <button className="adm-btn adm-btn--edit" type="button" onClick={startEdit}>
                Edit
              </button>
              <button className="adm-btn adm-btn--delete" type="button" onClick={handleDelete}>
                Hapus
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
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
      <div className="adm-toolbar">
        <h2 className="adm-section-title">
          Kategori ({categories.length})
        </h2>
      </div>

      {/* Add form */}
      <form
        className="adm-form"
        onSubmit={handleAdd}
        noValidate
        style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' }}
      >
        <div style={{ flex: '1 1 240px' }}>
          <input
            ref={newInputRef}
            className="adm-input"
            placeholder="Nama kategori baru…"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setAddError(''); }}
            disabled={adding}
            aria-label="Nama kategori baru"
          />
          {addError && (
            <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>{addError}</p>
          )}
        </div>
        <button
          className="adm-btn adm-btn--primary"
          type="submit"
          disabled={adding || !newName.trim()}
        >
          {adding ? 'Menyimpan…' : '+ Tambah Kategori'}
        </button>
      </form>

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
                <EditableRow
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
