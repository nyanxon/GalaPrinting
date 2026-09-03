/**
 * NotificationSettings.jsx
 *
 * Panel preferensi notifikasi email pelanggan.
 * Loads preferences on mount, renders checkboxes, and saves via profileService.
 *
 * CATATAN: Lupa password & verifikasi email TIDAK ditampilkan di sini karena
 * merupakan fitur inti yang selalu dikirimkan (tidak bisa dinonaktifkan).
 *
 * Requirements: 7.1 – 7.4
 */

import { useState, useEffect } from 'react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../../services/profileService.js';
import { showToast } from '../../core/toastEmitter.js';
import { BRAND_COLOR } from '../../config/brand.js';

// ── Field definitions ─────────────────────────────────────────────────────────
// key harus sama persis dengan kolom di tabel notification_preferences

const NOTIFICATION_FIELDS = [
  {
    key:     'order_received',
    label:   'Pesanan Diterima',
    desc:    'Email konfirmasi saat pesanan baru berhasil dibuat.',
  },
  {
    key:     'payment_accepted',
    label:   'Pembayaran Telah Diterima',
    desc:    'Notifikasi beserta invoice PDF saat pembayaran dikonfirmasi.',
  },
  {
    key:     'mockup_accepted',
    label:   'Mockup Diterima',
    desc:    'Notifikasi saat desain / mockup Anda telah disetujui.',
  },
  {
    key:     'order_shipped',
    label:   'Pesanan Akan Diantar',
    desc:    'Notifikasi saat pesanan sedang dalam pengiriman.',
  },
  {
    key:     'order_finished',
    label:   'Pesanan Selesai',
    desc:    'Notifikasi saat pesanan telah selesai.',
  },
  {
    key:     'order_cancelled',
    label:   'Pesanan Dibatalkan',
    desc:    'Notifikasi jika pesanan dibatalkan beserta alasannya.',
  },
  {
    key:     'login_new_device',
    label:   'Notifikasi Login dari Device Baru',
    desc:    'Alert keamanan saat akun Anda diakses dari perangkat baru.',
  },
  {
    key:     'login_failed_alert',
    label:   'Alert Percobaan Login Gagal',
    desc:    'Peringatan saat ada percobaan login gagal berkali-kali pada akun Anda.',
  },
];

const DEFAULT_PREFS = Object.fromEntries(NOTIFICATION_FIELDS.map(({ key }) => [key, false]));

// ── Component ─────────────────────────────────────────────────────────────────

function NotificationSettings() {
  const [prefs, setPrefs]     = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrefs() {
      setLoading(true);
      setError(null);
      try {
        const data = await getNotificationPreferences();
        if (!cancelled) {
          const mapped = {};
          for (const { key } of NOTIFICATION_FIELDS) {
            mapped[key] = Boolean(data[key]);
          }
          setPrefs(mapped);
        }
      } catch {
        if (!cancelled) setError('Gagal memuat preferensi notifikasi. Silakan coba lagi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPrefs();
    return () => { cancelled = true; };
  }, []);

  function handleChange(key) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateNotificationPreferences(prefs);
      showToast('Preferensi notifikasi berhasil disimpan.', 'success');
    } catch (err) {
      showToast(
        err?.response?.data?.message || 'Gagal menyimpan preferensi notifikasi.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--gray-light)', fontSize: '14px' }}>Memuat preferensi notifikasi…</p>;
  }

  if (error) {
    return <p style={{ color: '#c0392b', fontSize: '14px' }}>{error}</p>;
  }

  return (
    <div>
      {/* Security group header */}
      <div style={{ marginBottom: '6px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--gray-light)',
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Status Pesanan
        </p>
      </div>

      {NOTIFICATION_FIELDS.slice(0, 6).map(({ key, label, desc }) => (
        <NotifRow key={key} id={key} label={label} desc={desc}
          checked={prefs[key]} onChange={() => handleChange(key)} />
      ))}

      <div style={{ margin: '20px 0 6px', borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--gray-light)',
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Keamanan Akun
        </p>
      </div>

      {NOTIFICATION_FIELDS.slice(6).map(({ key, label, desc }) => (
        <NotifRow key={key} id={key} label={label} desc={desc}
          checked={prefs[key]} onChange={() => handleChange(key)} />
      ))}

      <p style={{ margin: '16px 0 12px', fontSize: '12px', color: 'var(--gray-light)', lineHeight: 1.5 }}>
        ℹ️ Verifikasi email dan reset password selalu dikirimkan dan tidak dapat dinonaktifkan.
      </p>

      <button
        type="button"
        style={{
          padding: '10px 28px',
          background: saving ? '#c4a882' : 'var(--brand-brown, #785E40)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '700',
          cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'filter 0.15s',
        }}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
    </div>
  );
}

// ── Row sub-component ─────────────────────────────────────────────────────────

function NotifRow({ id, label, desc, checked, onChange }) {
  const inputId = `notif-${id}`;
  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px', cursor: 'pointer' }}
      onClick={onChange}
    >
      <input
        id={inputId}
        type="checkbox"
        style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', accentColor: BRAND_COLOR, flexShrink: 0 }}
        checked={checked}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()}
      />
      <label htmlFor={inputId} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{label}</div>
        {desc && <div style={{ fontSize: '12px', color: 'var(--gray-light)', marginTop: '2px', lineHeight: 1.4 }}>{desc}</div>}
      </label>
    </div>
  );
}

export default NotificationSettings;
