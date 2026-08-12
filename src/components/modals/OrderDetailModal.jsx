import { useState, useEffect } from 'react';
import Modal from '../ui/Modal.jsx';
import { formatCurrency } from '../../utils/format.js';
import { api, resolveApiUrl } from '../../core/httpClient.js';
import DeliveryMethodPanel from '../staff/DeliveryMethodPanel.jsx';
import { getInvoiceByOrderId, updateInvoicePaymentStatus, openInvoicePdf } from '../../services/api/invoiceService.js';
import { showToast } from '../../core/toastEmitter.js';
import { STATUS_CONFIG } from '../../services/orders.js';

/**
 * OrderDetailModal — detail pesanan untuk admin, subadmin, dan owner.
 * Menampilkan: info customer, produk yang dibeli, file desain customer,
 * total, catatan admin, tracking, riwayat status, dan metode pengambilan.
 *
 * Fitur 1: tampilkan approval audit trail.
 * Fitur 3: tampilkan DeliveryMethodPanel untuk QC/admin di stage relevan.
 */

// Stages di mana QC/admin bisa set delivery method (Fitur 3)
const DELIVERY_METHOD_STAGES = ['Quality Checking', 'In Delivery', 'Finished'];

function resolveDesignUrl(item) {
  if (item.designFileUrl)  return item.designFileUrl;
  if (item.designDataUrl)  return item.designDataUrl;
  if (item.designFileName) return resolveApiUrl(item.designFileName);
  return null;
}

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
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * @param {{ isOpen: boolean, onClose: fn, order: object, actorRole?: string, onOrderUpdated?: fn }} props
 */
function OrderDetailModal({ isOpen, onClose, order, actorRole, onOrderUpdated }) {
  // Keep a local copy so DeliveryMethodPanel can update it in-place
  const [localOrder, setLocalOrder] = useState(order);
  const [invoice, setInvoice]       = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceStatusUpdating, setInvoiceStatusUpdating] = useState(false);
  const [invoiceNewStatus, setInvoiceNewStatus] = useState('');
  const [invoiceNewMethod, setInvoiceNewMethod] = useState('');

  // Sync when parent passes a different order object
  useEffect(() => {
    if (order) {
      setLocalOrder(order);
      setInvoice(null);
      // Fetch invoice for this order
      setInvoiceLoading(true);
      getInvoiceByOrderId(order.id)
        .then((inv) => {
          setInvoice(inv);
          if (inv) {
            setInvoiceNewStatus(inv.payment_status);
            setInvoiceNewMethod(inv.payment_method || '');
          }
        })
        .catch(() => setInvoice(null))
        .finally(() => setInvoiceLoading(false));
    }
  }, [order]);

  async function handleInvoiceStatusUpdate() {
    if (!invoice || invoice.locked) return;
    setInvoiceStatusUpdating(true);
    try {
      const updated = await updateInvoicePaymentStatus(invoice.id, invoiceNewStatus, invoiceNewMethod);
      setInvoice(updated);
      showToast(`Status pembayaran invoice diperbarui: ${updated.payment_status}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal update status invoice.', 'error');
    } finally {
      setInvoiceStatusUpdating(false);
    }
  }

  if (!localOrder) return null;

  const o       = localOrder;
  const items   = o.items || [];
  const subtotal = Number(o.subtotal ?? o.total
    ?? items.reduce((s, i) => s + (Number(i.price) * (i.quantity || 1)), 0));
  const cfg = STATUS_CONFIG[o.status] || { label: o.status || '—', color: '#1f1f1f', bg: '#f0f0f0' };

  // Fitur 3
  const showDeliveryPanel =
    DELIVERY_METHOD_STAGES.includes(o.status) &&
    (actorRole === 'qc' || actorRole === 'admin' || actorRole === 'owner');

  function handleDeliverySaved(updatedOrder) {
    setLocalOrder(updatedOrder);
    if (onOrderUpdated) onOrderUpdated(updatedOrder);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="odm-box">

        {/* ── Header ── */}
        <div className="odm-header">
          <div>
            <h2 className="odm-title">Detail Pesanan</h2>
            <code className="odm-order-num">
              {o.orderNumber || o.order_number || `#${o.id?.slice(0, 8)}`}
            </code>
            {o.source === 'custom'  && <span className="odm-source-badge odm-source-badge--custom">Custom Order</span>}
            {o.source === 'offline' && <span className="odm-source-badge odm-source-badge--offline">Offline Order</span>}
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
            {(o.createdAt || o.created_at) && (
              <span className="odm-meta-date">
                {new Date(o.createdAt || o.created_at).toLocaleDateString('id-ID', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* ── Informasi Customer ── */}
          <div className="odm-section">
            <div className="odm-section-title">👤 Informasi Customer</div>
            <div className="odm-info-grid">
              {(o.customerName || o.customer_name || o.customer?.name) && (
                <div className="odm-info-row">
                  <span className="odm-info-label">Nama</span>
                  <span className="odm-info-value">
                    {o.customerName || o.customer_name || o.customer?.name}
                  </span>
                </div>
              )}
              {(o.customerPhone || o.customer_phone || o.customer?.phone) && (
                <div className="odm-info-row">
                  <span className="odm-info-label">Telepon</span>
                  <span className="odm-info-value">
                    {o.customerPhone || o.customer_phone || o.customer?.phone}
                  </span>
                </div>
              )}
              {(o.customerAddress || o.customer_address || o.customer?.address) && (
                <div className="odm-info-row">
                  <span className="odm-info-label">Alamat</span>
                  <span className="odm-info-value">
                    {o.customerAddress || o.customer_address || o.customer?.address}
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
                      <div className="odm-item-header">
                        <span className="odm-item-name">{item.name}</span>
                        <span className="odm-item-subtotal">
                          {formatCurrency(Number(item.price) * (item.quantity || 1))}
                        </span>
                      </div>
                      <div className="odm-item-meta">
                        <span className="odm-item-qty">
                          {item.quantity || 1} pcs × {formatCurrency(item.price)}
                        </span>
                      </div>
                      {item.notes && <div className="odm-item-notes">📝 {item.notes}</div>}
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
                              <span className="odm-design-name" title={fileName}>📎 {fileName}</span>
                              <div className="odm-file-actions">
                                {isImage && (
                                  <a className="odm-file-btn odm-file-btn--view"
                                    href={designUrl} target="_blank" rel="noopener noreferrer">
                                    🔍 Lihat
                                  </a>
                                )}
                                <button className="odm-file-btn odm-file-btn--dl" type="button"
                                  onClick={() => downloadFile(designUrl, fileName)}>
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

          {/* ── Subtotal ── */}
          <div className="odm-total-row">
            <span className="odm-total-label">Subtotal</span>
            <span className="odm-total-value">{formatCurrency(subtotal)}</span>
          </div>

          {/* ── Promo / Diskon ── */}
          {(o.promoCode || o.promo_code) && (
            <div className="odm-promo-row">
              <div className="odm-promo-left">
                <span className="odm-promo-icon">🏷️</span>
                <div>
                  <div className="odm-promo-code">{o.promoCode || o.promo_code}</div>
                  <div className="odm-promo-label">Kode Promo</div>
                </div>
              </div>
              <span className="odm-promo-discount">
                -{formatCurrency(o.discountAmount ?? o.discount_amount ?? 0)}
              </span>
            </div>
          )}

          {(o.promoCode || o.promo_code) && (
            <div className="odm-total-row odm-total-row--final">
              <span className="odm-total-label">Total Akhir</span>
              <span className="odm-total-value">
                {formatCurrency(subtotal - Number(o.discountAmount ?? o.discount_amount ?? 0))}
              </span>
            </div>
          )}

          {/* ── Catatan Admin ── */}
          {(o.adminNote || o.admin_note) && (
            <div className="odm-section">
              <div className="odm-section-title">📋 Catatan Admin</div>
              <div className="odm-note-box">{o.adminNote || o.admin_note}</div>
            </div>
          )}

          {/* ── Alasan Pembatalan ── */}
          {o.status === 'Cancelled' && (o.cancellationReason || o.cancellation_reason) && (
            <div className="odm-section">
              <div className="odm-section-title">❌ Alasan Pembatalan</div>
              <div className="odm-note-box">{o.cancellationReason || o.cancellation_reason}</div>
            </div>
          )}

          {/* ── Info Pengiriman (tracking) ── */}
          {(o.trackingNumber || o.tracking_number) && (
            <div className="odm-section">
              <div className="odm-section-title">🚚 Info Pengiriman</div>
              <div className="odm-info-grid">
                <div className="odm-info-row">
                  <span className="odm-info-label">Kurir</span>
                  <span className="odm-info-value">{o.courierName || o.courier_name || '—'}</span>
                </div>
                <div className="odm-info-row">
                  <span className="odm-info-label">No. Resi</span>
                  <span className="odm-info-value odm-tracking-num">
                    {o.trackingNumber || o.tracking_number}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Fitur 3: Metode Pengambilan (read-only view) ── */}
          {(o.deliveryMethod || o.delivery_method) && (
            <div className="odm-section">
              <div className="odm-section-title">📦 Metode Pengambilan</div>
              <div className="odm-info-grid">
                <div className="odm-info-row">
                  <span className="odm-info-label">Metode</span>
                  <span className="odm-info-value">
                    {(() => {
                      const m = o.deliveryMethod || o.delivery_method;
                      const labels = {
                        delivery:       '🚚 Pengiriman Kurir',
                        pickup_factory: '🏭 Ambil di Pabrik',
                        pickup_store:   '🏪 Ambil di Toko',
                      };
                      return labels[m] || m;
                    })()}
                  </span>
                </div>
                {(o.pickupLocation || o.pickup_location) && (
                  <div className="odm-info-row">
                    <span className="odm-info-label">Lokasi Pickup</span>
                    <span className="odm-info-value">{o.pickupLocation || o.pickup_location}</span>
                  </div>
                )}
                {(o.pickupReadyAt || o.pickup_ready_at) && (
                  <div className="odm-info-row">
                    <span className="odm-info-label">Siap Diambil</span>
                    <span className="odm-info-value">
                      {new Date(o.pickupReadyAt || o.pickup_ready_at).toLocaleString('id-ID', {
                        day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Fitur 3: Panel set delivery method (QC/admin saja) ── */}
          {showDeliveryPanel && (
            <DeliveryMethodPanel order={o} onSaved={handleDeliverySaved} />
          )}

          {/* ── Fitur 1: Approval audit trail ── */}
          {Array.isArray(o.approvals) && o.approvals.length > 0 && (
            <div className="odm-section">
              <div className="odm-section-title">✅ Riwayat Approval</div>
              <div className="odm-history-list">
                {o.approvals.map((ap, idx) => (
                  <div key={ap.id || idx} className="odm-history-item">
                    <div className="odm-history-dot" style={{ background: '#166534' }} />
                    <div className="odm-history-content">
                      <span className="odm-history-status">
                        <strong>{ap.stage}</strong>
                        {' '}&mdash; disetujui oleh{' '}
                        <strong>{ap.approved_name || ap.approver_name_live || ap.approved_role}</strong>
                        {' '}({ap.approved_role})
                      </span>
                      {ap.approved_at && (
                        <span className="odm-history-time">
                          {new Date(ap.approved_at).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Riwayat Status ── */}
          {Array.isArray(o.history) && o.history.length > 0 && (
            <div className="odm-section">
              <div className="odm-section-title">🕐 Riwayat Status</div>
              <div className="odm-history-list">
                {o.history.map((h, idx) => (
                  <div key={h.id || idx} className="odm-history-item">
                    <div className="odm-history-dot" />
                    <div className="odm-history-content">
                      <span className="odm-history-status">
                        {(h.from_status || h.from) ? `${h.from_status || h.from} → ` : ''}
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

          {/* ── Invoice ── */}
          <div className="odm-section">
            <div className="odm-section-title">🧾 Invoice</div>
            {invoiceLoading ? (
              <div style={{ color: '#6b7280', fontSize: '13px' }}>Memuat invoice…</div>
            ) : invoice ? (
              <div className="odm-invoice-box">
                <div className="odm-invoice-row">
                  <span className="odm-invoice-label">No. Invoice</span>
                  <code className="odm-invoice-value">{invoice.invoice_number}</code>
                </div>
                <div className="odm-invoice-row">
                  <span className="odm-invoice-label">Total</span>
                  <span className="odm-invoice-value"><strong>{formatCurrency(invoice.total)}</strong></span>
                </div>
                <div className="odm-invoice-row">
                  <span className="odm-invoice-label">Status Bayar</span>
                  <span className="odm-invoice-value">
                    {(() => {
                      const sc = { paid: { label: 'Lunas', color: '#166534', bg: '#dcfce7' }, unpaid: { label: 'Belum Bayar', color: '#b91c1c', bg: '#fee2e2' }, partial: { label: 'Partial', color: '#92400e', bg: '#fef3c7' } };
                      const s = sc[invoice.payment_status] || { label: invoice.payment_status, color: '#333', bg: '#eee' };
                      return <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 700 }}>{s.label}</span>;
                    })()}
                  </span>
                </div>
                {invoice.payment_method && (
                  <div className="odm-invoice-row">
                    <span className="odm-invoice-label">Metode Bayar</span>
                    <span className="odm-invoice-value">{invoice.payment_method}</span>
                  </div>
                )}
                {!invoice.locked && (actorRole === 'admin' || actorRole === 'cashier' || actorRole === 'owner') && (
                  <div className="odm-invoice-update">
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        Status
                        <select className="adm-input" style={{ fontSize: '13px', padding: '6px 10px' }} value={invoiceNewStatus} onChange={(e) => setInvoiceNewStatus(e.target.value)}>
                          <option value="unpaid">Belum Bayar</option>
                          <option value="partial">Partial</option>
                          <option value="paid">Lunas</option>
                        </select>
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        Metode Bayar
                        <select className="adm-input" style={{ fontSize: '13px', padding: '6px 10px' }} value={invoiceNewMethod} onChange={(e) => setInvoiceNewMethod(e.target.value)}>
                          <option value="">— Pilih —</option>
                          <option value="Transfer Bank">Transfer Bank</option>
                          <option value="QRIS">QRIS</option>
                          <option value="Tunai">Tunai</option>
                          <option value="COD">COD</option>
                        </select>
                      </label>
                      <button type="button" className="adm-btn adm-btn--primary" style={{ padding: '6px 14px', fontSize: '13px', alignSelf: 'flex-end' }} onClick={handleInvoiceStatusUpdate} disabled={invoiceStatusUpdating}>
                        {invoiceStatusUpdating ? 'Menyimpan…' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                )}
                {invoice.locked && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>🔒 Invoice sudah lunas dan terkunci.</div>}
                <div style={{ marginTop: '10px' }}>
                  <button type="button" className="adm-btn adm-btn--secondary" style={{ fontSize: '13px', padding: '6px 14px' }}
                    onClick={async () => {
                      try { await openInvoicePdf(invoice.id); }
                      catch { showToast('Gagal membuka PDF invoice.', 'error'); }
                    }}>
                    📄 PDF Invoice
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: '13px' }}>Invoice belum tersedia untuk pesanan ini.</div>
            )}
          </div>

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
