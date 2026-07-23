/**
 * AccountsSection.jsx — Account management for Owner dashboard.
 *
 * Lists ALL users across all roles with search, role filter, pagination,
 * and an Edit button that opens AccountEditModal for role + permission management.
 */

import { useState, useEffect, useCallback } from 'react';
import { listAccounts, getAccount, updateAccount } from '../../../../services/accounts.js';
import { STAFF_ROLE_CONFIG } from '../../../../config/roles.js';
import AccountEditModal from './AccountEditModal.jsx';

const PAGE_SIZE = 10;

const ALL_ROLES = [
  { value: '',          label: 'Semua Role' },
  { value: 'customer',  label: 'Customer' },
  { value: 'admin',     label: 'Super Admin' },
  { value: 'owner',     label: 'Owner' },
  { value: 'cashier',   label: 'Kasir' },
  { value: 'cs',        label: 'Customer Service' },
  { value: 'operational', label: 'Operasional' },
  { value: 'qc',        label: 'Quality Control' },
  { value: 'offline',   label: 'Offline Admin' },
];

const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

// ---------------------------------------------------------------------------
// PaginationBar (inline — same pattern as CustomersSection)
// ---------------------------------------------------------------------------
function PaginationBar({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  const pages = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
    pages.push(p);
  }

  return (
    <div className="adm-pagination">
      <span className="adm-page-info">
        {start}–{end} dari {total}
      </span>
      <div className="adm-page-btns">
        <button
          className="adm-page-btn"
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            className={`adm-page-btn${p === page ? ' active' : ''}`}
            type="button"
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          className="adm-page-btn"
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccountsSection
// ---------------------------------------------------------------------------
export default function AccountsSection() {
  const [allAccounts, setAllAccounts] = useState([]);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter]     = useState(''); // '', 'customer', 'staff'
  const [roleFilter, setRoleFilter]     = useState('');
  const [loading, setLoading]           = useState(false);

  const [editingAccount, setEditingAccount] = useState(null); // { user, permissions }
  const [saving, setSaving]                 = useState(false);

  const [toast, setToast] = useState(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      // Resolve effective role filter from type + role dropdowns
      let effectiveRole = roleFilter || undefined;
      if (typeFilter === 'customer') {
        effectiveRole = 'customer';
      } else if (typeFilter === 'staff') {
        effectiveRole = STAFF_ROLES.join(',');
      }

      const result = await listAccounts({
        page:  currentPage,
        limit: PAGE_SIZE,
        q:     searchQuery || undefined,
        role:  effectiveRole,
      });
      setAllAccounts(result.items || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, typeFilter, roleFilter]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleSearchChange(e) {
    setSearchQuery(e.target.value.trim());
    setCurrentPage(1);
  }

  function handleRoleFilterChange(e) {
    setRoleFilter(e.target.value);
    setCurrentPage(1);
  }

  function handleTypeFilterChange(e) {
    setTypeFilter(e.target.value);
    setRoleFilter(''); // reset role dropdown when type changes
    setCurrentPage(1);
  }

  async function handleEditClick(account) {
    try {
      const data = await getAccount(account.id);
      setEditingAccount(data);
    } catch (err) {
      setToast({ type: 'error', message: 'Gagal memuat detail akun.' });
    }
  }

  async function handleSave(role, permissions) {
    if (!editingAccount) return;
    setSaving(true);
    try {
      await updateAccount(editingAccount.user.id, { role, permissions });
      setEditingAccount(null);
      setToast({ type: 'success', message: 'Akun berhasil diperbarui.' });
      loadAccounts();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan perubahan.';
      setToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  }

  function getRoleLabel(role) {
    return STAFF_ROLE_CONFIG[role]?.label ?? role;
  }

  function getRoleColor(role) {
    return STAFF_ROLE_CONFIG[role]?.color ?? '#6b7280';
  }

  return (
    <div className="adm-card">
      {toast && (
        <div
          className={`adm-toast adm-toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      <div className="adm-toolbar">
        <h2 className="adm-section-title">Akun ({total})</h2>
        <div className="adm-toolbar-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="adm-input"
            value={typeFilter}
            onChange={handleTypeFilterChange}
            aria-label="Filter tipe akun"
            style={{ width: 'auto' }}
          >
            <option value="">Semua Tipe</option>
            <option value="customer">Customer</option>
            <option value="staff">Staff</option>
          </select>
          <select
            className="adm-input"
            value={roleFilter}
            onChange={handleRoleFilterChange}
            aria-label="Filter role"
            style={{ width: 'auto' }}
          >
            {ALL_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Cari nama / email…"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Cari akun"
          />
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="adm-empty">Memuat data…</td>
              </tr>
            ) : allAccounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="adm-empty">Tidak ada akun ditemukan.</td>
              </tr>
            ) : (
              allAccounts.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || '—'}</td>
                  <td>{u.email}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: getRoleColor(u.role) + '18',
                        color: getRoleColor(u.role),
                      }}
                    >
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: u.deleted_at ? '#fef2f2' : '#dcfce7',
                        color: u.deleted_at ? '#dc2626' : '#16a34a',
                      }}
                    >
                      {u.deleted_at ? 'Nonaktif' : 'Aktif'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="adm-btn adm-btn-sm"
                      type="button"
                      onClick={() => handleEditClick(u)}
                      aria-label={`Edit akun ${u.name || u.email}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={currentPage}
        totalPages={totalPages}
        total={total}
        limit={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      {editingAccount && (
        <AccountEditModal
          user={editingAccount.user}
          permissions={editingAccount.permissions}
          onClose={() => setEditingAccount(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
