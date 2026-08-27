/**
 * AdminLoginPage.jsx
 *
 * Staff-only login page at /admin/login.
 * Calls POST /api/auth/admin-login (queries users_admin only).
 * On success, redirects to role-specific staff dashboard.
 * Gala brand theme: brown gradient background + centered login card.
 */

import { useState, useContext } from 'react';
import { useNavigate, Link, Navigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext.jsx';
import { adminLogin, getCurrentUser } from '../../../services/auth.js';
import { STAFF_ROLE_DASHBOARD_PATH } from '../../../config/roles.js';
import logoImg from '../../../assets/logo.png';
import '../../../styles/css/pages/admin-login.css';

function AdminLoginPage() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // If already logged in, redirect to the appropriate dashboard (declaratively —
  // calling navigate() during render leaves the tree blank/white).
  if (user) {
    const path = STAFF_ROLE_DASHBOARD_PATH[user.role] || '/register';
    return <Navigate to={path} replace />;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
    if (loginFieldErrors[name]) {
      setLoginFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (loginError) setLoginError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoginError('');
    setLoginFieldErrors({});

    const errors = {};
    if (!loginData.email.trim()) errors.email = 'Email wajib diisi';
    if (!loginData.password) errors.password = 'Password wajib diisi';

    if (Object.keys(errors).length > 0) {
      setLoginFieldErrors(errors);
      return;
    }

    setLoginSubmitting(true);
    try {
      const res = await Promise.resolve(
        adminLogin({ email: loginData.email, password: loginData.password, rememberMe })
      );
      if (!res.ok) {
        setLoginError(res.message);
        return;
      }
      const currentUser = await Promise.resolve(getCurrentUser());
      updateUser(currentUser);
      // If the account has must_change_password, force the user to change it first
      if (res.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }
      const path = STAFF_ROLE_DASHBOARD_PATH[res.role] || '/register';
      navigate(path, { replace: true });
    } finally {
      setLoginSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <div className="adm-login-card">
        <img
          src={logoImg}
          alt="Gala Printing logo"
          className="adm-login-logo"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />

        <h1 className="adm-login-title">Login Staff</h1>
        <p className="adm-login-subtitle">Masuk ke dashboard Gala Printing</p>

        {loginError && (
          <div className="adm-login-alert" role="alert">
            {loginError}
          </div>
        )}

        <form className="adm-login-form" onSubmit={handleSubmit} noValidate>
          <div className="adm-login-field">
            <label className="adm-login-label" htmlFor="admin-login-email">Email</label>
            <input
              id="admin-login-email"
              className={`adm-login-input${loginFieldErrors.email ? ' error' : ''}`}
              type="email"
              name="email"
              placeholder="nama@email.com"
              autoComplete="email"
              required
              value={loginData.email}
              onChange={handleChange}
            />
            {loginFieldErrors.email && (
              <span className="adm-login-field-error">{loginFieldErrors.email}</span>
            )}
          </div>

          <div className="adm-login-field">
            <label className="adm-login-label" htmlFor="admin-login-password">Password</label>
            <input
              id="admin-login-password"
              className={`adm-login-input${loginFieldErrors.password ? ' error' : ''}`}
              type="password"
              name="password"
              placeholder="• • • • • • • •"
              autoComplete="current-password"
              required
              value={loginData.password}
              onChange={handleChange}
            />
            {loginFieldErrors.password && (
              <span className="adm-login-field-error">{loginFieldErrors.password}</span>
            )}
          </div>

          <div className="adm-login-remember-row">
            <label className="adm-login-remember-label">
              <input
                className="adm-login-remember-checkbox"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                aria-label="Ingat saya selama 30 hari"
              />
              <span>Ingat saya</span>
            </label>
            <Link to="/forgot-password" className="adm-login-link">
              Lupa password?
            </Link>
          </div>

          <button className="adm-login-btn" type="submit" disabled={loginSubmitting}>
            {loginSubmitting ? 'Memproses...' : 'LOGIN'}
          </button>
        </form>

        <Link to="/" className="adm-login-back">
          ← Kembali ke website
        </Link>
      </div>
    </main>
  );
}

export default AdminLoginPage;