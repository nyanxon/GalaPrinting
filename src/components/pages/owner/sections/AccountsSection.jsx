/**
 * AccountsSection.jsx — Owner dashboard "ACCOUNT" menu.
 *
 * Since the auth split, customers and staff live in separate tables
 * (users_customer / users_admin) and the SAME email may exist in both
 * (1 customer account + 1 admin account). This view keeps the two clearly
 * separated with two tabs:
 *   - Akun Customer → users_customer (role=customer)
 *   - Akun Admin    → users_admin    (all STAFF_ROLES)
 *
 * Admin accounts are created MANUALLY by the Owner (+ Buat Staff), never
 * promoted from a customer — so a staff row never overlaps the customer list.
 */

import { useState, useEffect, useCallback, useContext } from 'react';
import { listAccounts, getAccount, updateAccount } from '../../../../services/accounts.js';
import { AuthContext } from '../../../context/AuthContext.jsx';
import { STAFF_ROLES, STAFF_ROLE_CONFIG } from '../../../../config/roles.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import { track } from '../../../../utils/activityTracker.js';
import AccountEditModal from './AccountEditModal.jsx';
import CreateStaffAccountModal from './CreateStaffAccountModal.jsx';
import CreateCustomerAccountModal from '../../admin/sections/CreateCustomerAccountModal.jsx';

const PAGE_SIZE = 10;

const TAB_CUSTOMERS = 'customers';
const TAB_ADMIN     = 'admin';

const TABS = [
  { id: TAB_CUSTOMERS, label: 'Akun Customer' },
  { id: TAB_ADMIN,     label: 'Akun Admin' },
];

export default function AccountsSection() {
  const { user } = useContext(AuthContext);
  const isOwner = user?.role === 'owner';

  const [activeTab, setActiveTab]     = useState(TAB_CUSTOMERS);
  const [items, setItems]             = useState([]);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading]         = useState(false);

  const [editingAccount, setEditingAccount] = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [showCreateStaff, setShowCreateStaff]     = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const [toast, setToast] = useState(null);

  const isCustomersTab = activeTab === TAB_CUSTOMERS;

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      // Split-source listing: customers stay in users_customer, staff in users_admin.
      const role = isCustomersTab ? 'customer' : STAFF_ROLES.join(',');
      const result = await listAccounts({
        page: currentPage,
        limit: PAGE_SIZE,
        q: searchQuery || undefined,
        role,
      });
      setItems(result.items || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [isCustomersTab, currentPage, searchQuery]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleTabChange(tab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setCurrentPage(1);
    setShowCreateCustomer(false);
    setShowCreateStaff(false);
  }

  function handleSearchChange(e) {
    setSearchQuery(e.target.value.trim());
    setCurrentPage(1);
  }

  async function handleEditClick(account) {
    try {
      const data = await getAccount(account.id);
      setEditingAccount(data);
    } catch (_err) {
      setToast({ type: 'error', message: 'Gagal memuat detail akun.' });
    }
  }

  async function handleSave(role, permissions) {
    if (!editingAccount) return;
    setSaving(true);
    try {
      await updateAccount(editingAccount.user.id, { role, permissions });
      track('Ubah Role Akun', {
        targetType: 'account', targetId: editingAccount.user.id,
        metadata: { name: editingAccount.user?.name ?? null, role, is_admin: true },
      });
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

  function handleStaffCreated(staff) {
    setShowCreateStaff(false);
    setToast({
      type: 'success',
      message: `Akun staff ${staff.name || staff.email} berhasil dibuat. Staff wajib mengganti password pada login pertama.`,
    });
    loadAccounts();
  }

  function handleCustomerCreated(customer) {
    setShowCreateCustomer(false);
    setToast({
      type: 'success',
      message: `Akun customer ${customer.name || customer.email} berhasil dibuat.`,
    });
    loadAccounts();
  }

  function getRoleLabel(role) {
    return STAFF_ROLE_CONFIG[role]?.label ?? role;
  }

  function getRoleColor(role) {
    return STAFF_ROLE_CONFIG[role]?.color ?? 'var(--gray-500)';
  }

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? '';

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

      {/* ── Tab bar: customers vs admin/staff ── */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          borderBottom: '2px solid var(--border)',
          flexWrap: 'wrap',
        }}
        role="tablist"
        aria-label="Pilih jenis akun"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--brand-brown)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--brand-brown)' : '#555',
              cursor: 'pointer',
              marginBottom: -2,
              borderRadius: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="adm-toolbar">
        <h2 className="adm-section-title">{activeLabel} ({total})</h2>
        <div className="adm-toolbar-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Cari nama / email…"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label={`Cari di ${activeLabel}`}
          />
          {isOwner && isCustomersTab && (
            <button
              className="adm-btn adm-btn--primary"
              type="button"
              onClick={() => setShowCreateCustomer(true)}
              aria-label="Buat akun customer baru"
            >
              + Buat Customer
            </button>
          )}
          {isOwner && !isCustomersTab && (
            <button
              className="adm-btn adm-btn--primary"
              type="button"
              onClick={() => setShowCreateStaff(true)}
              aria-label="Buat akun staff baru"
            >
              + Buat Staff
            </button>
          )}
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              {isCustomersTab ? <th>No. HP</th> : <th>Role</th>}
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="adm-empty">Memuat data…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="adm-empty">Tidak ada akun ditemukan.</td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || '—'}</td>
                  <td>{u.email}</td>
                  <td>
                    {isCustomersTab ? (
                      <span>{u.phone || '—'}</span>
                    ) : (
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
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: u.deleted_at ? 'var(--color-danger-bg-2)' : 'var(--color-success-border-light)',
                        color: u.deleted_at ? 'var(--color-danger)' : 'var(--color-success)',
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

      {showCreateStaff && (
        <CreateStaffAccountModal
          onClose={() => setShowCreateStaff(false)}
          onCreated={handleStaffCreated}
        />
      )}

      {showCreateCustomer && (
        <CreateCustomerAccountModal
          onClose={() => setShowCreateCustomer(false)}
          onCreated={handleCustomerCreated}
        />
      )}
    </div>
  );
}