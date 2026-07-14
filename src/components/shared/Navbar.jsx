import { useContext, useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext.jsx';
import { CartContext } from '../context/CartContext.jsx';
import { logout, login, getCurrentUser } from '../../services/authService.js';
import { listCategories } from '../../services/categoryService.js';
import { formatCurrency } from '../../core/helpers.js';
import { resolveApiUrl } from '../../core/httpClient.js';
import logoImg from '../../assets/logo.png';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import placeholderImg from '../../assets/placeholder.svg';

const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];

const STAFF_DASHBOARD = {
  admin:       { path: '/admin',       label: '⚙️ Admin' },
  owner:       { path: '/owner',       label: '👑 Owner' },
  cashier:     { path: '/cashier',     label: '💰 Kasir' },
  cs:          { path: '/cs',          label: '💬 CS' },
  operational: { path: '/operational', label: '🔧 Operasional' },
  qc:          { path: '/qc',          label: '✅ QC' },
  offline:     { path: '/offline',     label: '🏪 Offline' },
};

const STAFF_REDIRECT = {
  admin: '/admin', owner: '/owner', cashier: '/cashier',
  cs: '/cs', operational: '/operational', qc: '/qc', offline: '/offline',
};

function NavLink({ to, children }) {
  const location = useLocation();
  const isCurrent = location.pathname === to;
  return (
    <Link to={to} aria-current={isCurrent ? 'page' : undefined}>
      {children}
    </Link>
  );
}

function Navbar() {
  const { t } = useTranslation();
  const { user, updateUser } = useContext(AuthContext);
  const { items } = useContext(CartContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const [kategoriOpen, setKategoriOpen] = useState(false);
  const [cartOpen, setCartOpen]         = useState(false);
  const [profileOpen, setProfileOpen]   = useState(false);
  const [loginOpen, setLoginOpen]       = useState(false);

  const [loginEmail, setLoginEmail]         = useState('');
  const [loginPassword, setLoginPassword]   = useState('');
  const [loginError, setLoginError]         = useState('');
  const [loginFieldErrors, setLoginFieldErrors] = useState({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [searchValue, setSearchValue] = useState('');
  const [categories, setCategories]   = useState([]);



  const headerRef = useRef(null);

  const role    = user?.role ?? null;
  const isStaff = role !== null && STAFF_ROLES.includes(role);
  const showAsStaff = false; // Semua role mendapat navbar customer lengkap
  const cartCount = items.length;
  const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function closeAllPopups() {
    setKategoriOpen(false);
    setCartOpen(false);
    setProfileOpen(false);
    setLoginOpen(false);
  }

  async function togglePopup(name) {
    const wasOpen =
      name === 'kategori' ? kategoriOpen :
      name === 'cart'     ? cartOpen     :
      name === 'profile'  ? profileOpen  : loginOpen;

    closeAllPopups();
    if (!wasOpen) {
      if (name === 'kategori') {
        try { setCategories(await listCategories()); } catch (_err) { /* category load failure is non-fatal */ }
        setKategoriOpen(true);
      } else if (name === 'cart')    { setCartOpen(true); }
      else if (name === 'profile')   { setProfileOpen(true); }
      else if (name === 'login')     { setLoginOpen(true); }
    }
  }

  useEffect(() => {
    function handleDocClick(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setKategoriOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setKategoriOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function handleLogout() {
    await Promise.resolve(logout());
    updateUser(null);
    closeAllPopups();
    navigate('/');
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      const q = searchValue.trim();
      if (q) { navigate(`/products?q=${encodeURIComponent(q)}`); setSearchValue(''); closeAllPopups(); }
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError('');
    setLoginFieldErrors({});
    
    // Validasi frontend
    const errors = {};
    if (!loginEmail.trim()) errors.email = 'Email wajib diisi';
    if (!loginPassword) errors.password = 'Password wajib diisi';
    
    if (Object.keys(errors).length > 0) {
      setLoginFieldErrors(errors);
      return;
    }
    
    setLoginSubmitting(true);
    try {
      const res = await Promise.resolve(login({ email: loginEmail, password: loginPassword }));
      if (!res.ok) { setLoginError(res.message); return; }
      updateUser(await Promise.resolve(getCurrentUser()));
      closeAllPopups();
      if (STAFF_REDIRECT[res.role]) navigate(STAFF_REDIRECT[res.role]);
      else window.location.reload();
    } finally {
      setLoginSubmitting(false);
    }
  }

  return (
    <header className="site-header" data-component="navbar" ref={headerRef}>
      <div className="container">
        <nav className="navbar" aria-label="Main navigation">

          {/* Brand */}
          <Link className="brand" to="/">
            <img src={logoImg} alt="Gala Printing logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </Link>

          {/* Center: kategori + search (guests/customers only) */}
          {!showAsStaff && (
            <div className="navbar-center">
              <div className="navbar-kategori-wrap" style={{ position: 'relative' }}>
                <button
                  className="navbar-kategori-btn"
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={kategoriOpen}
                  onClick={(e) => { e.stopPropagation(); togglePopup('kategori'); }}
                >
                  {t('nav.category')} <span className="navbar-kategori-arrow">▾</span>
                </button>
                {kategoriOpen && (
                  <div className="navbar-popup kategori-popup" id="kategori-popup" role="listbox" aria-label={t('nav.category')}>
                    <div className="navbar-popup-arrow" />
                    <div className="kategori-popup-list">
                      {categories.length === 0 ? (
                        <div className="kategori-popup-item muted">{t('home.noCategory')}</div>
                      ) : (
                        categories.map((cat) => (
                          <Link key={cat.id} className="kategori-popup-item" to={`/products?cat=${encodeURIComponent(cat.name)}`} onClick={closeAllPopups}>
                            {cat.name}
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="navbar-search-wrap" style={{ border: '0.5px solid rgba(0,0,0,0.6)', borderRadius: '8px' }}>
                <input
                  className="navbar-search-input"
                  type="search"
                  placeholder={t('nav.searchProduct')}
                  aria-label={t('nav.searchProduct')}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
            </div>
          )}

          {/* Nav actions */}
          <div className="nav-actions">
            <>
                {/* Cart icon */}
                <div className="nav-cart-wrap" style={{ position: 'relative' }}>
                  <button
                    className="nav-cart-icon"
                    type="button"
                    aria-label={`${t('cart.title')}${cartCount > 0 ? `, ${cartCount} item` : ''}`}
                    onClick={(e) => { e.stopPropagation(); togglePopup('cart'); }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m12-9l2 9M9 21a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z" />
                    </svg>
                    {cartCount > 0 && <span className="nav-cart-badge" data-cart-count>{cartCount}</span>}
                  </button>

                  {cartOpen && (
                    <div className="navbar-popup cart-popup" id="cart-popup">
                      <div className="navbar-popup-arrow" />
                      <div className="cart-popup-body">
                        {items.length === 0 ? (
                          <p className="cart-popup-empty">{t('cart.empty')}</p>
                        ) : (
                          <>
                            <p className="cart-popup-total-label">{t('cart.total')} : {items.length} {t('cart.items')}</p>
                            <div className="cart-popup-items">
                              {items.map((item) => (
                                <div key={item.id} className="cart-popup-item">
                                  <span className="cart-popup-item-name">{item.name}</span>
                                  <span className="cart-popup-item-price">{formatCurrency(item.price * item.quantity)}</span>
                                  <span className="cart-popup-item-qty">{t('cart.quantity')}: {item.quantity}</span>
                                </div>
                              ))}
                            </div>
                            <div className="cart-popup-total-row">
                              <span>{t('cart.totalPrice')} :</span>
                              <span>{formatCurrency(cartTotal)}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <Link className="cart-popup-cta" to="/cart" onClick={closeAllPopups}>
                        {t('cart.viewCart')}
                      </Link>
                    </div>
                  )}
                </div>

                {/* Avatar / profile icon — opens profile popup for logged-in customers, login popup for guests */}
                <div className="nav-profile-wrap" style={{ position: 'relative' }}>
                  {user ? (
                    <>
                      <button
                        className="nav-avatar-btn"
                        type="button"
                        aria-label={t('nav.profileMenu')}
                        aria-haspopup="true"
                        aria-expanded={profileOpen}
                        onClick={(e) => { e.stopPropagation(); togglePopup('profile'); }}
                      >
                        {user.avatar_url ? (
                          <img
                            src={resolveApiUrl(user.avatar_url)}
                            alt="Foto profil"
                            className="nav-avatar-img"
                          />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="nav-avatar-svg">
                            <circle cx="16" cy="16" r="16" fill="#e0e0e0" />
                            <circle cx="16" cy="13" r="5" fill="#9e9e9e" />
                            <path d="M6 26c0-5.523 4.477-10 10-10s10 4.477 10 10" fill="#9e9e9e" />
                          </svg>
                        )}
                      </button>

                      {profileOpen && (
                        <div className="navbar-popup profile-popup" id="profile-popup">
                          <div className="navbar-popup-arrow profile-popup-arrow" />
                          {/* User info header */}
                          <div className="profile-popup-header">
                            <div className="profile-popup-avatar">
                              {user.avatar_url ? (
                                <img src={resolveApiUrl(user.avatar_url)} alt="Foto profil" className="profile-popup-avatar-img" />
                              ) : (
                                <svg viewBox="0 0 24 24" fill="currentColor" className="profile-popup-avatar-icon" aria-hidden="true">
                                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <div className="profile-popup-name">{user.name}</div>
                              <div className="profile-popup-email">{user.email}</div>
                            </div>
                          </div>
                          <div className="profile-popup-divider" />
                          {/* Menu items */}
                          <Link className="profile-popup-item" to="/profile" onClick={closeAllPopups}>
                            <span>👤</span> {t('nav.myProfile')}
                          </Link>
                          <Link className="profile-popup-item" to="/my-orders" onClick={closeAllPopups}>
                            <span>📦</span> {t('nav.myOrders')}
                          </Link>
                          <Link className="profile-popup-item" to="/profile" onClick={() => { closeAllPopups(); }} state={{ tab: 'addresses' }}>
                            <span>📍</span> {t('nav.addresses')}
                          </Link>
                          <Link className="profile-popup-item" to="/profile" onClick={closeAllPopups} state={{ tab: 'notifications' }}>
                            <span>🔔</span> {t('nav.notifications')}
                          </Link>
                          {role === 'admin' && (
                            <>
                              <div className="profile-popup-divider" />
                              <Link className="profile-popup-item profile-popup-admin-link" to="/admin" onClick={closeAllPopups}>
                                <span>⚙️</span> {t('nav.adminPage')}
                              </Link>
                            </>
                          )}
                          {role === 'owner' && (
                            <>
                              <div className="profile-popup-divider" />
                              <Link className="profile-popup-item profile-popup-admin-link" to="/owner" onClick={closeAllPopups}>
                                <span>👑</span> {t('nav.ownerPage')}
                              </Link>
                            </>
                          )}
                          {isStaff && role !== 'admin' && role !== 'owner' && STAFF_DASHBOARD[role] && (
                            <>
                              <div className="profile-popup-divider" />
                              <Link
                                className="profile-popup-item profile-popup-admin-link"
                                to={STAFF_DASHBOARD[role].path}
                                onClick={closeAllPopups}
                              >
                                <span>{STAFF_DASHBOARD[role].label.split(' ')[0]}</span>{' '}
                                {t('nav.dashboard')}
                              </Link>
                            </>
                          )}
                          <div className="profile-popup-divider" />
                          <button className="profile-popup-item profile-popup-logout" type="button" onClick={handleLogout}>
                            <span>🚪</span> {t('nav.logout')}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Guest: show person icon that opens login popup */}
                      <button
                        className="nav-avatar-btn"
                        type="button"
                        aria-label={t('nav.login')}
                        aria-haspopup="true"
                        aria-expanded={loginOpen}
                        onClick={(e) => { e.stopPropagation(); togglePopup('login'); }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="nav-avatar-svg">
                          <circle cx="16" cy="16" r="16" fill="#e0e0e0" />
                          <circle cx="16" cy="13" r="5" fill="#9e9e9e" />
                          <path d="M6 26c0-5.523 4.477-10 10-10s10 4.477 10 10" fill="#9e9e9e" />
                        </svg>
                      </button>

                      {loginOpen && (
                        <div className="navbar-popup login-popup" id="login-popup">
                          <div className="navbar-popup-arrow login-popup-arrow" />
                          <form className="login-popup-form" onSubmit={handleLoginSubmit} noValidate>
                            {loginError && <div className="login-popup-alert" role="alert">{loginError}</div>}
                            <div className="login-popup-field">
                              <input 
                                className={`login-popup-input${loginFieldErrors.email ? ' error' : ''}`}
                                type="email" 
                                name="email" 
                                placeholder={t('auth.username')} 
                                autoComplete="email" 
                                required 
                                aria-label="Email" 
                                value={loginEmail} 
                                onChange={(e) => { 
                                  setLoginEmail(e.target.value); 
                                  if (loginFieldErrors.email) setLoginFieldErrors((prev) => ({ ...prev, email: null }));
                                  if (loginError) setLoginError('');
                                }} 
                              />
                              {loginFieldErrors.email && <span className="login-popup-error">{loginFieldErrors.email}</span>}
                            </div>
                            <div className="login-popup-field">
                              <input 
                                className={`login-popup-input${loginFieldErrors.password ? ' error' : ''}`}
                                type="password" 
                                name="password" 
                                placeholder={t('auth.password')} 
                                autoComplete="current-password" 
                                required 
                                aria-label="Password" 
                                value={loginPassword} 
                                onChange={(e) => { 
                                  setLoginPassword(e.target.value); 
                                  if (loginFieldErrors.password) setLoginFieldErrors((prev) => ({ ...prev, password: null }));
                                  if (loginError) setLoginError('');
                                }} 
                              />
                              {loginFieldErrors.password && <span className="login-popup-error">{loginFieldErrors.password}</span>}
                            </div>
                            <div className="login-popup-row">
                              <label className="login-popup-remember">
                                <input type="checkbox" name="remember" /> {t('auth.rememberMe')}
                              </label>
                              <Link to="/forgot-password" className="login-popup-forgot" onClick={closeAllPopups}>{t('auth.forgotPassword')}</Link>
                            </div>
                            <button className="login-popup-submit" type="submit" disabled={loginSubmitting}>
                              {loginSubmitting ? t('auth.processing') : t('auth.loginButton')}
                            </button>
                            <p className="login-popup-register-hint">
                              {t('auth.noAccount')}{' '}
                              <Link to="/register" className="login-popup-forgot" onClick={closeAllPopups}>{t('auth.registerHere')}</Link>
                            </p>
                          </form>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>

            {/* Mobile menu toggle */}
            <button className="nav-toggle" type="button" aria-label={t('nav.openMenu')} aria-expanded={mobileOpen} onClick={() => setMobileOpen((prev) => !prev)}>
              ☰
            </button>
          </div>

          {/* Language Switcher — desktop (hidden on mobile via CSS) */}
          <div className="lang-switcher-desktop-wrap">
            <LanguageSwitcher />
          </div>
        </nav>

        {/* Secondary nav */}
        {!showAsStaff && (
          <div className="navbar-secondary">
            <NavLink to="/tentang-kami">{t('nav.about')}</NavLink>

            {/* ── Produk Kami — now a direct link to /products ── */}
            <NavLink to="/products">{t('nav.ourProducts')}</NavLink>

            <NavLink to="/cara-order">{t('nav.howToOrder')}</NavLink>
            <NavLink to="/status">{t('nav.orderStatus')}</NavLink>
            <NavLink to="/portfolio">{t('nav.portfolio')}</NavLink>
          </div>
        )}
      </div>

      {/* Mobile sidebar — rendered outside .container so it can be full-height fixed */}
      {!showAsStaff && (
        <>
          {/* Backdrop overlay */}
          <div
            className={`nav-sidebar-backdrop${mobileOpen ? ' open' : ''}`}
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />

          {/* Sidebar panel */}
          <nav
            className={`nav-mobile${mobileOpen ? ' open' : ''}`}
            aria-label="Menu mobile"
            aria-hidden={!mobileOpen}
            data-nav-mobile
          >
            {/* Sidebar header with close button */}
            <div className="nav-sidebar-header">
              <Link className="brand" to="/" onClick={() => setMobileOpen(false)}>
                <img src={logoImg} alt="Gala Printing logo" style={{ width: 48, height: 48 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </Link>
              <button
                className="nav-sidebar-close"
                type="button"
                aria-label={t('nav.closeMenu')}
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="nav-sidebar-links">
              <Link to="/" onClick={() => setMobileOpen(false)}>{t('nav.home')}</Link>
              <Link to="/tentang-kami" onClick={() => setMobileOpen(false)}>{t('nav.about')}</Link>

              {/* Produk Kami — now a direct link in mobile too */}
              <Link to="/products" onClick={() => setMobileOpen(false)}>{t('nav.ourProducts')}</Link>

              <Link to="/products" onClick={() => setMobileOpen(false)}>{t('nav.products')}</Link>
              <Link to="/portfolio" onClick={() => setMobileOpen(false)}>{t('nav.portfolio')}</Link>
              <Link to="/cara-order" onClick={() => setMobileOpen(false)}>{t('nav.howToOrder')}</Link>
              <Link to="/status" onClick={() => setMobileOpen(false)}>{t('nav.orderStatus')}</Link>
              {user && <Link to="/my-orders" onClick={() => setMobileOpen(false)}>{t('nav.myOrders')}</Link>}
              {user && <Link to="/profile" onClick={() => setMobileOpen(false)}>{t('nav.myProfile')}</Link>}
              {user && <Link to="/cart" onClick={() => setMobileOpen(false)}>{t('nav.cart')} ({cartCount})</Link>}
              {!user && <Link to="/register" onClick={() => setMobileOpen(false)}>{t('nav.register')}</Link>}
              {user && (
                <button className="nav-mobile-logout" type="button" onClick={handleLogout}>
                  {t('nav.logout')}
                </button>
              )}

              {/* Language Switcher — inside sidebar (mobile only) */}
              <div className="nav-sidebar-lang">
                <span className="nav-sidebar-lang-label">{t('nav.language') || 'Bahasa'}</span>
                <LanguageSwitcher />
              </div>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}

export default Navbar;
