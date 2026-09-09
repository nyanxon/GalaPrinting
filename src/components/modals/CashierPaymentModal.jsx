/**
 * CashierPaymentModal.jsx — Modal konfirmasi pembayaran SAAT Cashier menaikkan
 * status order ke 'Payment Accepted' (Waiting for Payment → Payment Accepted).
 *
 * Menanyakan:
 *   1. Metode pembayaran (Transfer Bank / QRIS / Tunai — TANPA COD, sama dengan invoice).
 *   2. Status pembayaran: Lunas atau DP.
 *   3. Jika DP → input nominal DP (validasi >0 dan < total, sama seperti invoice.service).
 *
 * Modal ini TAMBAHAN (bukan pengganti) gate bukti-bayar wajib untuk order source='offline'.
 * Data dikirim via updateOrderStatus(..., { paymentMethod, paymentStatus, dpAmount }) dan
 * ditulis backend ke invoices + orders.payment_method dalam satu transaksi dengan kenaikan status.
 */

import { useState, useEffect, useCallback } from 'react';
import { getInvoiceByOrderId } from '../../services/api/invoiceService.js';
import { formatCurrency } from '../../utils/format.js';

const PAYMENT_METHODS = ['Transfer Bank', 'QRIS', 'Tunai'];

export default function CashierPaymentModal({ order, onClose, onConfirm, busy = false }) {
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('paid'); // 'paid' | 'dp'
  const [dpAmount, setDpAmount] = useState('');
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingErr, setLoadingErr] = useState('');

  // Load invoice utk total tagihan (invoice dijamin ada saat transisi ke Payment Accepted).
  useEffect(() => {
    let cancelled = false;
    if (!order) return;
    setLoading(true);
    setLoadingErr('');
    getInvoiceByOrderId(order.id)
      .then((inv) => {
        if (cancelled) return;
        if (!inv) {
          setLoadingErr('Invoice untuk order ini belum ditemukan. Muat ulang halaman lalu coba lagi.');
          setLoading(false);
          return;
        }
        setTotal(Number(inv.total) || 0);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadingErr('Gagal memuat invoice untuk konfirmasi pembayaran.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [order]);

  // Validasi DP: > 0 dan < total (sama dengan invoice.service.js computeInvoicePayment).
  const dpNum = Number(dpAmount);
  const dpValid =
    status !== 'dp' ||
    (dpAmount !== '' && Number.isFinite(dpNum) && dpNum > 0 && dpNum < total);

  const formValid =
    method !== '' && (status === 'paid' || status === 'dp') && dpValid;

  const sisa = Math.max((total || 0) - (Number.isFinite(dpNum) ? dpNum : 0), 0);

  const handleSubmit = useCallback(() => {
    if (!formValid || loading || busy) return;
    onConfirm({
      paymentMethod: method,
      paymentStatus: status,
      dpAmount: status === 'dp' ? dpNum : null,
    });
  }, [formValid, loading, busy, method, status, dpNum, onConfirm]);

  if (!order) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        style={{
          background: '#fff', borderRadius: '12px', padding: '28px 32px',
          minWidth: '380px', maxWidth: '480px', width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700 }}>
          💳 Konfirmasi Pembayaran
        </h3>
        <p style={{ margin: '0 0 16px', color: '#555', fontSize: '13px' }}>
          Terima pembayaran untuk{' '}
          <code style={{ fontSize: '12px' }}>{order.orderNumber || order.id?.slice(0, 8)}</code>{' '}
          lalu naikkan status ke <strong>Payment Accepted</strong>.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#777', padding: '20px 0' }}>
            ⏳ Memuat total tagihan…
          </div>
        ) : loadingErr ? (
          <div style={{ color: 'var(--color-danger-dark)', background: 'var(--color-danger-bg)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
            {loadingErr}
          </div>
        ) : (
          <>
            {/* Total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              background: '#f4f6f8', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
            }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Total Tagihan</span>
              <span style={{ fontWeight: 700, fontSize: '15px' }}>{formatCurrency(total)}</span>
            </div>

            {/* Metode bayar */}
            <label style={{ display: 'block', marginBottom: '14px' }}>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '13px' }}>
                Metode Pembayaran
              </span>
              <select
                className="adm-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="">— Pilih —</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>

            {/* Status: Lunas / DP */}
            <div style={{ marginBottom: '14px' }}>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>
                Status Pembayaran
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStatus('paid')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: status === 'paid' ? '2px solid var(--color-success-dark)' : '1px solid #ddd',
                    background: status === 'paid' ? 'var(--color-success-border-light)' : '#fff',
                    color: status === 'paid' ? 'var(--color-success-dark)' : '#555',
                    fontWeight: 600, fontSize: '13px',
                  }}
                >
                  ✅ Lunas
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('dp')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: status === 'dp' ? '2px solid var(--color-warning)' : '1px solid #ddd',
                    background: status === 'dp' ? 'var(--color-warning-bg)' : '#fff',
                    color: status === 'dp' ? '#92400e' : '#555',
                    fontWeight: 600, fontSize: '13px',
                  }}
                >
                  💰 DP
                </button>
              </div>
            </div>

            {/* DP input kondisional */}
            {status === 'dp' && (
              <div style={{ marginBottom: '8px' }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '13px' }}>
                  Nominal DP
                </span>
                <input
                  className="adm-input"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={dpAmount}
                  onChange={(e) => setDpAmount(e.target.value)}
                />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: '#555',
                }}>
                  <span>Sisa: <strong>{formatCurrency(sisa)}</strong></span>
                  {!dpValid && (
                    <span style={{ color: 'var(--color-danger-dark)' }}>
                      DP harus &gt; 0 dan &lt; total
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="button" className="adm-btn" onClick={() => { if (!busy) onClose(); }}>
            {busy ? 'Memproses…' : 'Batal'}
          </button>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            disabled={!formValid || loading || !!loadingErr || busy}
            onClick={handleSubmit}
          >
            {busy ? 'Menyimpan…' : 'Konfirmasi & Terima Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  );
}
