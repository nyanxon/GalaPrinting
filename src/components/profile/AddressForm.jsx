import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createAddress, updateAddress } from '../../services/addressService.js';

// ---------------------------------------------------------------------------
// Styles (same pattern as ImageCropper.jsx)
// ---------------------------------------------------------------------------

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '24px',
  width: '90%',
  maxWidth: '480px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const buttonRowStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '4px',
};

const cancelBtnStyle = {
  padding: '8px 20px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#374151',
};

const saveBtnStyle = {
  padding: '8px 20px',
  borderRadius: '8px',
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
};

const saveBtnDisabledStyle = {
  ...saveBtnStyle,
  background: '#93c5fd',
  cursor: 'not-allowed',
};

const errorStyle = {
  color: '#dc2626',
  fontSize: '13px',
  margin: '4px 0 0',
};

const apiErrorStyle = {
  color: '#dc2626',
  fontSize: '13px',
  margin: 0,
  padding: '8px 12px',
  background: '#fef2f2',
  borderRadius: '6px',
  border: '1px solid #fecaca',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AddressForm — modal form for creating or editing a saved address.
 *
 * Props:
 *   isOpen   {boolean}              — show/hide the modal
 *   onClose  {() => void}           — called when modal is closed/cancelled
 *   onSaved  {(address) => void}    — called after successful create or update
 *   address  {object|null}          — if provided, form is in edit mode (pre-filled);
 *                                     if null/undefined, form is in create mode
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9
 */
export default function AddressForm({ isOpen, onClose, onSaved, address }) {
  const isEditMode = Boolean(address);
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    title: '',
    name: '',
    phone: '',
    full_address: '',
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill form when editing an existing address
  useEffect(() => {
    if (isOpen) {
      if (address) {
        setFormData({
          title: address.title ?? '',
          name: address.name ?? '',
          phone: address.phone ?? '',
          full_address: address.full_address ?? '',
        });
      } else {
        setFormData({ title: '', name: '', phone: '', full_address: '' });
      }
      setErrors({});
      setApiError('');
    }
  }, [isOpen, address]);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  function validate() {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = t('address.errTitle');
    if (!formData.name.trim()) newErrors.name = t('address.errRecipient');
    if (!formData.phone.trim()) newErrors.phone = t('address.errPhone');
    if (!formData.full_address.trim()) newErrors.full_address = t('address.errFullAddress');
    return newErrors;
  }

  async function handleSave() {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setApiError('');

    try {
      let result;
      if (isEditMode) {
        result = await updateAddress(address.id, formData);
      } else {
        result = await createAddress(formData);
      }
      onSaved(result);
      handleClose();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Gagal menyimpan alamat.';
      setApiError(message);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setFormData({ title: '', name: '', phone: '', full_address: '' });
    setErrors({});
    setApiError('');
    setSaving(false);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditMode ? t('address.editTitle') : t('address.addTitle')}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
          {isEditMode ? t('address.editTitle') : t('address.addTitle')}
        </h2>

        {/* Judul */}
        <div className="co-field">
          <label className="co-label" htmlFor="addr-judul">
            {t('address.title')} <span aria-hidden="true" style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="addr-judul"
            className="co-input"
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder={t('address.titlePlaceholder')}
            autoComplete="off"
          />
          {errors.title && <p style={errorStyle}>{errors.title}</p>}
        </div>

        {/* Nama Penerima */}
        <div className="co-field">
          <label className="co-label" htmlFor="addr-nama">
            {t('address.recipientName')} <span aria-hidden="true" style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="addr-nama"
            className="co-input"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t('address.recipientNamePlaceholder')}
            autoComplete="name"
          />
          {errors.name && <p style={errorStyle}>{errors.name}</p>}
        </div>

        {/* Nomor Telepon */}
        <div className="co-field">
          <label className="co-label" htmlFor="addr-phone">
            {t('address.phone')} <span aria-hidden="true" style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="addr-phone"
            className="co-input"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder={t('address.phonePlaceholder')}
            autoComplete="tel"
          />
          {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
        </div>

        {/* Alamat Lengkap */}
        <div className="co-field">
          <label className="co-label" htmlFor="addr-full-address">
            {t('address.fullAddress')} <span aria-hidden="true" style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            id="addr-full-address"
            className="co-input"
            name="full_address"
            value={formData.full_address}
            onChange={handleChange}
            placeholder={t('address.fullAddressPlaceholder')}
            rows={4}
            style={{ resize: 'vertical' }}
          />
          {errors.full_address && <p style={errorStyle}>{errors.full_address}</p>}
        </div>

        {/* API error */}
        {apiError && <p style={apiErrorStyle}>{apiError}</p>}

        {/* Action buttons */}
        <div style={buttonRowStyle}>
          <button
            type="button"
            style={cancelBtnStyle}
            onClick={handleClose}
            disabled={saving}
          >
            {t('address.cancel')}
          </button>
          <button
            type="button"
            style={saving ? saveBtnDisabledStyle : saveBtnStyle}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('address.saving') : t('address.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
