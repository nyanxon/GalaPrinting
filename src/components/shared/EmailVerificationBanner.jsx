/**
 * EmailVerificationBanner.jsx
 *
 * Soft-warning banner shown to logged-in users whose email is not yet verified.
 * Shown below the navbar via PublicLayout.
 * Never blocks usage — just reminds and offers a resend button.
 */

import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { resendVerificationEmail } from '../../services/authService.js';

function EmailVerificationBanner() {
  const { user } = useContext(AuthContext);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [errMsg, setErrMsg]       = useState('');

  // Only show for logged-in customers whose email is not verified
  if (!user || user.is_email_verified || dismissed) return null;
  // Staff accounts skip verification requirement
  if (user.role !== 'customer') return null;

  async function handleResend() {
    setSending(true);
    setErrMsg('');
    const res = await resendVerificationEmail();
    setSending(false);
    if (res.ok) {
      setSent(true);
    } else {
      setErrMsg(res.message);
    }
  }

  return (
    <div
      role="alert"
      className="email-verify-banner"
      aria-label="Email belum diverifikasi"
    >
      <span className="email-verify-banner__icon" aria-hidden="true">✉️</span>

      {sent ? (
        <span className="email-verify-banner__text">
          Email verifikasi telah dikirim ke <strong>{user.email}</strong>. Cek inbox Anda.
        </span>
      ) : (
        <>
          <span className="email-verify-banner__text">
            Email Anda belum diverifikasi.{' '}
            {errMsg ? (
              <span className="email-verify-banner__err">{errMsg}</span>
            ) : (
              <button
                type="button"
                className="email-verify-banner__btn"
                disabled={sending}
                onClick={handleResend}
              >
                {sending ? 'Mengirim…' : 'Kirim ulang email verifikasi'}
              </button>
            )}
          </span>
        </>
      )}

      <button
        type="button"
        className="email-verify-banner__close"
        aria-label="Tutup peringatan"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  );
}

export default EmailVerificationBanner;
