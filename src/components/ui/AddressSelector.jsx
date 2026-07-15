/**
 * AddressSelector.jsx
 *
 * Shown at checkout when customer is logged in.
 * - If addresses exist: shows a dropdown to pick one
 * - If no addresses: shows a prompt to add addresses first
 * - If still loading: shows nothing (avoids flash)
 *
 * Props:
 *   onSelect({ name, phone, address }) — called when user picks an address
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAddresses } from '../../services/addressService.js';

function AddressSelector({ onSelect }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    getAddresses()
      .then((data) => {
        if (!cancelled) setAddresses(data ?? []);
      })
      .catch(() => {
        // Silently ignore errors — manual form remains available
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Still loading — render nothing to avoid flash
  if (loading) return null;

  // No saved addresses — prompt customer to add one first
  if (addresses.length === 0) {
    return (
      <div className="co-addr-empty-notice">
        <span className="co-addr-empty-icon">📍</span>
        <div className="co-addr-empty-text">
          <strong>{t('checkout.noSavedAddress')}</strong>
          <span>
            Silakan{' '}
            <Link to="/profile" className="co-addr-empty-link">
              {t('checkout.addAddressFirst')}
            </Link>{' '}
            {t('checkout.addAddressHint')}
          </span>
        </div>
      </div>
    );
  }

  function handleChange(e) {
    const id = e.target.value;
    if (!id) return;

    const selected = addresses.find((a) => String(a.id) === String(id));
    if (selected && onSelect) {
      onSelect({
        title:   selected.title,
        name:    selected.name,
        phone:   selected.phone,
        address: selected.full_address,
      });
    }
  }

  return (
    <div className="co-field">
      <label className="co-label" htmlFor="address-selector">
        {t('checkout.selectSavedAddress')}
      </label>
      <select
        className="co-input"
        id="address-selector"
        defaultValue=""
        onChange={handleChange}
      >
        <option value="">{t('checkout.selectAddressPlaceholder')}</option>
        {addresses.map((a) => (
          <option key={a.id} value={a.id}>
            {a.title}
          </option>
        ))}
      </select>
    </div>
  );
}

export default AddressSelector;
