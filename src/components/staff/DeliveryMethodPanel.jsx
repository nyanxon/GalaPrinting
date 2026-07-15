/**
 * DeliveryMethodPanel.jsx — Panel untuk QC / admin set delivery method & pickup info.
 *
 * Fitur 3: ditampilkan di OrderDetailModal atau OrdersSection saat order
 * berada di tahap "Quality Checking" atau setelahnya.
 *
 * Props:
 *   order    — order object (memiliki deliveryMethod, pickupLocation, pickupReadyAt)
 *   onSaved  — callback(updatedOrder) setelah berhasil save
 */

import { useState } from 'react';
import { setOrderDeliveryMethod, setOrderPickupInfo } from '../../services/api/invoiceService.js';
import { showToast } from '../../core/toastEmitter.js';

const METHOD_OPTIONS = [
  { value: 'delivery',        label: '🚚 Pengiriman Kurir',  desc: 'Dikirim via jasa ekspedisi. Isi nomor resi setelah kirim.' },
  { value: 'pickup_factory',  label: '🏭 Ambil di Pabrik',  desc: 'Customer ambil langsung ke pabrik/gudang produksi.' },
  { value: 'pickup_store',    label: '🏪 Ambil di Toko',    desc: 'Customer ambil di toko/counter kami.' },
];

export default function DeliveryMethodPanel({ order, onSaved }) {
  const currentMethod = order.deliveryMethod || order.delivery_method || 'delivery';

  const [method, setMethod]               = useState(currentMethod);
  const [pickupLocation, setPickupLocation] = useState(order.pickupLocation || order.pickup_location || '');
  const [pickupReadyAt, setPickupReadyAt]   = useState(
    order.pickupReadyAt || order.pickup_ready_at
      ? (order.pickupReadyAt || order.pickup_ready_at).slice(0, 16)
      : ''
  );
  const [saving, setSaving]               = useState(false);

  const isPickup = method === 'pickup_factory' || method === 'pickup_store';

  async function handleSave() {
    setSaving(true);
    try {
      let updated = await setOrderDeliveryMethod(order.id, method);

      if (isPickup) {
        if (!pickupLocation.trim()) {
          showToast('Lokasi pickup wajib diisi.', 'error');
          setSaving(false);
          return;
        }
        updated = await setOrderPickupInfo(order.id, {
          pickup_location: pickupLocation.trim(),
          pickup_ready_at: pickupReadyAt ? new Date(pickupReadyAt).toISOString() : null,
        });
      }

      showToast('Metode pengambilan berhasil disimpan.', 'success');
      if (onSaved) onSaved(updated);
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menyimpan metode pengambilan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="odm-section">
      <div className="odm-section-title">📦 Metode Pengambilan / Pengiriman</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        {METHOD_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `2px solid ${method === opt.value ? '#785E40' : '#e5e7eb'}`,
              background: method === opt.value ? '#faf8f5' : '#fff',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <input
              type="radio"
              name={`delivery_method_${order.id}`}
              value={opt.value}
              checked={method === opt.value}
              onChange={() => setMethod(opt.value)}
              style={{ marginTop: '2px', accentColor: '#785E40' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>{opt.label}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Fields pickup — hanya muncul jika pilih pickup */}
      {isPickup && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            Lokasi Pengambilan <span style={{ color: '#b91c1c' }}>*</span>
            <input
              className="adm-input"
              type="text"
              placeholder="Contoh: Jl. Tibung Sari No.5X, Dalung (Pabrik)"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            Jadwal Siap Diambil (opsional)
            <input
              className="adm-input"
              type="datetime-local"
              value={pickupReadyAt}
              onChange={(e) => setPickupReadyAt(e.target.value)}
            />
          </label>
        </div>
      )}

      <button
        type="button"
        className="adm-btn adm-btn--primary"
        onClick={handleSave}
        disabled={saving}
        style={{ width: '100%' }}
      >
        {saving ? 'Menyimpan…' : '💾 Simpan Metode Pengambilan'}
      </button>
    </div>
  );
}
