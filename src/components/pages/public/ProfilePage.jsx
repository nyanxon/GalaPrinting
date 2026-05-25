/**
 * ProfilePage.jsx
 *
 * Route-guarded profile page for customers.
 * Sidebar navigation: Profile, Pesanan Saya, Daftar Alamat, Notifikasi.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 3.7, 4.2
 */

import { useState, useEffect, useContext } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import ProfileForm from '../../profile/ProfileForm.jsx';
import AddressList from '../../profile/AddressList.jsx';
import NotificationSettings from '../../profile/NotificationSettings.jsx';
import * as profileService from '../../../services/profileService.js';
import '../../../styles/css/pages/profile.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const TABS = [
  { id: 'profile',       label: 'Profil',         icon: '👤' },
  { id: 'orders',        label: 'Pesanan Saya',    icon: '📦' },
  { id: 'addresses',     label: 'Daftar Alamat',   icon: '📍' },
  { id: 'notifications', label: 'Notifikasi',      icon: '🔔' },
];

function ProfilePage() {
  const { user, loading, updateUser } = useContext(AuthContext);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'profile');

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const isCustomer = !loading && user?.role === 'customer';

  useEffect(() => {
    if (!isCustomer) return;

    let cancelled = false;
    setProfileLoading(true);
    setProfileError('');

    profileService
      .getProfile()
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch(() => { if (!cancelled) setProfileError('Gagal memuat profil. Silakan coba lagi.'); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });

    return () => { cancelled = true; };
  }, [isCustomer]);

  if (loading) {
    return <main><div className="pf-loading">Memuat...</div></main>;
  }

  if (!user || user.role !== 'customer') {
    return <Navigate to="/register" replace />;
  }

  function handleProfileUpdated(updatedProfile) {
    setProfile(updatedProfile);
    updateUser(updatedProfile);
  }

  const avatarSrc = profile?.avatar_url
    ? `${API_BASE}${profile.avatar_url}`
    : (user?.avatar_url ? `${API_BASE}${user.avatar_url}` : null);

  return (
    <main>
      <div className="pf-layout">

        {/* ── Sidebar ── */}
        <aside className="pf-sidebar">
          {/* User summary */}
          <div className="pf-sidebar-user">
            <div className="pf-sidebar-avatar">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Foto profil" className="pf-sidebar-avatar-img" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="pf-sidebar-avatar-icon" aria-hidden="true">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              )}
            </div>
            <div className="pf-sidebar-name">{user.name}</div>
            <div className="pf-sidebar-email">{user.email}</div>
          </div>

          {/* Nav tabs */}
          <nav className="pf-sidebar-nav" aria-label="Menu profil">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`pf-sidebar-item${activeTab === tab.id ? ' pf-sidebar-item--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <span className="pf-sidebar-item-icon">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="pf-content">

          {/* Profile tab */}
          {activeTab === 'profile' && (
            <section className="pf-section">
              <h2 className="pf-section-title">Biodata Diri</h2>
              {profileLoading && <p className="pf-loading-inline">Memuat data profil...</p>}
              {profileError && !profileLoading && <p className="pf-error">{profileError}</p>}
              {!profileLoading && !profileError && profile && (
                <ProfileForm profile={profile} onProfileUpdated={handleProfileUpdated} />
              )}
            </section>
          )}

          {/* Orders tab */}
          {activeTab === 'orders' && (
            <section className="pf-section">
              <h2 className="pf-section-title">Pesanan Saya</h2>
              <div className="pf-orders-redirect">
                <p>Lihat semua pesanan Anda di halaman Pesanan Saya.</p>
                <Link to="/my-orders" className="pf-orders-btn">
                  Lihat Pesanan Saya →
                </Link>
              </div>
            </section>
          )}

          {/* Addresses tab */}
          {activeTab === 'addresses' && (
            <section className="pf-section">
              <h2 className="pf-section-title">Daftar Alamat</h2>
              <AddressList />
            </section>
          )}

          {/* Notifications tab */}
          {activeTab === 'notifications' && (
            <section className="pf-section">
              <h2 className="pf-section-title">Preferensi Notifikasi</h2>
              <NotificationSettings />
            </section>
          )}

        </div>
      </div>
    </main>
  );
}

export default ProfilePage;
