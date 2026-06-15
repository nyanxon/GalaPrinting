/**
 * StaffProfileModal.jsx
 *
 * Full-screen profile edit popup for admin/staff dashboard header.
 * Wraps ProfileForm in a centred modal overlay so staff can edit their
 * name, phone, dob, gender and upload a new avatar without leaving the dashboard.
 *
 * Uses ReactDOM.createPortal to render into document.body — this escapes the
 * dashboard's overflow:hidden / height:100vh layout so the overlay truly covers
 * the full viewport and the panel stays perfectly centred.
 *
 * Usage:
 *   <StaffProfileModal isOpen={open} onClose={() => setOpen(false)} />
 */

import { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { getProfile } from '../../services/profileService.js';
import ProfileForm from '../profile/ProfileForm.jsx';

export default function StaffProfileModal({ isOpen, onClose }) {
  const { user, updateUser } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Load fresh profile data whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setLoading(true);
    getProfile()
      .then((p) => setProfile(p))
      .catch(() => setError('Gagal memuat profil. Silakan coba lagi.'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  function handleProfileUpdated(updated) {
    setProfile(updated);
    // Sync name + avatar into AuthContext so the header reflects changes immediately
    updateUser({ ...user, ...updated });
  }

  if (!isOpen) return null;

  return createPortal(
    /* Backdrop — rendered directly into document.body */
    <div
      className="spm-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit Profil"
    >
      {/* Modal panel */}
      <div
        className="spm-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="spm-header">
          <h2 className="spm-title">Edit Profil</h2>
          <button
            type="button"
            className="spm-close"
            aria-label="Tutup"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="spm-body">
          {loading && (
            <p className="spm-loading">Memuat profil…</p>
          )}
          {error && (
            <p className="spm-error">{error}</p>
          )}
          {!loading && !error && profile && (
            <ProfileForm
              profile={profile}
              onProfileUpdated={handleProfileUpdated}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
