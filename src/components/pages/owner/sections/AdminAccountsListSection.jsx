/**
 * AdminAccountsListSection.jsx — Owner: list promotable accounts with
 * promote / revoke actions (dynamic permission system, Step 5).
 *
 * Reads from GET /api/admin-accounts. A promoted account gets an
 * "Atur Fitur" button that navigates to the per-account permission editor.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { listAdminAccounts, promoteAccount, revokeAccount } from '../../../../services/adminManagement.js';
import { STAFF_ROLE_CONFIG } from '../../../../config/roles.js';
import { showToast } from '../../../../core/toastEmitter.js';
import { track } from '../../../../utils/activityTracker.js';
import ConfirmDialog from '../../../ui/ConfirmDialog.jsx';
import CreateStaffAccountModal from './CreateStaffAccountModal.jsx';

export default function AdminAccountsListSection() {
  const navigate = useNavigate();

  const [accounts, setAccounts]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const [busyUserId, setBusyUserId] = useState(null);
  const [showCreateStaff, setShowCreateStaff] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listAdminAccounts({ q: searchQuery || undefined });
      setAccounts(Array.isArray(items) ? items : []);
    } catch (_err) {
      showToast('Gagal memuat daftar akun.', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  function handleSearchChange(e) {
    setSearchInput(e.target.value);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  function handleSearchReset() {
    setSearchInput('');
    setSearchQuery('');
  }

  async function handlePromote(account) {
    setBusyUserId(account.id);
    try {
      await promoteAccount(account.id);
      track('Promote Admin', {
        targetType: 'account', targetId: account.id,
        metadata: { name: account.name ?? null, email: account.email ?? null },
      });
      showToast(`${account.name || account.email} sekarang adalah Admin Dinamis.`);
      // Langsung arahkan Owner ke halaman permission akun tersebut.
      navigate(`/admin/owner/admin-management/${account.id}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menjadikan admin.';
      showToast(msg, 'error');
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRevokeConfirm() {
    if (!pendingRevoke) return;
    const account = pendingRevoke;
    setBusyUserId(account.id);
    try {
      await revokeAccount(account.id);
      track('Revoke Admin', {
        targetType: 'account', targetId: account.id,
        metadata: { name: account.name ?? null, email: account.email ?? null },
      });
      showToast(`${account.name || account.email} dicabut dari Admin Dinamis.`);
      await loadAccounts();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mencabut admin.';
      showToast(msg, 'error');
    } finally {
      setBusyUserId(null);
      setPendingRevoke(null);
    }
  }

  const promotedCount = accounts.filter((a) => a.is_promoted_admin).length;

  function getRoleLabel(role) {
    return STAFF_ROLE_CONFIG[role]?.label ?? role;
  }

  function getRoleColor(role) {
    return STAFF_ROLE_CONFIG[role]?.color ?? '#6b7280';
  }

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">
          Kelola Admin ({accounts.length})
          {promotedCount > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginLeft: '8px' }}>
              · {promotedCount} admin dinamis
            </span>
          )}
        </h2>
        <form className="adm-toolbar-right" onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Cari nama / email…"
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Cari akun yang bisa dipromosikan"
          />
          <button className="adm-btn" type="submit" aria-label="Terapkan pencarian">
            Cari
          </button>
          {searchQuery && (
            <button className="adm-btn adm-btn-sm" type="button" onClick={handleSearchReset} aria-label="Hapus pencarian">
              Reset
            </button>
          )}
          <button
            className="adm-btn adm-btn--primary"
            type="button"
            onClick={() => setShowCreateStaff(true)}
            aria-label="Buat akun staff baru"
          >
            + Buat Staff
          </button>
        </form>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6b7280' }}>
        Pilih akun staff untuk dijadikan Admin Dinamis. Admin Dinamis dikontrol lewat fitur-fitur
        yang dipasang di halaman &ldquo;Atur Fitur&rdquo;, bukan lewat role hardcode.
      </p>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status Admin</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="adm-empty">Memuat data…</td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="adm-empty">
                  {searchQuery ? 'Tidak ada akun yang cocok.' : 'Tidak ada akun untuk dipromosikan.'}
                </td>
              </tr>
            ) : (
              accounts.map((u) => {
                const promoted = Boolean(u.is_promoted_admin);
                const busy = busyUserId === u.id;
                return (
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
                          background: promoted ? '#dcfce7' : '#f3f4f6',
                          color: promoted ? '#16a34a' : '#6b7280',
                        }}
                      >
                        {promoted ? 'Admin Dinamis' : 'Reguler'}
                      </span>
                    </td>
                    <td>
                      <div className="adm-actions">
                        {promoted ? (
                          <>
                            <button
                              className="adm-btn adm-btn-sm adm-btn--edit"
                              type="button"
                              onClick={() => navigate(`/admin/owner/admin-management/${u.id}`)}
                              aria-label={`Atur fitur ${u.name || u.email}`}
                            >
                              Atur Fitur
                            </button>
                            <button
                              className="adm-btn adm-btn-sm adm-btn--delete"
                              type="button"
                              disabled={busy}
                              onClick={() => setPendingRevoke(u)}
                              aria-label={`Cabut admin ${u.name || u.email}`}
                            >
                              {busy ? 'Memproses…' : 'Cabut Admin'}
                            </button>
                          </>
                        ) : (
                          <button
                            className="adm-btn adm-btn-sm adm-btn--primary"
                            type="button"
                            disabled={busy}
                            onClick={() => handlePromote(u)}
                            aria-label={`Jadikan admin ${u.name || u.email}`}
                          >
                            {busy ? 'Memproses…' : 'Jadikan Admin'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingRevoke)}
        onClose={() => setPendingRevoke(null)}
        onConfirm={handleRevokeConfirm}
        title="Cabut Admin Dinamis"
        message={`Cabut status Admin Dinamis dari ${pendingRevoke?.name || pendingRevoke?.email || 'akun ini'}?`}
        confirmLabel="Cabut"
        confirmClass="danger"
      />

      {showCreateStaff && (
        <CreateStaffAccountModal
          onClose={() => setShowCreateStaff(false)}
          onCreated={(staff) => {
            showToast(`Akun staff ${staff.name || staff.email} berhasil dibuat.`);
            loadAccounts();
          }}
        />
      )}
    </div>
  );
}
