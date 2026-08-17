/**
 * AdminDashboardButton.jsx — Tombol shared "Dashboard Admin" (logo gear) untuk
 * semua role admin/staff. Navigasi ke path dashboard sesuai role user.
 *
 * Optional: prop `onClick` dijalankan sebelum navigasi (mis. reset ke section utama).
 */

import { useContext } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../context/AuthContext.jsx';
import { STAFF_ROLE_DASHBOARD_PATH } from '../../config/roles.js';

export default function AdminDashboardButton({ onClick, label = 'Dashboard Admin', className = '', title, style }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const path = STAFF_ROLE_DASHBOARD_PATH[user?.role];
  if (!path) return null;

  function handleClick() {
    if (typeof onClick === 'function') onClick();
    navigate(path);
  }

  return (
    <button
      type="button"
      className={`admin-dashboard-btn${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      title={title || 'Kembali ke dashboard admin'}
      aria-label="Kembali ke dashboard admin"
      style={style}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
