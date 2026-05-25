/**
 * QCOrdersSection.jsx — Orders filtered to QC/delivery statuses.
 *
 * QC responsibilities: quality check, packaging, and courier delivery.
 * Visible statuses: "On Progress", "Quality Checking", "In Delivery"
 *
 * The extra column handles:
 *   - "Quality Checking": courier select + tracking number input + send button
 *   - "In Delivery": display tracking info + mark-as-delivered button
 *   - Other statuses: empty cell
 *
 * Requirements: 11.1, 13.4
 */

import { useState } from 'react';
import SubAdminOrdersSection from './SubAdminOrdersSection.jsx';
import { setTrackingNumber, markOrderDelivered } from '../../../../services/orderService.js';
import { showToast } from '../../../../core/toastEmitter.js';

const QC_STATUSES = ['On Progress', 'Quality Checking', 'In Delivery'];

const COURIERS = ['JNE', 'J&T Express', 'SiCepat', 'AnterAja', 'Pos Indonesia', 'Ninja Xpress'];

function QCDeliveryCell({ order, onRefresh }) {
  const [trackingNumber, setTrackingNumberState] = useState(order.trackingNumber || '');
  const [courierName, setCourierName] = useState(order.courierName || '');

  if (order.status === 'Quality Checking') {
    function handleSend() {
      if (!trackingNumber.trim()) {
        showToast('Masukkan nomor resi.', 'error');
        return;
      }
      if (!courierName) {
        showToast('Pilih kurir.', 'error');
        return;
      }
      const res = setTrackingNumber(order.id, trackingNumber.trim(), courierName, 'qc');
      if (res.ok) {
        showToast(`Dikirim via ${courierName}. Resi: ${trackingNumber.trim()}`, 'success');
        onRefresh();
      } else {
        showToast(res.message || 'Gagal.', 'error');
      }
    }

    return (
      <div className="subadmin-qc-cell">
        <div className="subadmin-tracking-form">
          <select
            className="adm-input subadmin-courier-select"
            value={courierName}
            onChange={(e) => setCourierName(e.target.value)}
            aria-label="Pilih kurir"
          >
            <option value="">Pilih Kurir</option>
            {COURIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="adm-input subadmin-tracking-input"
            type="text"
            placeholder="Nomor resi…"
            value={trackingNumber}
            onChange={(e) => setTrackingNumberState(e.target.value)}
          />
          <button
            className="adm-btn adm-btn--primary subadmin-send-delivery-btn"
            type="button"
            onClick={handleSend}
          >
            🚚 Kirim
          </button>
        </div>
      </div>
    );
  }

  if (order.status === 'In Delivery') {
    function handleDelivered() {
      const res = markOrderDelivered(order.id, 'qc');
      if (res.ok) {
        showToast('Pesanan selesai.', 'success');
        onRefresh();
      } else {
        showToast(res.message || 'Gagal.', 'error');
      }
    }

    return (
      <div className="subadmin-qc-cell">
        {order.trackingNumber ? (
          <div className="subadmin-tracking-info">
            <span className="subadmin-courier-badge">{order.courierName || 'Kurir'}</span>
            <span className="subadmin-tracking-num">
              Resi: <strong>{order.trackingNumber}</strong>
            </span>
          </div>
        ) : (
          <span className="adm-date">Belum ada resi</span>
        )}
        <button
          className="adm-btn adm-btn--success subadmin-delivered-btn"
          type="button"
          onClick={handleDelivered}
        >
          ✅ Tandai Diterima
        </button>
        <div className="adm-date" style={{ marginTop: '4px', fontSize: '11px' }}>
          (Otomatis saat API kurir aktif)
        </div>
      </div>
    );
  }

  return <span className="adm-date">—</span>;
}

const qcExtraColumn = {
  header: 'Pengiriman',
  renderCell: (order, onRefresh) => (
    <QCDeliveryCell key={order.id} order={order} onRefresh={onRefresh} />
  ),
};

export default function QCOrdersSection() {
  return (
    <SubAdminOrdersSection
      visibleStatuses={QC_STATUSES}
      extraColumn={qcExtraColumn}
    />
  );
}
