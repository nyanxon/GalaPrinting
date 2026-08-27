/**
 * AdminLoginPage.jsx
 *
 * Staff-only login page at /admin/login.
 * Calls POST /api/auth/admin-login (queries users_admin only).
 * On success, redirects to role-specific staff dashboard.
 */

import { useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext.jsx';
import { adminLogin, getCurrentUser } from '../../../services/auth.js';
import { STAFF_ROLE_DASHBOARD_PATH } from '../../../config/roles.js';
import regImg from '../../../assets/register-page.png';
import '../../../styles/css/pages/register.css';

function AdminLoginPage() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // If already logged in, redirect to appropriate dashboard
  if (user) {
    const path = STAFF_ROLE_DASHBOARD_PATH[user.role] || '/register';
    navigate(path, { replace: true });
    return null;
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
        adminLogin({ email: loginData.email, password: loginData.password })
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
    <main className="register-layout">
      {/* Left: Photo / Banner */}
      <div className="register-photo" aria-hidden="true">
        <img src={regImg} alt="Gala Printing" className="register-img" />
        <span className="register-photo-label"></span>
      </div>

      {/* Right: Form */}
      <div className="register-form-side">
        <h1 className="register-title">Login Staff</h1>

        {loginError && (
          <div className="alert muted" role="alert">
            {loginError}
          </div>
        )}

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <div className="register-field">
            <input
              className={`register-input${loginFieldErrors.email ? ' error' : ''}`}
              type="email"
              name="email"
              placeholder="Email"
              autoComplete="email"
              required
              aria-label="Email"
              value={loginData.email}
              onChange={handleChange}
            />
            {loginFieldErrors.email && (
              <span className="register-field-error">{loginFieldErrors.email}</span>
            )}
          </div>

          <div className="register-field">
            <input
              className={`register-input${loginFieldErrors.password ? ' error' : ''}`}
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              aria-label="Password"
              value={loginData.password}
              onChange={handleChange}
            />
            {loginFieldErrors.password && (
              <span className="register-field-error">{loginFieldErrors.password}</span>
            )}
          </div>

          <button className="btn register-submit-btn" type="submit" disabled={loginSubmitting}>
            {loginSubmitting ? 'Memproses...' : 'MASUK'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default AdminLoginPage;
