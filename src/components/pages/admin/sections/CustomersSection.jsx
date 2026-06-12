/**
 * CustomersSection.jsx — Customer list with search, pagination, and role management.
 * Equivalent to vanilla admin/sections/customersSection.js
 *
 * Requirements: 9.2, 16.4
 */

import { useState, useEffect, useContext } from 'react';
import { listCustomers, updateUserRole } from '../../../../services/authService.js';
import { AuthContext } from '../../context/AuthContext.jsx';

const PAGE_SIZE = 10;

const ALL_ROLES = ['customer', 'admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

const ROLE_LABELS = {
  customer:    'Customer',
  admin:       'Admin',
  owner:       'Owner',
  cashier:     'Cashier',
  cs:          'CS',
  operational: 'Operational',
  qc:          'QC',
  offline:     'Offline',
};

function PaginationBar({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

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

/**
 * Modal konfirmasi sebelum mengubah role.
 */
function ConfirmRoleModal({ customer, newRole, onConfirm, onCancel, saving }) {
  return (
    <div
      className="adm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-role-title"
    >
      <div className="adm-modal">
        <h3 className="adm-modal-title" id="confirm-role-title">
          Ubah Role Akun
        </h3>
        <p className="adm-modal-body">
          Anda akan mengubah role akun <strong>{customer.name || customer.email}</strong> dari{' '}
          <strong>{ROLE_LABELS[customer.role] ?? customer.role}</strong> menjadi{' '}
          <strong>{ROLE_LABELS[newRole] ?? newRole}</strong>.
        </p>
        <p className="adm-modal-body" style={{ color: '#c0392b', fontSize: '0.85rem' }}>
          Akun ini akan dipindahkan dari daftar customer dan mendapatkan akses sesuai role baru.
        </p>
        <div className="adm-modal-actions">
          <button
            className="adm-btn adm-btn-secondary"
            type="button"
            onClick={onCancel}
            disabled={saving}
          >
            Batal
          </button>
          <button
            className="adm-btn adm-btn-danger"
            type="button"
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? 'Menyimpan…' : 'Ya, Ubah Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersSection() {
  const { user: currentUser } = useContext(AuthContext);

  const [allCustomers, setAllCustomers]   = useState([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [currentPage, setCurrentPage]     = useState(1);

  // Role-change state
  const [pendingChange, setPendingChange] = useState(null); // { customer, newRole }
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState(null); // { type: 'success'|'error', message }

  const canChangeRole = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  useEffect(() => {
    async function load() {
      try {
        const customers = await listCustomers();
        setAllCustomers(Array.isArray(customers) ? customers : []);
      } catch (err) {
        console.error('Failed to load customers:', err);
      }
    }
    load();
  }, []);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const q = searchQuery.toLowerCase();
  const filtered = q
    ? allCustomers.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.phone || '').includes(q)
      )
    : allCustomers;

  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const items      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearchChange(e) {
    setSearchQuery(e.target.value.trim());
    setCurrentPage(1);
  }

  function handleRoleSelect(customer, newRole) {
    if (newRole === customer.role) return;
    setPendingChange({ customer, newRole });
  }

  async function handleConfirmRoleChange() {
    if (!pendingChange) return;
    const { customer, newRole } = pendingChange;
    setSaving(true);
    try {
      const result = await updateUserRole(customer.id, newRole);
      if (result.ok) {
        // Remove from list if role changed away from 'customer', otherwise update in-place
        if (newRole !== 'customer') {
          setAllCustomers((prev) => prev.filter((u) => u.id !== customer.id));
        } else {
          setAllCustomers((prev) =>
            prev.map((u) => (u.id === customer.id ? { ...u, role: newRole } : u))
          );
        }
        setToast({ type: 'success', message: `Role ${customer.name || customer.email} berhasil diubah menjadi ${ROLE_LABELS[newRole] ?? newRole}.` });
      } else {
        setToast({ type: 'error', message: result.message || 'Gagal mengubah role.' });
      }
    } catch (err) {
      console.error('updateUserRole error:', err);
      setToast({ type: 'error', message: 'Terjadi kesalahan. Coba lagi.' });
    } finally {
      setSaving(false);
      setPendingChange(null);
    }
  }

  return (
    <div className="adm-card">
      {/* Toast notification */}
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
        <h2 className="adm-section-title">Daftar Customer ({total})</h2>
        <div className="adm-toolbar-right">
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Cari nama / email / telepon…"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Cari customer"
          />
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Telepon</th>
              <th>Bergabung</th>
              {canChangeRole && <th>Role</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={canChangeRole ? 5 : 4} className="adm-empty">
                  Belum ada customer.
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || '—'}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td className="adm-date">
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  {canChangeRole && (
                    <td>
                      <select
                        className="adm-role-select"
                        value={u.role}
                        onChange={(e) => handleRoleSelect(u, e.target.value)}
                        aria-label={`Ubah role ${u.name || u.email}`}
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={safePage}
        totalPages={totalPages}
        total={total}
        limit={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      {/* Confirmation modal */}
      {pendingChange && (
        <ConfirmRoleModal
          customer={pendingChange.customer}
          newRole={pendingChange.newRole}
          onConfirm={handleConfirmRoleChange}
          onCancel={() => setPendingChange(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
