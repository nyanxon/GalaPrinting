/**
 * ProfileForm.jsx
 *
 * Displays customer profile info (name, dob, gender, email, phone) in view mode.
 * Switches to edit mode on "Edit" button click.
 * Validates name (non-empty) and phone (8–15 digits) before saving.
 * Calls profileService.updateProfile() on save and shows a success toast.
 * Includes avatar display with ImageCropper integration.
 *
 * Props:
 *   profile         — { id, name, email, phone, dob, gender, avatar_url }
 *   onProfileUpdated(updatedProfile) — called after a successful update
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1–3.7
 */

import { useState } from 'react';
import { updateProfile } from '../../services/profileService.js';
import { resendVerificationEmail } from '../../services/authService.js';
import { showToast } from '../../core/toastEmitter.js';
import { resolveApiUrl } from '../../core/httpClient.js';
import ImageCropper from './ImageCropper.jsx';

/** Format an ISO date string (or null) as DD/MM/YYYY, or return fallback. */
function formatDob(dob) {
  if (!dob) return 'Belum diisi';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 'Belum diisi';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

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

/** Display gender code as label, or fallback. */
function formatGender(gender) {
  if (gender === 'L') return 'L';
  if (gender === 'P') return 'P';
  return 'Belum diisi';
}

function ProfileForm({ profile, onProfileUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [cropperOpen, setCropperOpen] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  const isEmailVerified = Boolean(profile?.is_email_verified);

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

  function handleAvatarUpdated(updatedProfile) {
    onProfileUpdated(updatedProfile);
  }

  // Edit form state — initialised from profile prop
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    dob: toDateInputValue(profile?.dob),
    gender: profile?.gender || '',
  });

  // Validation errors
  const [nameErr, setNameErr] = useState('');
  const [phoneErr, setPhoneErr] = useState('');

  function handleEdit() {
    // Reset form to current profile values when entering edit mode
    setFormData({
      name: profile?.name || '',
      phone: profile?.phone || '',
      dob: toDateInputValue(profile?.dob),
      gender: profile?.gender || '',
    });
    setNameErr('');
    setPhoneErr('');
    setApiError('');
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setNameErr('');
    setPhoneErr('');
    setApiError('');
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
      onProfileUpdated(updated);
      showToast('Profil berhasil diperbarui.', 'success');
      setIsEditing(false);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        'Gagal menyimpan profil. Silakan coba lagi.';
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  }

  /* ── View mode ─────────────────────────────────────────── */
  if (!isEditing) {
    return (
      <div className="pf-form">
        {/* Avatar area */}
        <div className="pf-avatar-area">
          <div
            className="pf-avatar-circle"
            onClick={() => setCropperOpen(true)}
            role="button"
            tabIndex={0}
            aria-label="Ganti foto profil"
            onKeyDown={(e) => e.key === 'Enter' && setCropperOpen(true)}
          >
            {profile?.avatar_url ? (
              <img
                src={resolveApiUrl(profile.avatar_url)}
                alt="Foto profil"
                className="pf-avatar-img"
              />
            ) : (
              <svg
                className="pf-avatar-icon"
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
            className="pf-avatar-btn"
            onClick={() => setCropperOpen(true)}
          >
            Ganti Foto
          </button>
        </div>

        <div className="pf-view-grid">
          <div className="pf-view-row">
            <span className="pf-view-label">Nama</span>
            <span className="pf-view-value">{profile?.name || 'Belum diisi'}</span>
          </div>

          <div className="pf-view-row">
            <span className="pf-view-label">Tanggal Lahir</span>
            <span className="pf-view-value">{formatDob(profile?.dob)}</span>
          </div>

          <div className="pf-view-row">
            <span className="pf-view-label">Jenis Kelamin</span>
            <span className="pf-view-value">{formatGender(profile?.gender)}</span>
          </div>

          <div className="pf-view-row">
            <span className="pf-view-label">Email</span>
            <div className="pf-email-wrap">
              <div className="pf-email-top">
                <span className="pf-view-value">{profile?.email || '—'}</span>
                <span className="pf-readonly-badge">Read-only</span>
              </div>
              {isEmailVerified ? (
                <span className="pf-verified-badge">
                  ✅ Email terverifikasi
                </span>
              ) : (
                <div className="pf-unverified-wrap">
                  <span className="pf-unverified-badge">
                    ⚠️ Email belum diverifikasi
                  </span>
                  <button
                    type="button"
                    className="pf-resend-btn"
                    onClick={handleResendVerification}
                    disabled={resendingEmail}
                  >
                    {resendingEmail ? 'Mengirim...' : 'Kirim ulang verifikasi'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pf-view-row">
            <span className="pf-view-label">Nomor Handphone</span>
            <span className="pf-view-value">{profile?.phone || 'Belum diisi'}</span>
          </div>
        </div>

        <button
          type="button"
          className="pf-edit-btn"
          onClick={handleEdit}
        >
          Edit
        </button>

        <ImageCropper
          isOpen={cropperOpen}
          onClose={() => setCropperOpen(false)}
          onAvatarUpdated={handleAvatarUpdated}
        />
      </div>
    );
  }

  /* ── Edit mode ─────────────────────────────────────────── */
  return (
    <form className="pf-form" onSubmit={handleSave} noValidate>
      {/* Avatar area */}
      <div className="pf-avatar-area">
        <div
          className="pf-avatar-circle"
          onClick={() => setCropperOpen(true)}
          role="button"
          tabIndex={0}
          aria-label="Ganti foto profil"
          onKeyDown={(e) => e.key === 'Enter' && setCropperOpen(true)}
        >
          {profile?.avatar_url ? (
            <img
              src={resolveApiUrl(profile.avatar_url)}
              alt="Foto profil"
              className="pf-avatar-img"
            />
          ) : (
            <svg
              className="pf-avatar-icon"
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
          className="pf-avatar-btn"
          onClick={() => setCropperOpen(true)}
        >
          Ganti Foto
        </button>
      </div>

      {/* Name */}
      <div className="co-field">
        <label className="co-label" htmlFor="pf-name">Nama *</label>
        <input
          className={`co-input${nameErr ? ' co-input--error' : ''}`}
          id="pf-name"
          name="name"
          type="text"
          autoComplete="name"
          value={formData.name}
          onChange={handleChange}
          disabled={saving}
        />
        {nameErr && (
          <span className="co-hint co-hint--err">{nameErr}</span>
        )}
      </div>

      {/* Date of Birth */}
      <div className="co-field">
        <label className="co-label" htmlFor="pf-dob">Tanggal Lahir</label>
        <input
          className="co-input"
          id="pf-dob"
          name="dob"
          type="date"
          value={formData.dob}
          onChange={handleChange}
          disabled={saving}
        />
      </div>

      {/* Gender */}
      <div className="co-field">
        <label className="co-label" htmlFor="pf-gender">Jenis Kelamin</label>
        <select
          className="co-input"
          id="pf-gender"
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

      {/* Email — always read-only */}
      <div className="co-field">
        <label className="co-label" htmlFor="pf-email">
          Email
          <span className="pf-readonly-badge pf-readonly-badge--inline">Read-only</span>
        </label>
        <input
          className="co-input pf-input--readonly"
          id="pf-email"
          name="email"
          type="email"
          value={profile?.email || ''}
          readOnly
          disabled
          aria-readonly="true"
        />
        {/* Status verifikasi di edit mode */}
        <span className={isEmailVerified ? 'pf-verified-badge pf-verified-badge--small' : 'pf-unverified-badge pf-unverified-badge--small'}>
          {isEmailVerified ? '✅ Terverifikasi' : '⚠️ Belum diverifikasi'}
        </span>
      </div>

      {/* Phone */}
      <div className="co-field">
        <label className="co-label" htmlFor="pf-phone">Nomor Handphone</label>
        <input
          className={`co-input${phoneErr ? ' co-input--error' : ''}`}
          id="pf-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="08xxxxxxxxxx"
          value={formData.phone}
          onChange={handleChange}
          disabled={saving}
        />
        {phoneErr && (
          <span className="co-hint co-hint--err">{phoneErr}</span>
        )}
      </div>

      {/* API error */}
      {apiError && (
        <div className="co-form-alert" role="alert">{apiError}</div>
      )}

      {/* Actions */}
      <div className="pf-actions">
        <button
          type="submit"
          className="pf-save-btn"
          disabled={saving}
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
        <button
          type="button"
          className="pf-cancel-btn"
          onClick={handleCancel}
          disabled={saving}
        >
          Batal
        </button>
      </div>

      <ImageCropper
        isOpen={cropperOpen}
        onClose={() => setCropperOpen(false)}
        onAvatarUpdated={handleAvatarUpdated}
      />
    </form>
  );
}

export default ProfileForm;
