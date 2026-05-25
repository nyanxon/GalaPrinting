import Modal from './Modal.jsx';
import { formatCurrency } from '../../core/helpers.js';
import { api, resolveApiUrl } from '../../core/httpClient.js';

/**
 * OrderDetailModal — detail pesanan untuk admin, subadmin, dan owner.
 * Menampilkan: info customer, produk yang dibeli, file desain customer,
 * total, catatan admin, tracking, dan riwayat status.
 * Bukti pembayaran TIDAK ditampilkan di sini (sudah ada di tabel).
 */

const STATUS_CONFIG = {
  'Waiting for Payment':        { label: 'Menunggu Pembayaran',       color: '#92400e', bg: '#fef3c7' },
  'Payment Accepted':           { label: 'Pembayaran Diterima',        color: '#166534', bg: '#dcfce7' },
  'Waiting for Design Approval':{ label: 'Menunggu Konfirmasi Desain', color: '#5b21b6', bg: '#ede9fe' },
  'Design Accepted':            { label: 'Desain Disetujui',           color: '#1e40af', bg: '#dbeafe' },
  'On Progress':                { label: 'Sedang Diproses',            color: '#9a3412', bg: '#ffedd5' },
  'Quality Checking':           { label: 'Quality Check',              color: '#0369a1', bg: '#e0f2fe' },
  'In Delivery':                { label: 'Dalam Pengiriman',           color: '#15803d', bg: '#f0fdf4' },
  'Finished':                   { label: 'Selesai',                    color: '#166534', bg: '#dcfce7' },
  'Cancelled':                  { label: 'Dibatalkan',                 color: '#991b1b', bg: '#fee2e2' },
};

/**
 * Resolve design file URL from an order item.
 * Handles both backend (designFileUrl) and localStorage (designDataUrl) modes.
 */
function resolveDesignUrl(item) {
  if (item.designFileUrl) return item.designFileUrl;
  if (item.designDataUrl) return item.designDataUrl;
  if (item.designFileName) return resolveApiUrl(item.designFileName);
  return null;
}

/**
 * Download a file from a URL via fetch (handles cross-origin + auth).
 * Falls back to opening in a new tab if fetch fails.
 */
async function downloadFile(url, fileName) {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'file-desain';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function OrderDetailModal({ isOpen, onClose, order }) {
  if (!order) return null;

  const items    = order.items || [];
  const subtotal = order.subtotal ?? order.total
    ?? items.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
  const cfg = STATUS_CONFIG[order.status]
    || { label: order.status || '—', color: '#1f1f1f', bg: '#f0f0f0' };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="odm-box">

        {/* ── Header ── */}
        <div className="odm-header">
          <div>
            <h2 className="odm-title">Detail Pesanan</h2>
            <code className="odm-order-num">
              {order.orderNumber || order.order_number || `#${order.id?.slice(0, 8)}`}
            </code>
            {order.source === 'custom'  && <span className="odm-source-badge odm-source-badge--custom">Custom Order</span>}
            {order.source === 'offline' && <span className="odm-source-badge odm-source-badge--offline">Offline Order</span>}
          </div>
          <button className="odm-close" type="button" aria-label="Tutup" onClick={onClose}>✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="odm-body">

          {/* Status + tanggal */}
          <div className="odm-status-row">
            <span className="odm-status-badge" style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
            {(order.createdAt || order.created_at) && (
              <span className="odm-meta-date">
                {new Date(order.createdAt || order.created_at).toLocaleDateString('id-ID', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* ── Informasi Customer ── */}
          <div className="odm-section">
            <div className="odm-section-title">👤 Informasi Customer</div>
            <div className="odm-info-grid">
              {(order.customerName || order.customer_name || order.customer?.name) && (
                <div className="odm-info-row">
                  <span className="odm-info-label">Nama</span>
                  <span className="odm-info-value">
                    {order.customerName || order.customer_name || order.customer?.name}
                  </span>
                </div>
              )}
              {(order.customerPhone || order.customer_phone || order.customer?.phone) && (
                <div className="odm-info-row">
                  <span className="odm-info-label">Telepon</span>
                  <span className="odm-info-value">
                    {order.customerPhone || order.customer_phone || order.customer?.phone}
                  </span>
                </div>
              )}
              {(order.customerAddress || order.customer_address || order.customer?.address) && (
                <div className="odm-info-row">
                  <span className="odm-info-label">Alamat</span>
                  <span className="odm-info-value">
                    {order.customerAddress || order.customer_address || order.customer?.address}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Produk yang Dibeli ── */}
          <div className="odm-section">
            <div className="odm-section-title">📦 Produk yang Dibeli</div>
            {items.length === 0 ? (
              <div className="odm-empty-note">Tidak ada data item.</div>
            ) : (
              <div className="odm-items-list">
                {items.map((item, idx) => {
                  const designUrl = resolveDesignUrl(item);
                  const rawName   = item.designFileName || '';
                  const fileName  = rawName.includes('/') ? rawName.split('/').pop() : rawName || 'file-desain';
                  const isImage   = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);

                  return (
                    <div key={item.id || idx} className="odm-item-card">
                      {/* Nama + subtotal */}
                      <div className="odm-item-header">
                        <span className="odm-item-name">{item.name}</span>
                        <span className="odm-item-subtotal">
                          {formatCurrency(item.price * (item.quantity || 1))}
                        </span>
                      </div>

                      {/* Qty × harga + atribut */}
                      <div className="odm-item-meta">
                        <span className="odm-item-qty">
                          {item.quantity || 1} pcs × {formatCurrency(item.price)}
                        </span>
                        {item.color    && <span className="odm-item-tag">🎨 {item.color}</span>}
                        {item.size     && <span className="odm-item-tag">📐 {item.size}</span>}
                        {item.material && <span className="odm-item-tag">🧱 {item.material}</span>}
                      </div>

                      {/* Catatan */}
                      {item.notes && (
                        <div className="odm-item-notes">📝 {item.notes}</div>
                      )}

                      {/* File desain */}
                      <div className="odm-item-design">
                        <div className="odm-item-design-label">🎨 File Desain</div>
                        {designUrl ? (
                          <div className="odm-design-card">
                            {isImage ? (
                              <img
                                src={designUrl}
                                alt={`Desain: ${fileName}`}
                                className="odm-design-img"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="odm-design-icon">📄</div>
                            )}
                            <div className="odm-design-footer">
                              <span className="odm-design-name" title={fileName}>
                                📎 {fileName}
                              </span>
                              <div className="odm-file-actions">
                                {isImage && (
                                  <a
                                    className="odm-file-btn odm-file-btn--view"
                                    href={designUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    🔍 Lihat
                                  </a>
                                )}
                                <button
                                  className="odm-file-btn odm-file-btn--dl"
                                  type="button"
                                  onClick={() => downloadFile(designUrl, fileName)}
                                >
                                  ⬇️ Download
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="odm-design-empty">Belum ada file desain</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Total ── */}
          <div className="odm-total-row">
            <span className="odm-total-label">Subtotal</span>
            <span className="odm-total-value">{formatCurrency(subtotal)}</span>
          </div>

          {/* ── Promo / Diskon ── */}
          {(order.promoCode || order.promo_code) && (
            <div className="odm-promo-row">
              <div className="odm-promo-left">
                <span className="odm-promo-icon">🏷️</span>
                <div>
                  <div className="odm-promo-code">{order.promoCode || order.promo_code}</div>
                  <div className="odm-promo-label">Kode Promo</div>
                </div>
              </div>
              <span className="odm-promo-discount">
                -{formatCurrency(order.discountAmount ?? order.discount_amount ?? 0)}
              </span>
            </div>
          )}

          {/* ── Total Akhir (after discount) ── */}
          {(order.promoCode || order.promo_code) && (
            <div className="odm-total-row odm-total-row--final">
              <span className="odm-total-label">Total Akhir</span>
              <span className="odm-total-value">
                {formatCurrency(
                  subtotal - Number(order.discountAmount ?? order.discount_amount ?? 0)
                )}
              </span>
            </div>
          )}

          {/* ── Catatan Admin ── */}
          {(order.adminNote || order.admin_note) && (
            <div className="odm-section">
              <div className="odm-section-title">📋 Catatan Admin</div>
              <div className="odm-note-box">{order.adminNote || order.admin_note}</div>
            </div>
          )}

          {/* ── Alasan Pembatalan ── */}
          {order.status === 'Cancelled' && (order.cancellationReason || order.cancellation_reason) && (
            <div className="odm-section">
              <div className="odm-section-title">❌ Alasan Pembatalan</div>
              <div className="odm-note-box">{order.cancellationReason || order.cancellation_reason}</div>
            </div>
          )}

          {/* ── Info Pengiriman ── */}
          {(order.trackingNumber || order.tracking_number) && (
            <div className="odm-section">
              <div className="odm-section-title">🚚 Info Pengiriman</div>
              <div className="odm-info-grid">
                <div className="odm-info-row">
                  <span className="odm-info-label">Kurir</span>
                  <span className="odm-info-value">
                    {order.courierName || order.courier_name || '—'}
                  </span>
                </div>
                <div className="odm-info-row">
                  <span className="odm-info-label">No. Resi</span>
                  <span className="odm-info-value odm-tracking-num">
                    {order.trackingNumber || order.tracking_number}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Riwayat Status ── */}
          {Array.isArray(order.history) && order.history.length > 0 && (
            <div className="odm-section">
              <div className="odm-section-title">🕐 Riwayat Status</div>
              <div className="odm-history-list">
                {order.history.map((h, idx) => (
                  <div key={h.id || idx} className="odm-history-item">
                    <div className="odm-history-dot" />
                    <div className="odm-history-content">
                      <span className="odm-history-status">
                        {(h.from_status || h.from)
                          ? `${h.from_status || h.from} → ` : ''}
                        <strong>{h.to_status || h.to || h.type}</strong>
                      </span>
                      {(h.created_at || h.at) && (
                        <span className="odm-history-time">
                          {new Date(h.created_at || h.at).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="odm-footer">
          <button className="adm-btn" type="button" onClick={onClose}>Tutup</button>
        </div>

      </div>
    </Modal>
  );
}

export default OrderDetailModal;
