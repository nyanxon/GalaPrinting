import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getAddresses, deleteAddress } from '../../services/addressService.js';
import AddressForm from './AddressForm.jsx';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const headerRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '8px',
};

const addBtnStyle = {
  padding: '8px 18px',
  borderRadius: '8px',
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
};

const addBtnDisabledStyle = {
  ...addBtnStyle,
  background: '#93c5fd',
  cursor: 'not-allowed',
};

const limitMsgStyle = {
  fontSize: '13px',
  color: '#dc2626',
  margin: '4px 0 0',
};

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '16px',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const cardTitleStyle = {
  fontWeight: '600',
  fontSize: '15px',
  color: '#111827',
  margin: 0,
};

const cardTextStyle = {
  fontSize: '14px',
  color: '#374151',
  margin: 0,
};

const cardActionsStyle = {
  display: 'flex',
  gap: '8px',
  marginTop: '8px',
};

const editBtnStyle = {
  padding: '6px 14px',
  borderRadius: '6px',
  border: '1px solid #2563eb',
  background: '#fff',
  color: '#2563eb',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500',
};

const deleteBtnStyle = {
  padding: '6px 14px',
  borderRadius: '6px',
  border: '1px solid #dc2626',
  background: '#fff',
  color: '#dc2626',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500',
};

const loadingStyle = {
  color: '#6b7280',
  fontSize: '14px',
  padding: '12px 0',
};

const errorMsgStyle = {
  color: '#dc2626',
  fontSize: '14px',
  padding: '12px',
  background: '#fef2f2',
  borderRadius: '8px',
  border: '1px solid #fecaca',
};

const emptyStyle = {
  color: '#6b7280',
  fontSize: '14px',
  padding: '12px 0',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AddressList — displays saved addresses with add/edit/delete functionality.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.8, 5.9, 5.10, 5.11
 */
export default function AddressList() {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AddressForm modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null); // null = create mode

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAddresses();
      setAddresses(data);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        t('address.loadFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // ---- Handlers ----

  function handleAddClick() {
    setEditingAddress(null);
    setFormOpen(true);
  }

  function handleEditClick(address) {
    setEditingAddress(address);
    setFormOpen(true);
  }

  async function handleDeleteClick(address) {
    const confirmed = window.confirm(t('address.delete') + ' ' + address.title + '?');
    if (!confirmed) return;

    try {
      await deleteAddress(address.id);
      await fetchAddresses();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        t('address.deleteFailed');
      alert(message);
    }
  }

  function handleFormClose() {
    setFormOpen(false);
    setEditingAddress(null);
  }

  async function handleFormSaved() {
    setFormOpen(false);
    setEditingAddress(null);
    await fetchAddresses();
  }

  // ---- Render ----

  const atLimit = addresses.length >= 10;

  return (
    <div style={sectionStyle}>
      {/* Header row: title + add button */}
      <div style={headerRowStyle}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
          {t('address.listTitle')}
        </h3>
        <div>
          <button
            type="button"
            style={atLimit ? addBtnDisabledStyle : addBtnStyle}
            onClick={atLimit ? undefined : handleAddClick}
            disabled={atLimit}
            aria-disabled={atLimit}
          >
            {t('address.addBtn')}
          </button>
          {atLimit && (
            <p style={limitMsgStyle}>{t('address.limitMsg')}</p>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && <p style={loadingStyle}>{t('address.loading')}</p>}

      {!loading && error && (
        <p style={errorMsgStyle}>{error}</p>
      )}

      {!loading && !error && addresses.length === 0 && (
        <p style={emptyStyle}>{t('address.empty')}</p>
      )}

      {!loading && !error && addresses.map((address) => (
        <div key={address.id} style={cardStyle}>
          <p style={cardTitleStyle}>{address.title}</p>
          <p style={cardTextStyle}><span style={{ color: '#6b7280', fontSize: '12px' }}>{t('address.recipient')}: </span>{address.name}</p>
          <p style={cardTextStyle}>{address.phone}</p>
          <p style={cardTextStyle}>{address.full_address}</p>
          <div style={cardActionsStyle}>
            <button
              type="button"
              style={editBtnStyle}
              onClick={() => handleEditClick(address)}
              aria-label={t('address.edit') + ' ' + address.title}
            >
              {t('address.edit')}
            </button>
            <button
              type="button"
              style={deleteBtnStyle}
              onClick={() => handleDeleteClick(address)}
              aria-label={t('address.delete') + ' ' + address.title}
            >
              {t('address.delete')}
            </button>
          </div>
        </div>
      ))}

      {/* AddressForm modal */}
      <AddressForm
        isOpen={formOpen}
        onClose={handleFormClose}
        onSaved={handleFormSaved}
        address={editingAddress}
      />
    </div>
  );
}
