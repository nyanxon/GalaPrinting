/**
 * RegisterPage.jsx
 *
 * Login and registration forms — split layout matching vanilla register.html.
 * On successful staff login, redirect to role-specific dashboard via useNavigate.
 * Requirements: 7.6, 13.4
 */

import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext.jsx';
import { login, registerCustomer, getCurrentUser } from '../../../services/authService.js';
import '../../../styles/css/pages/register.css';

const ROLE_PATHS = {
  admin: '/admin',
  owner: '/owner',
  cashier: '/cashier',
  cs: '/cs',
  operational: '/operational',
  qc: '/qc',
  offline: '/offline',
};

function RegisterPage() {
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  // 'register' | 'login'
  const [activeView, setActiveView] = useState('register');

  // Register form state
  const [registerData, setRegisterData] = useState({
    name: '',
    phone: '',
    gender: '',
    dob_day: '',
    dob_month: '',
    dob_year: '',
    email: '',
    password: '',
  });
  const [registerAlert, setRegisterAlert] = useState(null);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  // Login form state
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginAlert, setLoginAlert] = useState(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // If already logged in, redirect
  if (user) {
    const path = ROLE_PATHS[user.role] || '/';
    navigate(path, { replace: true });
    return null;
  }

  function handleRegisterChange(e) {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setRegisterAlert(null);

    // Validasi semua field wajib sebelum kirim ke server
    const { name, phone, gender, dob_day, dob_month, dob_year, email, password } = registerData;

    if (!name.trim()) {
      setRegisterAlert({ message: 'Nama lengkap wajib diisi.', type: 'error' });
      return;
    }
    if (!phone.trim()) {
      setRegisterAlert({ message: 'Nomor handphone wajib diisi.', type: 'error' });
      return;
    }
    if (!gender) {
      setRegisterAlert({ message: 'Jenis kelamin wajib dipilih.', type: 'error' });
      return;
    }
    if (!dob_day || !dob_month || !dob_year) {
      setRegisterAlert({ message: 'Tanggal lahir wajib diisi lengkap (tanggal, bulan, dan tahun).', type: 'error' });
      return;
    }
    if (!email.trim()) {
      setRegisterAlert({ message: 'Email wajib diisi.', type: 'error' });
      return;
    }
    if (!password || password.length < 6) {
      setRegisterAlert({ message: 'Password minimal 6 karakter.', type: 'error' });
      return;
    }

    setRegisterSubmitting(true);
    try {
      const dob = `${dob_year}-${String(dob_month).padStart(2, '0')}-${String(dob_day).padStart(2, '0')}`;
      const res = await Promise.resolve(registerCustomer({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        gender,
        dob,
      }));
      if (!res.ok) {
        setRegisterAlert({ message: res.message, type: 'error' });
        return;
      }
      setRegisterAlert({ message: res.message, type: 'info' });
      updateUser(await Promise.resolve(getCurrentUser()));
      navigate('/products');
    } finally {
      setRegisterSubmitting(false);
    }
  }

  function handleLoginChange(e) {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginAlert(null);
    setLoginSubmitting(true);
    try {
      const res = await Promise.resolve(login({ email: loginData.email, password: loginData.password }));
      if (!res.ok) {
        setLoginAlert({ message: res.message, type: 'error' });
        return;
      }
      const currentUser = await Promise.resolve(getCurrentUser());
      updateUser(currentUser);
      const path = ROLE_PATHS[res.role] || '/';
      navigate(path, { replace: true });
    } finally {
      setLoginSubmitting(false);
    }
  }

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => currentYear - i);

  return (
    <main className="register-layout">
      {/* Left: Photo / Banner */}
      <div className="register-photo" aria-hidden="true">
        <span className="register-photo-label">FOTO</span>
      </div>

      {/* Right: Form */}
      <div className="register-form-side">
        {/* Dynamic title — changes based on active view */}
        <h1 className="register-title">
          {activeView === 'register' ? 'Daftar / Register' : 'Masuk / Log In'}
        </h1>

        {/* ── Register form ── */}
        {activeView === 'register' && (
          <>
            {registerAlert && (
              <div className="alert muted" role="alert" data-register-alert>
                {registerAlert.message}
              </div>
            )}

            <form
              className="register-form"
              data-register-form
              onSubmit={handleRegisterSubmit}
              noValidate
            >
              {/* Nama Lengkap */}
              <div className="register-field">
                <input
                  className="register-input"
                  name="name"
                  type="text"
                  placeholder="Nama Lengkap"
                  autoComplete="name"
                  required
                  aria-label="Nama Lengkap"
                  value={registerData.name}
                  onChange={handleRegisterChange}
                />
                <span className="register-field-hint">Masukkan Nama Lengkap Anda</span>
              </div>

              {/* Nomor Handphone */}
              <div className="register-field">
                <input
                  className="register-input"
                  name="phone"
                  type="tel"
                  placeholder="Nomor Handphone"
                  autoComplete="tel"
                  required
                  aria-label="Nomor Handphone"
                  value={registerData.phone}
                  onChange={handleRegisterChange}
                />
                <span className="register-field-hint">Pastikan Nomor Handphone Aktif</span>
              </div>

              {/* Jenis Kelamin */}
              <div className="register-field">
                <select
                  className="register-input register-select"
                  name="gender"
                  required
                  aria-label="Jenis Kelamin"
                  value={registerData.gender}
                  onChange={handleRegisterChange}
                >
                  <option value="" disabled>Jenis Kelamin</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
                <span className="register-field-hint">Pilih Jenis Kelamin</span>
              </div>

              {/* Tanggal Lahir */}
              <div className="register-field">
                <div className="register-dob-row">
                  <select
                    className="register-input register-select register-dob-select"
                    name="dob_day"
                    required
                    aria-label="Tanggal lahir"
                    value={registerData.dob_day}
                    onChange={handleRegisterChange}
                  >
                    <option value="" disabled>Tanggal</option>
                    {days.map((d) => (
                      <option key={d} value={String(d)}>{d}</option>
                    ))}
                  </select>
                  <select
                    className="register-input register-select register-dob-select"
                    name="dob_month"
                    required
                    aria-label="Bulan lahir"
                    value={registerData.dob_month}
                    onChange={handleRegisterChange}
                  >
                    <option value="" disabled>Bulan</option>
                    {months.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    className="register-input register-select register-dob-select"
                    name="dob_year"
                    required
                    aria-label="Tahun lahir"
                    value={registerData.dob_year}
                    onChange={handleRegisterChange}
                  >
                    <option value="" disabled>Tahun</option>
                    {years.map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
                <span className="register-field-hint">Pilih Tanggal Lahir</span>
              </div>

              {/* Email */}
              <div className="register-field">
                <input
                  className="register-input"
                  name="email"
                  type="email"
                  placeholder="Email (Username)"
                  autoComplete="email"
                  required
                  aria-label="Email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                />
                <span className="register-field-hint">Masukkan Email untuk Username</span>
              </div>

              {/* Password */}
              <div className="register-field">
                <input
                  className="register-input"
                  name="password"
                  type="password"
                  placeholder="Password"
                  minLength={6}
                  required
                  aria-label="Password"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                />
                <span className="register-field-hint">Minimal 6 Karakter kombinasi Angka dan Huruf</span>
              </div>

              <button className="btn register-submit-btn" type="submit" disabled={registerSubmitting}>
                {registerSubmitting ? 'Memproses...' : 'DAFTAR AKUN'}
              </button>

              <p className="register-terms">
                Dengan menekan Daftar Akun, saya telah menyetujui{' '}
                <a href="#" className="register-link">Syarat dan Ketentuan</a>, serta{' '}
                <a href="#" className="register-link">Kebijakan Privasi</a> Gala Printing
              </p>

              <hr className="register-divider" />

              <p className="register-login-hint">
                Sudah punya akun?{' '}
                <a
                  href="#login"
                  className="register-link register-login-link"
                  data-show-login
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('login');
                    setRegisterAlert(null);
                  }}
                >
                  Silahkan Login
                </a>
              </p>
            </form>
          </>
        )}

        {/* ── Login section ── */}
        {activeView === 'login' && (
          <div className="register-login-section" id="login-section">
            {loginAlert && (
              <div className="alert muted" role="alert" data-login-alert>
                {loginAlert.message}
              </div>
            )}

            <form
              className="register-form"
              data-login-form
              onSubmit={handleLoginSubmit}
              noValidate
            >
              <div className="register-field">
                <input
                  className="register-input"
                  type="email"
                  name="email"
                  placeholder="Email (Username)"
                  autoComplete="email"
                  required
                  aria-label="Email"
                  value={loginData.email}
                  onChange={handleLoginChange}
                />
              </div>
              <div className="register-field">
                <input
                  className="register-input"
                  type="password"
                  name="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  aria-label="Password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                />
              </div>
              <button className="btn register-submit-btn" type="submit" disabled={loginSubmitting}>
                {loginSubmitting ? 'Memproses...' : 'MASUK'}
              </button>
              <p className="register-login-hint" style={{ marginTop: '12px' }}>
                Belum punya akun?{' '}
                <a
                  href="#register"
                  className="register-link"
                  data-show-register
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView('register');
                    setLoginAlert(null);
                  }}
                >
                  Daftar di sini
                </a>
              </p>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

export default RegisterPage;
