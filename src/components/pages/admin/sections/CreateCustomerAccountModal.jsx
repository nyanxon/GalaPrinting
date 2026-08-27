/**
 * CreateCustomerAccountModal.jsx — Admin/Owner/CS: create a new customer account.
 *
 * POST /api/admin/accounts/customers
 * The admin hands the initial password to the customer out-of-band (no email sent).
 */

import { useState } from 'react';
import { createCustomerAccount } from '../../../../services/accounts.js';

export default function CreateCustomerAccountModal({ onClose, onCreated }) {
  const [form, setForm]       = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    if (apiError) setApiError('');
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Nama wajib diisi.';
    if (!form.email.trim()) errs.email = 'Email wajib diisi.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Format email tidak valid.';
    if (!form.password) errs.password = 'Password wajib diisi.';
    else if (form.password.length < 6) errs.password = 'Password minimal 6 karakter.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await createCustomerAccount({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        password: form.password,
      });
      if (res.ok) {
        onCreated(res.user);
        onClose();
      } else {
        setApiError(res.message);
      }
    } catch (_err) {
      setApiError('Terjadi kesalahan. Coba lagi nanti.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="adm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-customer-title">
      <div className="adm-modal">
        <h3 className="adm-modal-title" id="create-customer-title">
          Buat Akun Customer Baru
        </h3>

        {apiError && (
          <div className="adm-form-alert" role="alert" style={{ color: '#c0392b', marginBottom: '12px' }}>
            {apiError}
          </div>
        )}

        <form className="adm-form" onSubmit={handleSubmit} noValidate>
          <div className="adm-field">
            <label className="adm-label" htmlFor="create-customer-name">Nama Lengkap</label>
            <input
              id="create-customer-name"
              className={`adm-input${errors.name ? ' error' : ''}`}
              type="text"
              name="name"
              placeholder="Nama customer"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
            />
            {errors.name && <span className="register-field-error">{errors.name}</span>}
          </div>

          <div className="adm-field">
            <label className="adm-label" htmlFor="create-customer-email">Email</label>
            <input
              id="create-customer-email"
              className={`adm-input${errors.email ? ' error' : ''}`}
              type="email"
              name="email"
              placeholder="email@example.com"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
            />
            {errors.email && <span className="register-field-error">{errors.email}</span>}
          </div>

          <div className="adm-field">
            <label className="adm-label" htmlFor="create-customer-phone">No. WhatsApp</label>
            <input
              id="create-customer-phone"
              className="adm-input"
              type="tel"
              name="phone"
              placeholder="08xxxxxxx"
              autoComplete="tel"
              value={form.phone}
              onChange={handleChange}
            />
          </div>

          <div className="adm-field">
            <label className="adm-label" htmlFor="create-customer-password">Password Sementara</label>
            <input
              id="create-customer-password"
              className={`adm-input${errors.password ? ' error' : ''}`}
              type="password"
              name="password"
              placeholder="Minimal 6 karakter"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
            />
            {errors.password && <span className="register-field-error">{errors.password}</span>}
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: 4 }}>
              Serahkan password ini langsung ke customer (tidak dikirim via email).
            </p>
          </div>

          <div className="adm-modal-actions">
            <button className="adm-btn adm-btn-secondary" type="button" onClick={onClose} disabled={submitting}>
              Batal
            </button>
            <button className="adm-btn adm-btn--primary" type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Buat Akun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}