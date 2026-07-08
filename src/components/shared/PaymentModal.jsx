import { useState } from 'react';
import Modal from './Modal.jsx';
import DropZone from './DropZone.jsx';
import { formatCurrency } from '../../core/helpers.js';

/* ── QRIS SVG placeholder ────────────────────────────────── */
const QRIS_SVG = (
  <svg
    width="180"
    height="180"
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="QRIS Gala Printing"
  >
    <rect width="180" height="180" fill="#f9f5f0" rx="14" />
    <rect x="18" y="18" width="58" height="58" rx="5" fill="none" stroke="#785E40" strokeWidth="5" />
    <rect x="30" y="30" width="34" height="34" rx="3" fill="#785E40" />
    <rect x="104" y="18" width="58" height="58" rx="5" fill="none" stroke="#785E40" strokeWidth="5" />
    <rect x="116" y="30" width="34" height="34" rx="3" fill="#785E40" />
    <rect x="18" y="104" width="58" height="58" rx="5" fill="none" stroke="#785E40" strokeWidth="5" />
    <rect x="30" y="116" width="34" height="34" rx="3" fill="#785E40" />
    <rect x="104" y="104" width="12" height="12" fill="#785E40" />
    <rect x="122" y="104" width="12" height="12" fill="#785E40" />
    <rect x="140" y="104" width="22" height="12" fill="#785E40" />
    <rect x="104" y="122" width="22" height="12" fill="#785E40" />
    <rect x="132" y="122" width="16" height="12" fill="#785E40" />
    <rect x="104" y="140" width="12" height="22" fill="#785E40" />
    <rect x="122" y="140" width="18" height="12" fill="#785E40" />
    <rect x="146" y="134" width="16" height="28" fill="#785E40" />
    <text
      x="90"
      y="174"
      textAnchor="middle"
      fontSize="10"
      fill="#9b9b9b"
      fontFamily="sans-serif"
      fontWeight="600"
    >
      QRIS · Gala Printing Bali
    </text>
  </svg>
);

/**
 * PaymentModal component
 *
 * 2-step payment flow:
 *   Step 1 — Cara Pembayaran: QRIS + BCA transfer info, "Lanjutkan →" button
 *   Step 2 — Upload Bukti Pembayaran: drag & drop file upload with preview
 *
 * Wraps the <Modal> base component.
 *
 * Props:
 *   isOpen           {boolean}        — whether the modal is visible
 *   onClose          {() => void}     — called when the modal should close
 *   order            {object|null}    — the order being paid for (reads order.subtotal or order.total)
 *   subtotal         {number}         — subtotal amount (takes precedence over order.subtotal)
 *   onPaymentSubmit  {(result) => void} — called with { file, dataUrl, proof: { fileName, fileSize, mimeType, dataUrl } }
 *
 * Requirements: 8.1, 8.3, 8.4
 */
function PaymentModal({ isOpen, onClose, order, subtotal: subtotalProp, onPaymentSubmit, paymentError }) {
  const [step, setStep] = useState(1);
  const [proofFile, setProofFile] = useState(null);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [isImageFile, setIsImageFile] = useState(false);
  const [fileError, setFileError] = useState('');
  const [copyLabel, setCopyLabel] = useState('📋 Salin');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset to step 1 when modal closes
  function handleClose() {
    setStep(1);
    setProofFile(null);
    setPreviewDataUrl(null);
    setIsImageFile(false);
    setFileError('');
    setIsSubmitting(false);
    onClose();
  }

  function handleLanjutkan() {
    setStep(2);
  }

  function handleCopyAccount() {
    navigator.clipboard?.writeText('6485600063').catch(() => {});
    setCopyLabel('✅ Tersalin!');
    setTimeout(() => setCopyLabel('📋 Salin'), 2000);
  }

  function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    setFileError('');
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const imgExt = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'heic', 'heif']);
    const isImg = file.type.startsWith('image/') || imgExt.has(ext);
    setIsImageFile(isImg);
    setProofFile(file);
    if (isImg) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewDataUrl(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewDataUrl(null);
    }
  }

  function handleRemoveFile() {
    setProofFile(null);
    setPreviewDataUrl(null);
    setIsImageFile(false);
    setFileError('');
  }

  function handleSubmitProof(e) {
    e.preventDefault();
    if (!proofFile) {
      setFileError('Harap upload bukti pembayaran terlebih dahulu.');
      return;
    }
    setIsSubmitting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      if (onPaymentSubmit) {
        onPaymentSubmit({
          file: proofFile,
          dataUrl,
          proof: {
            fileName: proofFile.name,
            fileSize: proofFile.size,
            mimeType: proofFile.type,
            dataUrl,
          },
        });
      }
      // Note: do NOT call handleClose() here — the parent (MyOrdersPage)
      // controls whether the modal closes based on the upload result.
      setIsSubmitting(false);
    };
    reader.onerror = () => {
      setFileError('Gagal membaca file. Coba lagi.');
      setIsSubmitting(false);
    };
    reader.readAsDataURL(proofFile);
  }

  // Resolve subtotal: prop > order.subtotal > order.total > 0
  const subtotal = subtotalProp ?? order?.subtotal ?? order?.total ?? 0;
  const orderNumber = order?.id ?? '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="co-payment-modal">
        {/* Header */}
        <div className="co-payment-header">
          <div className="co-payment-header-left">
            {step === 2 && (
              <button
                className="co-payment-back-btn"
                type="button"
                aria-label="Kembali ke cara pembayaran"
                onClick={() => setStep(1)}
              >
                ← Kembali
              </button>
            )}
            <h2 className="co-payment-title" id="co-payment-title">
              {step === 1 ? '💳 Cara Pembayaran' : '🧾 Bukti Pembayaran'}
            </h2>
          </div>
          <button
            className="co-payment-close"
            type="button"
            aria-label="Tutup"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div className="co-step-indicator" aria-label="Langkah pembayaran">
          <div className={`co-step-dot${step === 1 ? ' co-step-dot--active' : ' co-step-dot--done'}`}>
            <span className="co-step-dot-num">1</span>
            <span className="co-step-dot-label">Cara Bayar</span>
          </div>
          <div className={`co-step-line${step === 2 ? ' co-step-line--done' : ''}`} />
          <div className={`co-step-dot${step === 2 ? ' co-step-dot--active' : ''}`}>
            <span className="co-step-dot-num">2</span>
            <span className="co-step-dot-label">Bukti Bayar</span>
          </div>
        </div>

        {/* Body */}
        <div className="co-payment-body">
          {step === 1 ? (
            /* Step 1: QRIS + BCA transfer */
            <div>
              <div className="co-payment-amount-box">
                <div className="co-payment-amount-label">Total yang harus dibayar</div>
                <div className="co-payment-amount">{formatCurrency(subtotal)}</div>
                <div className="co-payment-amount-note">
                  Pembayaran manual — transfer atau scan QRIS
                </div>
              </div>

              {orderNumber && (
                <p className="co-payment-order-number">
                  Order: <strong>#{orderNumber}</strong>
                </p>
              )}

              <div className="co-payment-methods">
                {/* QRIS */}
                <div className="co-payment-method">
                  <div className="co-payment-method-title">
                    <span className="co-payment-method-icon">📱</span>Scan QRIS
                  </div>
                  <div className="co-payment-qr-wrap">
                    <div className="co-payment-qr-placeholder">
                      <div className="co-payment-qr-box">{QRIS_SVG}</div>
                      <p className="co-payment-qr-note">
                        Scan dengan e-wallet atau m-banking apapun
                      </p>
                    </div>
                  </div>
                </div>

                <div className="co-payment-divider">atau</div>

                {/* BCA Transfer */}
                <div className="co-payment-method">
                  <div className="co-payment-method-title">
                    <span className="co-payment-method-icon">🏦</span>Transfer BCA
                  </div>
                  <div className="co-payment-bank-info">
                    <div className="co-payment-bank-logo">BCA</div>
                    <div className="co-payment-bank-detail">
                      <div className="co-payment-bank-row">
                        <span className="co-payment-bank-label">No. Rekening</span>
                        <div className="co-payment-bank-value-wrap">
                          <strong className="co-payment-bank-value">6485600063</strong>
                          <button
                            className="co-payment-copy-btn"
                            type="button"
                            onClick={handleCopyAccount}
                          >
                            {copyLabel}
                          </button>
                        </div>
                      </div>
                      <div className="co-payment-bank-row">
                        <span className="co-payment-bank-label">Atas Nama</span>
                        <strong className="co-payment-bank-value">Gala Agung Jaya CV</strong>
                      </div>
                      <div className="co-payment-bank-row">
                        <span className="co-payment-bank-label">Nominal</span>
                        <strong className="co-payment-bank-value co-payment-bank-amount">
                          {formatCurrency(subtotal)}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="co-payment-bank-note">
                    ⚠️ Pastikan nominal transfer sesuai persis. Kasir Admin akan memverifikasi.
                  </div>
                </div>
              </div>

              <div className="co-payment-steps">
                <div className="co-payment-steps-title">Langkah selanjutnya:</div>
                <ol className="co-payment-steps-list">
                  <li>Lakukan pembayaran via QRIS atau transfer BCA di atas</li>
                  <li>
                    Klik <strong>&ldquo;Lanjutkan&rdquo;</strong> lalu upload bukti pembayaran
                  </li>
                  <li>Kasir Admin akan memverifikasi pembayaran kamu</li>
                  <li>
                    Pantau status di halaman <strong>Pesanan Saya</strong>
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            /* Step 2: Proof of payment upload */
            <form onSubmit={handleSubmitProof} noValidate>
              <div className="co-proof-header-box">
                <div className="co-proof-header-icon">🧾</div>
                <div>
                  <div className="co-proof-header-title">Kirim Bukti Pembayaran</div>
                  <div className="co-proof-header-sub">
                    Total: <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                </div>
              </div>

              {/* Upload area with drag & drop */}
              {!proofFile && (
                <DropZone
                  accept="image/*,.pdf,.zip,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.heic,application/zip"
                  maxSize={100 * 1024 * 1024} // 100 MB (updated from 10 MB)
                  onFiles={handleFiles}
                  label={<><strong>Klik untuk pilih file</strong> atau drag &amp; drop di sini</>}
                  hint="JPG, PNG, GIF, WEBP, BMP, HEIC, PDF, ZIP — Maks. 100 MB"
                  className="co-proof-upload-area"
                />
              )}

              {/* File preview */}
              {proofFile && (
                <div className="co-proof-preview">
                  <div className="co-proof-preview-inner">
                    {isImageFile && previewDataUrl ? (
                      <img
                        src={previewDataUrl}
                        alt="Preview"
                        className="co-proof-preview-img"
                      />
                    ) : (
                      <div className="co-proof-preview-file">
                        <span className="co-proof-preview-file-icon">📄</span>
                        <span>{proofFile.name}</span>
                      </div>
                    )}
                    <button
                      className="co-proof-remove-btn"
                      type="button"
                      onClick={handleRemoveFile}
                    >
                      ✕ Ganti File
                    </button>
                  </div>
                </div>
              )}

              {fileError && (
                <div className="co-proof-error" role="alert">
                  {fileError}
                </div>
              )}

              {paymentError && (
                <div className="co-proof-error" role="alert">
                  {paymentError}
                </div>
              )}

              <div className="co-proof-note">
                <span>💡</span>
                <span>
                  Pastikan bukti pembayaran terlihat jelas — nominal, tanggal, dan nama pengirim
                  harus terbaca.
                </span>
              </div>

              <div className="co-payment-footer">
                <button
                  className="co-payment-confirm-btn"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Memproses…' : '✅ Konfirmasi Pembayaran'}
                </button>
                <button
                  className="co-payment-cancel-btn"
                  type="button"
                  onClick={() => setStep(1)}
                >
                  ← Kembali ke Cara Pembayaran
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer — Step 1 only */}
        {step === 1 && (
          <div className="co-payment-footer">
            <button
              className="co-payment-confirm-btn"
              type="button"
              onClick={handleLanjutkan}
            >
              Lanjutkan →
            </button>
            <button
              className="co-payment-cancel-btn"
              type="button"
              onClick={handleClose}
            >
              Kembali
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default PaymentModal;
