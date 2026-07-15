/**
 * QCOrdersSection.jsx — Orders untuk QC role.
 *
 * Fitur 1: QC sekarang melihat SEMUA order. Tombol advance hanya muncul
 *          di tahap QC (On Progress → Quality Checking → In Delivery → Finished).
 *
 * Fitur 3: Kolom "Pengiriman" punya dua mode:
 *   - "Kirim via Ekspedisi": kurir + nomor resi (wajib)
 *   - "Ambil di Pabrik": sembunyikan field resi, tampilkan jadwal siap ambil
 *
 * Requirements: 11.1, 13.4
 */

import { useState } from 'react';
import SubAdminOrdersSection from './SubAdminOrdersSection.jsx';
import { setTrackingNumber, updateOrderStatus } from '../../../../services/orders.js';
import { setOrderDeliveryMethod, setOrderPickupInfo } from '../../../../services/invoiceService.js';
import { showToast } from '../../../../core/toastEmitter.js';

const COURIERS = ['JNE', 'J&T Express', 'SiCepat', 'AnterAja', 'Pos Indonesia', 'Ninja Xpress'];

/**
 * Kolom pengiriman untuk QC.
 * Hanya aktif saat status "Quality Checking" atau "In Delivery".
 * Status lain tampilkan dash.
 */
function QCDeliveryCell({ order, onRefresh }) {
  // Fitur 3: mode berdasarkan delivery_method yang sudah tersimpan di order,
  // atau default ke 'delivery'
  const savedMethod = order.deliveryMethod || 'delivery';
  const isPickup = savedMethod === 'pickup_factory' || savedMethod === 'pickup_store';

  const [deliveryMode, setDeliveryMode] = useState(isPickup ? 'pickup' : 'delivery');
  const [trackingNumber, setTrackingNum] = useState(order.trackingNumber || '');
  const [courierName, setCourierName]    = useState(order.courierName || '');
  const [pickupReadyAt, setPickupReadyAt] = useState(
    order.pickupReadyAt ? order.pickupReadyAt.slice(0, 16) : ''
  );
  const [saving, setSaving] = useState(false);

  // ── Quality Checking: form pengiriman ─────────────────────
  if (order.status === 'Quality Checking') {
    async function handleSend() {
      if (deliveryMode === 'delivery') {
        if (!trackingNumber.trim()) { showToast('Masukkan nomor resi.', 'error'); return; }
        if (!courierName)           { showToast('Pilih kurir.', 'error'); return; }
        setSaving(true);
        try {
          // Set delivery_method = 'delivery' dulu, lalu set tracking (auto-advance ke In Delivery)
          await setOrderDeliveryMethod(order.id, 'delivery');
          const res = await setTrackingNumber(order.id, trackingNumber.trim(), courierName, 'qc');
          if (res.ok) {
            showToast(`Dikirim via ${courierName}. Resi: ${trackingNumber.trim()}`, 'success');
            onRefresh();
          } else {
            showToast(res.message || 'Gagal menyimpan resi.', 'error');
          }
        } catch {
          showToast('Gagal menyimpan data pengiriman.', 'error');
        } finally {
          setSaving(false);
        }
      } else {
        // Pickup: set delivery_method + pickup info, lalu advance manual ke In Delivery
        setSaving(true);
        try {
          await setOrderDeliveryMethod(order.id, 'pickup_factory');
          await setOrderPickupInfo(order.id, {
            pickup_location: 'Pabrik Gala Printing',
            pickup_ready_at: pickupReadyAt ? new Date(pickupReadyAt).toISOString() : null,
          });
          // Advance ke In Delivery via updateOrderStatus
          const res = await updateOrderStatus(order.id, 'In Delivery', 'qc');
          if (res.ok) {
            showToast('Jadwal pickup disimpan. Status → In Delivery.', 'success');
            onRefresh();
          } else {
            showToast(res.message || 'Gagal update status.', 'error');
          }
        } catch (err) {
          showToast(err?.message || 'Gagal menyimpan pickup info.', 'error');
        } finally {
          setSaving(false);
        }
      }
    }

    return (
      <div className="subadmin-qc-cell" style={{ minWidth: '220px' }}>
        {/* Toggle delivery mode — Fitur 3 */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button
            type="button"
            className={`adm-btn${deliveryMode === 'delivery' ? ' adm-btn--primary' : ''}`}
            style={{ fontSize: '11px', padding: '3px 8px' }}
            onClick={() => setDeliveryMode('delivery')}
          >
            🚚 Ekspedisi
          </button>
          <button
            type="button"
            className={`adm-btn${deliveryMode === 'pickup' ? ' adm-btn--primary' : ''}`}
            style={{ fontSize: '11px', padding: '3px 8px' }}
            onClick={() => setDeliveryMode('pickup')}
          >
            🏭 Ambil di Pabrik
          </button>
        </div>

        {deliveryMode === 'delivery' ? (
          <div className="subadmin-tracking-form">
            <select
              className="adm-input subadmin-courier-select"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              aria-label="Pilih kurir"
              style={{ marginBottom: '4px', width: '100%' }}
            >
              <option value="">Pilih Kurir</option>
              {COURIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              className="adm-input subadmin-tracking-input"
              type="text"
              placeholder="Nomor resi…"
              value={trackingNumber}
              onChange={(e) => setTrackingNum(e.target.value)}
              style={{ marginBottom: '4px', width: '100%' }}
            />
          </div>
        ) : (
          /* Pickup mode — Fitur 3 */
          <div style={{ marginBottom: '4px' }}>
            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '2px' }}>
              Jadwal Siap Diambil
            </label>
            <input
              className="adm-input"
              type="datetime-local"
              value={pickupReadyAt}
              onChange={(e) => setPickupReadyAt(e.target.value)}
              style={{ width: '100%' }}
              aria-label="Jadwal siap diambil"
            />
            <div className="adm-date" style={{ marginTop: '3px' }}>
              Lokasi: Pabrik Gala Printing
            </div>
          </div>
        )}

        <button
          className="adm-btn adm-btn--primary subadmin-send-delivery-btn"
          type="button"
          onClick={handleSend}
          disabled={saving}
          style={{ marginTop: '4px', width: '100%' }}
        >
          {saving ? 'Menyimpan…' : deliveryMode === 'delivery' ? '🚚 Kirim' : '✅ Konfirmasi Pickup'}
        </button>
      </div>
    );
  }

  // ── In Delivery: info pengiriman + tombol selesai ─────────
  if (order.status === 'In Delivery') {
    const isPickupOrder = order.deliveryMethod === 'pickup_factory' || order.deliveryMethod === 'pickup_store';

    async function handleFinished() {
      const res = await updateOrderStatus(order.id, 'Finished', 'qc');
      if (res.ok) {
        showToast('Pesanan selesai.', 'success');
        onRefresh();
      } else {
        showToast(res.message || 'Gagal.', 'error');
      }
    }

    return (
      <div className="subadmin-qc-cell">
        {isPickupOrder ? (
          <div className="subadmin-tracking-info">
            <span className="subadmin-courier-badge">🏭 Pickup</span>
            {order.pickupReadyAt && (
              <div className="adm-date" style={{ marginTop: '2px' }}>
                Siap: {new Date(order.pickupReadyAt).toLocaleString('id-ID', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </div>
            )}
          </div>
        ) : order.trackingNumber ? (
          <div className="subadmin-tracking-info">
            <span className="subadmin-courier-badge">{order.courierName || 'Kurir'}</span>
            <span className="subadmin-tracking-num">
              Resi: <strong>{order.trackingNumber}</strong>
            </span>
          </div>
        ) : (
          <span className="adm-date">Belum ada info pengiriman</span>
        )}
        <button
          className="adm-btn adm-btn--success subadmin-delivered-btn"
          type="button"
          onClick={handleFinished}
          style={{ marginTop: '6px' }}
        >
          ✅ Tandai Selesai
        </button>
      </div>
    );
  }

  // Status lain (On Progress, Finished, dll) — tidak ada aksi pengiriman
  if (order.status === 'Finished') {
    const isPickupOrder = order.deliveryMethod === 'pickup_factory' || order.deliveryMethod === 'pickup_store';
    return (
      <div className="subadmin-qc-cell">
        {isPickupOrder ? (
          <span className="adm-date">🏭 Pickup selesai</span>
        ) : order.trackingNumber ? (
          <div>
            <span className="subadmin-courier-badge">{order.courierName}</span>
            <div className="adm-date">Resi: {order.trackingNumber}</div>
          </div>
        ) : (
          <span className="adm-date">—</span>
        )}
      </div>
    );
  }

  return <span className="adm-date">—</span>;
}

const qcExtraColumn = {
  header: 'Pengiriman / Pickup',
  renderCell: (order, onRefresh) => (
    <QCDeliveryCell key={`${order.id}-${order.status}-${order.deliveryMethod}`} order={order} onRefresh={onRefresh} />
  ),
};

export default function QCOrdersSection() {
  return (
    <SubAdminOrdersSection extraColumn={qcExtraColumn} />
  );
}
