/**
 * ResetPasswordPage.jsx
 *
 * Form to set a new password using token from URL ?token=xxx.
 */

import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { resetPassword } from '../../../services/auth.js';

function ResetPasswordPage() {
  const [searchParams]     = useSearchParams();
  const navigate           = useNavigate();
  const token              = searchParams.get('token');

  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [success, setSuccess]           = useState(false);
  const [successMsg, setSuccessMsg]     = useState('');
  const [error, setError]               = useState('');

  if (!token) {
    return (
      <main className="container content-page" style={{ maxWidth: 480, paddingTop: 48 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h1 className="section-title">Link Tidak Valid</h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              Link reset password tidak valid. Silakan minta ulang dari halaman lupa password.
            </p>
            <Link className="btn primary" to="/forgot-password">Lupa Password</Link>
          </div>
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
    const res = await resetPassword(token, password);
    setSubmitting(false);

    if (res.ok) {
      setSuccess(true);
      setSuccessMsg(res.message);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/register', { replace: true }), 3000);
    } else {
      setError(res.message);
    }
  }

  return (
    <main className="container content-page" style={{ maxWidth: 480, paddingTop: 48 }}>
      <div className="card">
        <div className="card-body" style={{ padding: '40px 32px' }}>

          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h1 className="section-title" style={{ color: '#16a34a' }}>Password Berhasil Direset</h1>
              <p style={{ color: '#374151', marginBottom: 8, lineHeight: 1.6 }}>{successMsg}</p>
              <p className="muted" style={{ fontSize: 13, marginBottom: 24 }}>
                Anda akan diarahkan ke halaman login dalam beberapa detik…
              </p>
              <Link className="btn primary" to="/register">Login Sekarang</Link>
            </div>
          ) : (
            <>
              <h1 className="section-title" style={{ marginBottom: 8 }}>Buat Password Baru</h1>
              <p className="muted" style={{ marginBottom: 24 }}>
                Masukkan password baru Anda. Minimal 6 karakter.
              </p>

              {error && (
                <div className="alert" role="alert"
                  style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.3)',
                           borderRadius: 6, padding: '10px 14px', color: '#b91c1c',
                           fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="register-field" style={{ marginBottom: 12 }}>
                  <input
                    className="register-input"
                    type="password"
                    placeholder="Password baru"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    aria-label="Password baru"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <span className="register-field-hint">Minimal 6 karakter</span>
                </div>
                <div className="register-field" style={{ marginBottom: 24 }}>
                  <input
                    className="register-input"
                    type="password"
                    placeholder="Konfirmasi password baru"
                    autoComplete="new-password"
                    required
                    aria-label="Konfirmasi password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <button className="btn primary" type="submit"
                  disabled={submitting}
                  style={{ width: '100%', padding: '13px' }}>
                  {submitting ? 'Menyimpan…' : 'Simpan Password Baru'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </main>
  );
}

export default ResetPasswordPage;
