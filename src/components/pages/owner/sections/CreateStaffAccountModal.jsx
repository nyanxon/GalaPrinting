/**
 * CreateStaffAccountModal.jsx — Owner: create a new staff account from scratch.
 *
 * POST /api/admin-accounts
 * The new account gets must_change_password=true (forces change on first login).
 */

import { useState } from 'react';
import { createStaffAccount } from '../../../../services/adminManagement.js';
import { STAFF_ROLE_CONFIG } from '../../../../config/roles.js';
import { track } from '../../../../utils/activityTracker.js';

const STAFF_ROLES_ORDER = ['admin', 'cashier', 'cs', 'operational', 'qc', 'offline'];

export default function CreateStaffAccountModal({ onClose, onCreated }) {
  const [form, setForm]       = useState({ name: '', email: '', role: 'cashier', password: '' });
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
    if (!form.role) errs.role = 'Role wajib dipilih.';
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
      const res = await createStaffAccount({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        password: form.password,
      });
      if (res.ok) {
        track('Buat Akun Staff', {
          targetType: 'account', targetId: res.user?.id ?? null,
          metadata: { name: form.name?.trim(), email: form.email?.trim().toLowerCase(), role: form.role },
        });
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
    <div className="adm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-staff-title">
      <div className="adm-modal">
        <h3 className="adm-modal-title" id="create-staff-title">
          Buat Akun Staff Baru
        </h3>

        {apiError && (
          <div className="adm-form-alert" role="alert" style={{ color: '#c0392b', marginBottom: '12px' }}>
            {apiError}
          </div>
        )}

        <form className="adm-form" onSubmit={handleSubmit} noValidate>
          <div className="adm-field">
            <label className="adm-label" htmlFor="create-staff-name">Nama Lengkap</label>
            <input
              id="create-staff-name"
              className={`adm-input${errors.name ? ' error' : ''}`}
              type="text"
              name="name"
              placeholder="Nama staff"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
            />
            {errors.name && <span className="register-field-error">{errors.name}</span>}
          </div>

          <div className="adm-field">
            <label className="adm-label" htmlFor="create-staff-email">Email</label>
            <input
              id="create-staff-email"
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
            <label className="adm-label" htmlFor="create-staff-role">Role</label>
            <select
              id="create-staff-role"
              className={`adm-input${errors.role ? ' error' : ''}`}
              name="role"
              value={form.role}
              onChange={handleChange}
            >
              {STAFF_ROLES_ORDER.map((role) => (
                <option key={role} value={role}>
                  {STAFF_ROLE_CONFIG[role]?.label ?? role}
                </option>
              ))}
            </select>
            {errors.role && <span className="register-field-error">{errors.role}</span>}
          </div>

          <div className="adm-field">
            <label className="adm-label" htmlFor="create-staff-password">Password Sementara</label>
            <input
              id="create-staff-password"
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
              Staff wajib mengganti password ini pada login pertama.
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