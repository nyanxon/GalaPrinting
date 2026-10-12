import Modal from '../ui/Modal.jsx';
import OfflineOrderSection from '../pages/subadmin/sections/OfflineOrderSection.jsx';

/**
 * EditOrderModal — modal untuk memperbaiki salah input pada pesanan
 * offline/custom. Membungkus OfflineOrderSection dalam mode edit
 * (form yang sama dengan input order offline, diisi data pesanan).
 *
 * @param {{ isOpen: boolean, onClose: fn, order: object, onSaved?: fn }} props
 */
function EditOrderModal({ isOpen, onClose, order, onSaved }) {
  if (!order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="edit-order-box">
        <OfflineOrderSection
          editOrder={order}
          onSaved={onSaved}
          onCancel={onClose}
        />
      </div>
    </Modal>
  );
}

export default EditOrderModal;
