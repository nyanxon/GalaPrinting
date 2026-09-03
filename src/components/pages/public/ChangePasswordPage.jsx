/**
 * ChangePasswordPage.jsx
 *
 * Standalone page for changing password while logged in.
 * Used in two scenarios:
 *   1. Forced — after admin login with must_change_password=true
 *   2. Voluntary — from profile settings or staff sidebar
 *
 * After success, redirects to the user's dashboard (staff) or profile (customer).
 */

import { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext.jsx';
import { changePassword } from '../../../services/auth.js';
import { STAFF_ROLES } from '../../../config/roles.js';
import { STAFF_ROLE_DASHBOARD_PATH } from '../../../config/roles.js';
import { track } from '../../../utils/activityTracker.js';
import '../../../styles/css/pages/register.css';

function ChangePasswordPage() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [form, setForm]           = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors]       = useState({});
  const [apiError, setApiError]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]     = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
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
    setErrors(errs);
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
          metadata: { forced: Boolean(user?.must_change_password) },
        });
        setSuccess(true);
        // Refresh user data to clear must_change_password
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
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    if (STAFF_ROLES.includes(user.role)) {
      navigate(STAFF_ROLE_DASHBOARD_PATH[user.role] || '/admin/superadmin', { replace: true });
    } else {
      navigate('/profile', { replace: true });
    }
  }

  if (success) {
    return (
      <main className="register-layout">
        <div className="register-form-side" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '40px 32px', maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#x2705;</div>
            <h1 className="register-title">Password Berhasil Diubah</h1>
            <p style={{ color: '#374151', marginBottom: 24, lineHeight: 1.6 }}>
              Password Anda telah diperbarui. Silakan lanjut ke dashboard.
            </p>
            <button className="btn register-submit-btn" onClick={handleContinue}>
              LANJUT
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="register-layout">
      <div className="register-form-side">
        <h1 className="register-title">Ubah Password</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 }}>
          {user && STAFF_ROLES.includes(user.role)
            ? 'Anda harus mengubah password sebelum melanjutkan.'
            : 'Perbarui password akun Anda di bawah ini.'}
        </p>

        {apiError && (
          <div className="alert muted" role="alert">{apiError}</div>
        )}

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <div className="register-field">
            <input
              className={`register-input${errors.currentPassword ? ' error' : ''}`}
              type="password"
              name="currentPassword"
              placeholder="Password Lama"
              autoComplete="current-password"
              required
              aria-label="Password Lama"
              value={form.currentPassword}
              onChange={handleChange}
            />
            {errors.currentPassword && (
              <span className="register-field-error">{errors.currentPassword}</span>
            )}
          </div>

          <div className="register-field">
            <input
              className={`register-input${errors.newPassword ? ' error' : ''}`}
              type="password"
              name="newPassword"
              placeholder="Password Baru (min. 6 karakter)"
              autoComplete="new-password"
              required
              aria-label="Password Baru"
              value={form.newPassword}
              onChange={handleChange}
            />
            {errors.newPassword && (
              <span className="register-field-error">{errors.newPassword}</span>
            )}
          </div>

          <div className="register-field">
            <input
              className={`register-input${errors.confirmPassword ? ' error' : ''}`}
              type="password"
              name="confirmPassword"
              placeholder="Konfirmasi Password Baru"
              autoComplete="new-password"
              required
              aria-label="Konfirmasi Password Baru"
              value={form.confirmPassword}
              onChange={handleChange}
            />
            {errors.confirmPassword && (
              <span className="register-field-error">{errors.confirmPassword}</span>
            )}
          </div>

          <button className="btn register-submit-btn" type="submit" disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'UBAH PASSWORD'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default ChangePasswordPage;
