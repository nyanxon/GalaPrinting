/**
 * StaffForgotPasswordPage.jsx
 *
 * Staff-only "forgot password" page at /admin/forgot-password.
 * Matches the /admin/login theme (brown gradient background + centered card).
 * Always shows a generic success message to prevent user enumeration.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { useNavigate } from 'react-router';
import { staffForgotPassword } from '../../../services/auth.js';
import logoImg from '../../../assets/logo.png';
import '../../../styles/css/pages/admin-login.css';

function StaffForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [message, setMessage]       = useState('');
  const [error, setError]           = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Masukkan alamat email Anda.');
      return;
    }
    setSubmitting(true);
    const res = await staffForgotPassword(email.trim());
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
      setMessage(res.message);
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

        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>&#x1F4E7;</div>
            <h1 className="adm-login-title">Cek Email Anda</h1>
            <p className="adm-login-subtitle" style={{ marginBottom: 20 }}>
              {message}
            </p>
            <p style={{ fontSize: 13, color: '#8a7662', marginBottom: 20 }}>
              Tidak menerima email? Cek folder spam, atau{' '}
              <button
                type="button"
                onClick={() => { setSubmitted(false); setMessage(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                         fontSize: 13, color: 'var(--brand-brown, #785E40)', fontWeight: 700 }}
              >
                coba lagi
              </button>
              .
            </p>
            <button
              type="button"
              className="adm-login-btn"
              onClick={() => navigate('/admin/login', { replace: true })}
            >
              KEMBALI KE LOGIN
            </button>
          </div>
        ) : (
          <>
            <h1 className="adm-login-title">Lupa Password Staff</h1>
            <p className="adm-login-subtitle">
              Masukkan email staff terdaftar. Kami akan mengirimkan link untuk membuat password baru.
            </p>

            {error && (
              <div className="adm-login-alert" role="alert">{error}</div>
            )}

            <form className="adm-login-form" onSubmit={handleSubmit} noValidate>
              <div className="adm-login-field">
                <label className="adm-login-label" htmlFor="staff-forgot-email">Email</label>
                <input
                  id="staff-forgot-email"
                  className="adm-login-input"
                  type="email"
                  placeholder="nama@email.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button className="adm-login-btn" type="submit" disabled={submitting}
                style={{ marginTop: 6 }}>
                {submitting ? 'Mengirim...' : 'KIRIM LINK RESET'}
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

export default StaffForgotPasswordPage;
