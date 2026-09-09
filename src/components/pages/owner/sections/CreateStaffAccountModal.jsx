/**
 * CreateStaffAccountModal.jsx — Owner: create a new staff account from scratch.
 *
 * POST /api/admin-accounts
 * The new account gets must_change_password=true (forces change on first login).
 */

import { useState, useRef } from 'react';
import { createStaffAccount } from '../../../../services/adminManagement.js';
import { STAFF_ROLE_CONFIG } from '../../../../config/roles.js';
import { track } from '../../../../utils/activityTracker.js';

const STAFF_ROLES_ORDER = ['admin', 'cashier', 'cs', 'operational', 'qc', 'offline'];

export default function CreateStaffAccountModal({ onClose, onCreated }) {
  const [form, setForm]       = useState({ name: '', email: '', role: 'cashier', password: '' });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const overlayRef = useRef(null);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current && !submitting) onClose();
  }

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
    <div
      className="adm-modal-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-staff-title"
      onClick={handleOverlayClick}
    >
      <div className="adm-modal">

        {/* ── Header ── */}
        <div className="adm-modal-header">
          <h2 className="adm-modal-title" id="create-staff-title">
            Buat Akun Staff Baru
          </h2>
          <button
            className="adm-modal-close"
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            disabled={submitting}
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div className="adm-modal-body">
          {apiError && (
            <div className="adm-form-alert" role="alert">
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
              <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: 'var(--sp-1)' }}>
                Staff wajib mengganti password ini pada login pertama.
              </p>
            </div>

            {/* ── Actions ── */}
            <div className="adm-modal-actions" style={{ padding: '16px 0 0' }}>
              <button className="adm-btn" type="button" onClick={onClose} disabled={submitting}>
                Batal
              </button>
              <button className="adm-btn adm-btn--primary" type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan…' : 'Buat Akun'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}