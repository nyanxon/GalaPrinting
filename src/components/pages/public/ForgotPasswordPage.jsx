/**
 * ForgotPasswordPage.jsx
 *
 * Form to request a password reset email.
 * Always shows a generic success message to prevent user enumeration.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { forgotPassword } from '../../../services/auth.js';

function ForgotPasswordPage() {
  const [email, setEmail]         = useState('');
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
    const res = await forgotPassword(email.trim());
    setSubmitting(false);
    if (res.ok) {
      setSubmitted(true);
      setMessage(res.message);
    } else {
      setError(res.message);
    }
  }

  return (
    <main className="container content-page" style={{ maxWidth: 480, paddingTop: 48 }}>
      <div className="card">
        <div className="card-body" style={{ padding: '40px 32px' }}>

          {submitted ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <h1 className="section-title">Cek Email Anda</h1>
              <p style={{ color: '#374151', marginBottom: 24, lineHeight: 1.6 }}>
                {message}
              </p>
              <p className="muted" style={{ fontSize: 13 }}>
                Tidak menerima email? Cek folder spam, atau{' '}
                <button
                  type="button"
                  className="register-link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'var(--brand-brown)' }}
                  onClick={() => { setSubmitted(false); setMessage(''); }}
                >
                  coba lagi
                </button>
                .
              </p>
              <Link className="btn" to="/register" style={{ marginTop: 16 }}>Kembali ke Login</Link>
            </div>
          ) : (
            <>
              <h1 className="section-title" style={{ marginBottom: 8 }}>Lupa Password?</h1>
              <p className="muted" style={{ marginBottom: 24 }}>
                Masukkan alamat email yang terdaftar. Kami akan mengirimkan link untuk membuat password baru.
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
                <div className="register-field" style={{ marginBottom: 16 }}>
                  <input
                    className="register-input"
                    type="email"
                    placeholder="Alamat email Anda"
                    autoComplete="email"
                    required
                    aria-label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button className="btn primary" type="submit"
                  disabled={submitting}
                  style={{ width: '100%', padding: '13px' }}>
                  {submitting ? 'Mengirim…' : 'Kirim Link Reset Password'}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}>
                Ingat password?{' '}
                <Link to="/register" className="register-link">Kembali ke Login</Link>
              </p>
            </>
          )}

        </div>
      </div>
    </main>
  );
}

export default ForgotPasswordPage;
