/**
 * VerifyEmailPage.jsx
 *
 * Reads ?token=xxx from URL, calls the verify-email endpoint,
 * and displays success / error / loading state.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { verifyEmail, resendVerificationEmail } from '../../../services/auth.js';

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus]   = useState('loading'); // 'loading' | 'success' | 'error' | 'expired'
  const [message, setMessage] = useState('');
  const [resending, setResending]     = useState(false);
  const [resendMsg, setResendMsg]     = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token verifikasi tidak ditemukan. Pastikan Anda membuka link dari email.');
      return;
    }

    verifyEmail(token).then((res) => {
      if (res.ok) {
        setStatus('success');
        setMessage(res.message || 'Email berhasil diverifikasi!');
      } else {
        // Detect expired vs invalid
        const isExpired = res.message?.toLowerCase().includes('kedaluwarsa');
        setStatus(isExpired ? 'expired' : 'error');
        setMessage(res.message || 'Verifikasi gagal.');
      }
    });
  }, [token]);

  async function handleResend() {
    setResending(true);
    setResendMsg('');
    const res = await resendVerificationEmail();
    setResendMsg(res.message);
    setResending(false);
  }

  return (
    <main className="container content-page" style={{ maxWidth: 480, paddingTop: 48 }}>
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '40px 32px' }}>

          {status === 'loading' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
              <h1 className="section-title">Memverifikasi email…</h1>
              <p className="muted">Mohon tunggu sebentar.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h1 className="section-title" style={{ color: '#16a34a' }}>Email Terverifikasi!</h1>
              <p style={{ marginBottom: 24, color: '#374151' }}>{message}</p>
              <Link className="btn primary" to="/">Ke Beranda</Link>
            </>
          )}

          {status === 'expired' && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⌛</div>
              <h1 className="section-title" style={{ color: '#b45309' }}>Link Kedaluwarsa</h1>
              <p style={{ marginBottom: 24, color: '#374151' }}>{message}</p>
              {resendMsg ? (
                <p style={{ color: '#16a34a', fontWeight: 600 }}>{resendMsg}</p>
              ) : (
                <button
                  className="btn primary"
                  type="button"
                  disabled={resending}
                  onClick={handleResend}
                >
                  {resending ? 'Mengirim…' : 'Kirim Ulang Email Verifikasi'}
                </button>
              )}
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
              <h1 className="section-title" style={{ color: '#dc2626' }}>Verifikasi Gagal</h1>
              <p style={{ marginBottom: 24, color: '#374151' }}>{message}</p>
              <Link className="btn" to="/">Ke Beranda</Link>
            </>
          )}

        </div>
      </div>
    </main>
  );
}

export default VerifyEmailPage;
