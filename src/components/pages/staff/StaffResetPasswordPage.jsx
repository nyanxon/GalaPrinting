/**
 * StaffResetPasswordPage.jsx
 *
 * Staff-only "reset password" page at /admin/reset-password.
 * Reads ?token=xxx from the URL and sets a new password.
 * Matches the /admin/login theme (brown gradient background + centered card).
 *
 * Uses the dedicated POST /api/auth/staff/reset-password endpoint, so the
 * token is always looked up in users_admin (never users_customer).
 */

import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router';
import { staffResetPassword } from '../../../services/auth.js';
import logoImg from '../../../assets/logo.png';
import '../../../styles/css/pages/admin-login.css';

function StaffResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get('token');

  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError]           = useState('');

  if (!token) {
    return (
      <main className="admin-login-page">
        <div className="adm-login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>&#x274C;</div>
          <h1 className="adm-login-title">Link Tidak Valid</h1>
          <p className="adm-login-subtitle">
            Link reset password tidak valid. Silakan minta ulang dari halaman lupa password staff.
          </p>
          <Link className="adm-login-btn" to="/admin/forgot-password"
            style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
            Lupa Password Staff
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setSubmitting(true);
    const res = await staffResetPassword(token, password);
    setSubmitting(false);

    if (res.ok) {
      setSuccess(true);
      setSuccessMsg(res.message);
      setTimeout(() => navigate('/admin/login', { replace: true }), 3000);
    } else {
      setError(res.message);
    }
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
            <h1 className="adm-login-title">Password Berhasil Direset</h1>
            <p className="adm-login-subtitle" style={{ marginBottom: 8 }}>{successMsg}</p>
            <p style={{ fontSize: 13, color: '#8a7662', marginBottom: 20 }}>
              Anda akan diarahkan ke halaman login staff dalam beberapa detik&hellip;
            </p>
            <button
              type="button"
              className="adm-login-btn"
              onClick={() => navigate('/admin/login', { replace: true })}
            >
              LOGIN SEKARANG
            </button>
          </div>
        ) : (
          <>
            <h1 className="adm-login-title">Buat Password Baru</h1>
            <p className="adm-login-subtitle">
              Masukkan password baru Anda. Minimal 6 karakter.
            </p>

            {error && (
              <div className="adm-login-alert" role="alert">{error}</div>
            )}

            <form className="adm-login-form" onSubmit={handleSubmit} noValidate>
              <div className="adm-login-field">
                <label className="adm-login-label" htmlFor="staff-reset-password">Password Baru</label>
                <input
                  id="staff-reset-password"
                  className="adm-login-input"
                  type="password"
                  placeholder="&bull; &bull; &bull; &bull; &bull; &bull; &bull; &bull;"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="adm-login-field">
                <label className="adm-login-label" htmlFor="staff-reset-confirm">Konfirmasi Password Baru</label>
                <input
                  id="staff-reset-confirm"
                  className="adm-login-input"
                  type="password"
                  placeholder="&bull; &bull; &bull; &bull; &bull; &bull; &bull; &bull;"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              <button className="adm-login-btn" type="submit" disabled={submitting}
                style={{ marginTop: 6 }}>
                {submitting ? 'Menyimpan...' : 'SIMPAN PASSWORD BARU'}
              </button>
            </form>

            <Link to="/admin/login" className="adm-login-back">
              &larr; Kembali ke Login Staff
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default StaffResetPasswordPage;
