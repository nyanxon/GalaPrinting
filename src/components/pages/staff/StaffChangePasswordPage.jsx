/**
 * StaffChangePasswordPage.jsx
 *
 * Staff-only "change password" page at /admin/change-password.
 * Used for:
 *   1. Forced change — after staff login with must_change_password=true
 *   2. Voluntary change — from the staff sidebar/profile
 *
 * Matches the /admin/login theme (brown gradient background + centered card).
 * Requires an authenticated session; the backend dispatches staff roles to
 * adminAuth.changePassword (users_admin) automatically.
 */

import { useState, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext.jsx';
import { changePassword } from '../../../services/auth.js';
import { STAFF_ROLES, STAFF_ROLE_DASHBOARD_PATH } from '../../../config/roles.js';
import { track } from '../../../utils/activityTracker.js';
import logoImg from '../../../assets/logo.png';
import '../../../styles/css/pages/admin-login.css';

function StaffChangePasswordPage() {
  const { user, updateUser, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm]             = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);

  const isStaff = Boolean(user) && STAFF_ROLES.includes(user.role);

  if (loading) return null;
  if (!isStaff) return <Navigate to="/admin/login" replace />;

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: null }));
    if (apiError) setApiError('');
  }

  function validate() {
    const errs = {};
    if (!form.currentPassword) errs.currentPassword = 'Password lama wajib diisi.';
    if (!form.newPassword) errs.newPassword = 'Password baru wajib diisi.';
    else if (form.newPassword.length < 6) errs.newPassword = 'Password baru minimal 6 karakter.';
    if (form.newPassword !== form.confirmPassword) errs.confirmPassword = 'Konfirmasi password tidak cocok.';
    if (form.currentPassword && form.newPassword && form.currentPassword === form.newPassword) {
      errs.newPassword = 'Password baru harus berbeda dari password lama.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      if (res.ok) {
        track('Ubah Password', {
          targetType: 'account', targetId: user?.id ?? null,
          metadata: { forced: Boolean(user?.must_change_password), scope: 'staff' },
        });
        setSuccess(true);
        const { getCurrentUser } = await import('../../../services/auth.js');
        const freshUser = await getCurrentUser();
        if (freshUser) updateUser(freshUser);
      } else {
        setApiError(res.message);
      }
    } catch {
      setApiError('Terjadi kesalahan. Coba lagi nanti.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    const path = isStaff ? (STAFF_ROLE_DASHBOARD_PATH[user.role] || '/admin/superadmin') : '/admin/login';
    navigate(path, { replace: true });
  }

  return (
    <main className="admin-login-page">
      <div className="adm-login-card">
        <img
          src={logoImg}
          alt="Gala Printing logo"
          className="adm-login-logo"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>&#x2705;</div>
            <h1 className="adm-login-title">Password Berhasil Diubah</h1>
            <p className="adm-login-subtitle" style={{ marginBottom: 20 }}>
              Password Anda telah diperbarui. Silakan lanjut ke dashboard.
            </p>
            <button type="button" className="adm-login-btn" onClick={handleContinue}>
              LANJUT
            </button>
          </div>
        ) : (
          <>
            <h1 className="adm-login-title">Ubah Password Staff</h1>
            <p className="adm-login-subtitle">
              {user?.must_change_password
                ? 'Anda harus mengubah password sebelum melanjutkan.'
                : 'Perbarui password akun staff Anda di bawah ini.'}
            </p>

            {apiError && (
              <div className="adm-login-alert" role="alert">{apiError}</div>
            )}

            <form className="adm-login-form" onSubmit={handleSubmit} noValidate>
              <div className="adm-login-field">
                <label className="adm-login-label" htmlFor="staff-cp-current">Password Lama</label>
                <input
                  id="staff-cp-current"
                  className={`adm-login-input${fieldErrors.currentPassword ? ' error' : ''}`}
                  type="password"
                  name="currentPassword"
                  placeholder="&bull; &bull; &bull; &bull; &bull; &bull; &bull; &bull;"
                  autoComplete="current-password"
                  required
                  value={form.currentPassword}
                  onChange={handleChange}
                />
                {fieldErrors.currentPassword && (
                  <span className="adm-login-field-error">{fieldErrors.currentPassword}</span>
                )}
              </div>

              <div className="adm-login-field">
                <label className="adm-login-label" htmlFor="staff-cp-new">Password Baru</label>
                <input
                  id="staff-cp-new"
                  className={`adm-login-input${fieldErrors.newPassword ? ' error' : ''}`}
                  type="password"
                  name="newPassword"
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                  required
                  value={form.newPassword}
                  onChange={handleChange}
                />
                {fieldErrors.newPassword && (
                  <span className="adm-login-field-error">{fieldErrors.newPassword}</span>
                )}
              </div>

              <div className="adm-login-field">
                <label className="adm-login-label" htmlFor="staff-cp-confirm">Konfirmasi Password Baru</label>
                <input
                  id="staff-cp-confirm"
                  className={`adm-login-input${fieldErrors.confirmPassword ? ' error' : ''}`}
                  type="password"
                  name="confirmPassword"
                  placeholder="&bull; &bull; &bull; &bull; &bull; &bull; &bull; &bull;"
                  autoComplete="new-password"
                  required
                  value={form.confirmPassword}
                  onChange={handleChange}
                />
                {fieldErrors.confirmPassword && (
                  <span className="adm-login-field-error">{fieldErrors.confirmPassword}</span>
                )}
              </div>

              <button className="adm-login-btn" type="submit" disabled={submitting}
                style={{ marginTop: 6 }}>
                {submitting ? 'Menyimpan...' : 'UBAH PASSWORD'}
              </button>
            </form>

            <button
              type="button"
              className="adm-login-back"
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%',
                       font: 'inherit', marginTop: 20 }}
              onClick={() => navigate('/admin/login', { replace: true })}
            >
              &larr; Kembali ke Login Staff
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default StaffChangePasswordPage;
