import Modal from './Modal.jsx';

/**
 * ConfirmDialog — reusable confirmation popup.
 *
 * Props:
 *   isOpen       {boolean}    — visibility
 *   onClose      {() => void} — called when dismissed (backdrop / Escape / "Tidak")
 *   onConfirm    {() => void} — called when the confirm button is clicked
 *   title        {string}     — dialog heading
 *   message      {string}     — body text
 *   confirmLabel {string}     — label for the confirm button   (default: "Hapus")
 *   cancelLabel  {string}     — label for the cancel button    (default: "Tidak")
 *   confirmClass {string}     — extra CSS class on confirm btn (default: "danger")
 */
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi',
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Tidak',
  confirmClass = 'danger',
}) {
  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="modal" role="alertdialog" aria-labelledby="cdg-title" aria-describedby="cdg-msg">
        <div className="modal-header">
          <span className="modal-title" id="cdg-title">{title}</span>
        </div>
        {message && (
          <div className="modal-body" id="cdg-msg">
            {message}
          </div>
        )}
        <div className="modal-footer">
          {/* Cancel — secondary / ghost */}
          <button
            className="btn"
            type="button"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          {/* Confirm — danger (red) by default */}
          <button
            className={`btn ${confirmClass}`}
            type="button"
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
