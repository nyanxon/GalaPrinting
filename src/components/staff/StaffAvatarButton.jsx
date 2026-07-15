/**
 * StaffAvatarButton.jsx
 *
 * Header avatar widget for all staff dashboards.
 * Displays the current user's avatar (or a fallback SVG icon).
 * Clicking it opens StaffProfileModal — a full edit popup with
 * name / phone / dob / gender fields + avatar upload/crop.
 *
 * Requirements: 3.1–3.7, 9.1, 9.2
 */

import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { resolveApiUrl } from '../../core/httpClient.js';
import StaffProfileModal from '../modals/StaffProfileModal.jsx';

export default function StaffAvatarButton() {
  const { user } = useContext(AuthContext);
  const [modalOpen, setModalOpen] = useState(false);

  const avatarSrc = user?.avatar_url ? resolveApiUrl(user.avatar_url) : null;

  return (
    <>
      <button
        type="button"
        className="staff-header-avatar staff-header-avatar--btn"
        onClick={() => setModalOpen(true)}
        aria-label="Edit profil"
        title="Edit profil"
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt="Foto profil"
            className="staff-header-avatar-img"
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#666"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
      </button>

      <StaffProfileModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
