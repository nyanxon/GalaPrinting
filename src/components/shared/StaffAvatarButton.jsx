/**
 * StaffAvatarButton.jsx
 *
 * Reusable header avatar widget for all staff dashboards.
 * Displays the current user's avatar (or a fallback SVG icon) and
 * opens ImageCropper on click so staff can update their photo.
 * After a successful upload, calls AuthContext.updateUser so the new
 * avatar_url is reflected everywhere that reads it.
 *
 * Requirements: 3.1–3.7, 9.1, 9.2
 */

import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { resolveApiUrl } from '../../core/httpClient.js';
import ImageCropper from '../profile/ImageCropper.jsx';

export default function StaffAvatarButton() {
  const { user, updateUser } = useContext(AuthContext);
  const [cropperOpen, setCropperOpen] = useState(false);

  const avatarSrc = user?.avatar_url ? resolveApiUrl(user.avatar_url) : null;

  function handleAvatarUpdated(updatedProfile) {
    updateUser(updatedProfile);
  }

  return (
    <>
      <button
        type="button"
        className="staff-header-avatar"
        onClick={() => setCropperOpen(true)}
        aria-label="Ganti foto profil"
        title="Ganti foto profil"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt="Foto profil"
            width="32"
            height="32"
            style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"
            fill="none" viewBox="0 0 24 24" stroke="#666" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
      </button>

      <ImageCropper
        isOpen={cropperOpen}
        onClose={() => setCropperOpen(false)}
        onAvatarUpdated={handleAvatarUpdated}
      />
    </>
  );
}
