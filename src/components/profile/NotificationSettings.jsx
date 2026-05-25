/**
 * NotificationSettings.jsx
 *
 * Panel preferensi notifikasi email pelanggan.
 * Loads preferences on mount, renders five checkboxes, and saves via profileService.
 *
 * Requirements: 7.1 – 7.4
 */

import { useState, useEffect } from 'react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../../services/profileService.js';
import { showToast } from '../../core/toastEmitter.js';

const NOTIFICATION_FIELDS = [
  { key: 'payment_accepted', label: 'Pembayaran Diterima' },
  { key: 'order_shipped',    label: 'Pesanan Dikirim' },
  { key: 'order_finished',   label: 'Pesanan Selesai' },
  { key: 'order_cancelled',  label: 'Pesanan Dibatalkan' },
  { key: 'promo_news',       label: 'Berita Promo Gala Printing' },
];

const DEFAULT_PREFS = {
  payment_accepted: false,
  order_shipped:    false,
  order_finished:   false,
  order_cancelled:  false,
  promo_news:       false,
};

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
          setPrefs({
            payment_accepted: Boolean(data.payment_accepted),
            order_shipped:    Boolean(data.order_shipped),
            order_finished:   Boolean(data.order_finished),
            order_cancelled:  Boolean(data.order_cancelled),
            promo_news:       Boolean(data.promo_news),
          });
        }
      } catch {
        if (!cancelled) {
          setError('Gagal memuat preferensi notifikasi. Silakan coba lagi.');
        }
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
      showToast('Preferensi notifikasi berhasil disimpan.');
    } catch (err) {
      showToast(
        err?.response?.data?.message || 'Gagal menyimpan preferensi notifikasi.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  const checkboxRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    cursor: 'pointer',
  };

  const checkboxStyle = {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#785E40',
  };

  const labelStyle = {
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const saveBtnStyle = {
    marginTop: '8px',
    padding: '10px 28px',
    background: saving ? '#c4a882' : 'var(--brand-brown, #785E40)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: saving ? 'not-allowed' : 'pointer',
    transition: 'filter 0.15s',
  };

  if (loading) {
    return <p style={{ color: '#9b9b9b', fontSize: '14px' }}>Memuat preferensi notifikasi…</p>;
  }

  if (error) {
    return <p style={{ color: '#c0392b', fontSize: '14px' }}>{error}</p>;
  }

  return (
    <div>
      {NOTIFICATION_FIELDS.map(({ key, label }) => {
        const inputId = `notif-${key}`;
        return (
          <div
            key={key}
            style={checkboxRowStyle}
            onClick={() => handleChange(key)}
          >
            <input
              id={inputId}
              type="checkbox"
              style={checkboxStyle}
              checked={prefs[key]}
              onChange={() => handleChange(key)}
              onClick={(e) => e.stopPropagation()}
            />
            <label htmlFor={inputId} style={labelStyle}>
              {label}
            </label>
          </div>
        );
      })}

      <button
        type="button"
        style={saveBtnStyle}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
    </div>
  );
}

export default NotificationSettings;
