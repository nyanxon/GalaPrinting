/**
 * StaffProfileModal.jsx
 *
 * Full-screen profile edit popup for admin/staff dashboard header.
 * Lets staff edit their name, phone, dob, gender and upload a new avatar
 * without leaving the dashboard. Email is shown read-only with its
 * verification status and a resend action when unverified.
 *
 * Uses the shared dashboard modal shell (.adm-modal) and form system
 * (.adm-form / .adm-field / .adm-input / .adm-btn) so the UI matches every
 * other admin modal. Renders through ReactDOM.createPortal into document.body
 * to escape the dashboard's overflow:hidden / height:100vh layout.
 *
 * Usage:
 *   <StaffProfileModal isOpen={open} onClose={() => setOpen(false)} />
 *
 * Requirements: 3.1–3.7
 */

import { useState, useEffect, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { AuthContext } from '../context/AuthContext.jsx';
import { getProfile, updateProfile } from '../../services/profileService.js';
import { resendVerificationEmail } from '../../services/auth.js';
import { showToast } from '../../core/toastEmitter.js';
import { resolveApiUrl } from '../../core/httpClient.js';
import ImageCropper from '../profile/ImageCropper.jsx';

/** Convert an ISO date string to YYYY-MM-DD for <input type="date"> value. */
function toDateInputValue(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export default function StaffProfileModal({ isOpen, onClose }) {
  const { user, updateUser } = useContext(AuthContext);
  const overlayRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [cropperOpen, setCropperOpen] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({ name: '', phone: '', dob: '', gender: '' });
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [nameErr, setNameErr] = useState('');
  const [phoneErr, setPhoneErr] = useState('');

  const isEmailVerified = Boolean(profile?.is_email_verified);

  // Load fresh profile data whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoadError('');
    setLoading(true);
    getProfile()
      .then((p) => {
        setProfile(p);
        setFormData({
          name: p?.name || '',
          phone: p?.phone || '',
          dob: toDateInputValue(p?.dob),
          gender: p?.gender || '',
        });
      })
      .catch(() => setLoadError('Gagal memuat profil. Silakan coba lagi.'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Prevent body scroll + close on Escape while modal is open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  function handleBackdropClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleProfileUpdated(updated) {
    setProfile(updated);
    // Sync name + avatar into AuthContext so the header reflects changes immediately
    updateUser({ ...user, ...updated });
  }

  function handleAvatarUpdated(updatedProfile) {
    handleProfileUpdated(updatedProfile);
  }

  async function handleResendVerification() {
    setResendingEmail(true);
    try {
      const res = await resendVerificationEmail();
      if (res.ok) {
        showToast('Email verifikasi telah dikirim. Cek inbox Anda.', 'success');
      } else {
        showToast(res.message || 'Gagal mengirim email verifikasi.', 'error');
      }
    } catch {
      showToast('Gagal mengirim email verifikasi.', 'error');
    } finally {
      setResendingEmail(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'name') setNameErr('');
    if (name === 'phone') setPhoneErr('');
  }

  function validate() {
    let ok = true;
    if (!formData.name.trim()) {
      setNameErr('Nama wajib diisi.');
      ok = false;
    }
    if (formData.phone.trim() && !/^[0-9]{8,15}$/.test(formData.phone.trim())) {
      setPhoneErr('Nomor handphone tidak valid.');
      ok = false;
    }
    return ok;
  }

  async function handleSave(e) {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        dob: formData.dob || null,
        gender: formData.gender || null,
      };
      const updated = await updateProfile(payload);
      handleProfileUpdated(updated);
      showToast('Profil berhasil diperbarui.', 'success');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        'Gagal menyimpan profil. Silakan coba lagi.';
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const avatarSrc = profile?.avatar_url ? resolveApiUrl(profile.avatar_url) : null;

  return createPortal(
    <div
      className="adm-modal-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spm-modal-title"
      onClick={handleBackdropClick}
    >
      <div className="adm-modal" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className="adm-modal-header">
          <h2 className="adm-modal-title" id="spm-modal-title">
            Edit Profil
          </h2>
          <button
            className="adm-modal-close"
            type="button"
            aria-label="Tutup"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="adm-modal-body">
          {loading && <p>Memuat profil…</p>}
          {loadError && !loading && <p>{loadError}</p>}

          {!loading && !loadError && profile && (
            <>
              {/* Avatar area */}
              <div className="spm-avatar-area">
                <div
                  className="spm-avatar-circle"
                  role="button"
                  tabIndex={0}
                  aria-label="Ganti foto profil"
                  onClick={() => setCropperOpen(true)}
                  onKeyDown={(e) => e.key === 'Enter' && setCropperOpen(true)}
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt="Foto profil"
                      className="spm-avatar-img"
                    />
                  ) : (
                    <svg
                      className="spm-avatar-icon"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                    </svg>
                  )}
                </div>
                <button
                  type="button"
                  className="spm-avatar-btn"
                  onClick={() => setCropperOpen(true)}
                >
                  Ganti Foto
                </button>
              </div>

              {/* Summary row (name + verification) */}
              <div className="spm-summary">
                <div className="spm-summary-name">{profile.name || '—'}</div>
                <div className="spm-summary-email">{profile.email || '—'}</div>
              </div>

              <form className="adm-form" onSubmit={handleSave} noValidate>
                {/* Name */}
                <div className="adm-field">
                  <label className="adm-label" htmlFor="spm-name">Nama *</label>
                  <input
                    className={`adm-input${nameErr ? ' adm-input--error' : ''}`}
                    id="spm-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={saving}
                  />
                  {nameErr && (
                    <span className="offline-field-error">{nameErr}</span>
                  )}
                </div>

                {/* Phone */}
                <div className="adm-field">
                  <label className="adm-label" htmlFor="spm-phone">
                    Nomor Handphone
                  </label>
                  <input
                    className={`adm-input${phoneErr ? ' adm-input--error' : ''}`}
                    id="spm-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="08xxxxxxxxxx"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={saving}
                  />
                  {phoneErr && (
                    <span className="offline-field-error">{phoneErr}</span>
                  )}
                </div>

                {/* Date of birth + gender side-by-side */}
                <div className="spm-row">
                  <div className="adm-field spm-row-field">
                    <label className="adm-label" htmlFor="spm-dob">
                      Tanggal Lahir
                    </label>
                    <input
                      className="adm-input"
                      id="spm-dob"
                      name="dob"
                      type="date"
                      value={formData.dob}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                  <div className="adm-field spm-row-field">
                    <label className="adm-label" htmlFor="spm-gender">
                      Jenis Kelamin
                    </label>
                    <select
                      className="adm-input"
                      id="spm-gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      disabled={saving}
                    >
                      <option value="">— Pilih —</option>
                      <option value="L">L</option>
                      <option value="P">P</option>
                    </select>
                  </div>
                </div>

                {/* Email — always read-only */}
                <div className="adm-field">
                  <label className="adm-label" htmlFor="spm-email">
                    Email
                    <span className="adm-hint" style={{ marginLeft: '6px' }}>
                      (tidak dapat diubah)
                    </span>
                  </label>
                  <input
                    className="adm-input spm-input--readonly"
                    id="spm-email"
                    name="email"
                    type="email"
                    value={profile?.email || ''}
                    readOnly
                    disabled
                    aria-readonly="true"
                  />
                  <div className="spm-verify-row">
                    <span
                      className={`spm-badge${isEmailVerified ? ' spm-badge--ok' : ' spm-badge--warn'}`}
                    >
                      {isEmailVerified
                        ? '✓ Email terverifikasi'
                        : '⚠ Email belum diverifikasi'}
                    </span>
                    {!isEmailVerified && (
                      <button
                        type="button"
                        className="spm-resend-btn"
                        onClick={handleResendVerification}
                        disabled={resendingEmail}
                      >
                        {resendingEmail ? 'Mengirim…' : 'Kirim ulang verifikasi'}
                      </button>
                    )}
                  </div>
                </div>

                {/* API error */}
                {apiError && (
                  <div className="adm-form-alert" role="alert">{apiError}</div>
                )}

                {/* Actions */}
                <div className="adm-form-actions">
                  <button
                    type="submit"
                    className="adm-btn adm-btn--primary"
                    disabled={saving}
                  >
                    {saving ? 'Menyimpan…' : 'Simpan'}
                  </button>
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={onClose}
                    disabled={saving}
                  >
                    Batal
                  </button>
                </div>
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <Link to="/change-password" className="adm-link" onClick={onClose}>
                    Ubah Password
                  </Link>
                </div>
              </form>

              <ImageCropper
                isOpen={cropperOpen}
                onClose={() => setCropperOpen(false)}
                onAvatarUpdated={handleAvatarUpdated}
              />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
