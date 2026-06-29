import { useContext, useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { CartContext } from '../context/CartContext.jsx';
import { logout, login, getCurrentUser } from '../../services/authService.js';
import { listCategories } from '../../services/categoryService.js';
import { formatCurrency } from '../../core/helpers.js';
import { resolveApiUrl } from '../../core/httpClient.js';
import logoImg from '../../assets/logo.png';

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
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [searchValue, setSearchValue] = useState('');
  const [categories, setCategories]   = useState([]);

  const headerRef = useRef(null);

  const role    = user?.role ?? null;
  const isStaff = role !== null && STAFF_ROLES.includes(role);
  // Admin users can browse the public homepage — show the full profile popup for them
  // Other staff (cashier, cs, etc.) still get the simple staff nav bar
  const showAsStaff = isStaff && role !== 'admin';
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
        // Only close kategori and profile on outside click.
        // Login and cart popups stay open until the user explicitly toggles them.
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
        // Only close kategori and profile with Escape — login and cart need explicit toggle.
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
                  Kategori <span className="navbar-kategori-arrow">▾</span>
                </button>
                {kategoriOpen && (
                  <div className="navbar-popup kategori-popup" id="kategori-popup" role="listbox" aria-label="Daftar kategori">
                    <div className="navbar-popup-arrow" />
                    <div className="kategori-popup-list">
                      {categories.length === 0 ? (
                        <div className="kategori-popup-item muted">Belum ada kategori</div>
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
                  placeholder="Cari Produk"
                  aria-label="Cari produk"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
            </div>
          )}

          {/* Nav actions */}
          <div className="nav-actions">
            {showAsStaff ? (
              <div className="nav-auth-group">
                {STAFF_DASHBOARD[role] && (
                  <Link className="nav-dashboard-link" to={STAFF_DASHBOARD[role].path}>
                    {STAFF_DASHBOARD[role].label}
                  </Link>
                )}
                <button className="btn ghost nav-auth-btn" type="button" onClick={handleLogout}>
                  Keluar
                </button>
              </div>
            ) : (
              <>
                {/* Cart icon */}
                <div className="nav-cart-wrap" style={{ position: 'relative' }}>
                  <button
                    className="nav-cart-icon"
                    type="button"
                    aria-label={`Keranjang${cartCount > 0 ? `, ${cartCount} item` : ''}`}
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
                          <p className="cart-popup-empty">Keranjang masih kosong.</p>
                        ) : (
                          <>
                            <p className="cart-popup-total-label">Total : {items.length} Barang</p>
                            <div className="cart-popup-items">
                              {items.map((item) => (
                                <div key={item.id} className="cart-popup-item">
                                  <span className="cart-popup-item-name">{item.name}</span>
                                  <span className="cart-popup-item-price">{formatCurrency(item.price * item.quantity)}</span>
                                  <span className="cart-popup-item-qty">Qty: {item.quantity}</span>
                                </div>
                              ))}
                            </div>
                            <div className="cart-popup-total-row">
                              <span>Total Harga :</span>
                              <span>{formatCurrency(cartTotal)}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <Link className="cart-popup-cta" to="/cart" onClick={closeAllPopups}>
                        Lihat Daftar Belanja
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
                        aria-label="Menu profil"
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
                            <span>👤</span> Profil
                          </Link>
                          <Link className="profile-popup-item" to="/my-orders" onClick={closeAllPopups}>
                            <span>📦</span> Pesanan Saya
                          </Link>
                          <Link className="profile-popup-item" to="/profile" onClick={() => { closeAllPopups(); }} state={{ tab: 'addresses' }}>
                            <span>📍</span> Daftar Alamat
                          </Link>
                          <Link className="profile-popup-item" to="/profile" onClick={closeAllPopups} state={{ tab: 'notifications' }}>
                            <span>🔔</span> Notifikasi
                          </Link>
                          {role === 'admin' && (
                            <>
                              <div className="profile-popup-divider" />
                              <Link className="profile-popup-item profile-popup-admin-link" to="/admin" onClick={closeAllPopups}>
                                <span>⚙️</span> Halaman Admin
                              </Link>
                            </>
                          )}
                          <div className="profile-popup-divider" />
                          <button className="profile-popup-item profile-popup-logout" type="button" onClick={handleLogout}>
                            <span>🚪</span> Keluar
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
                        aria-label="Masuk"
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
                            <input className="login-popup-input" type="email" name="email" placeholder="Username / Email" autoComplete="email" required aria-label="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                            <input className="login-popup-input" type="password" name="password" placeholder="Password" autoComplete="current-password" required aria-label="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                            <div className="login-popup-row">
                              <label className="login-popup-remember">
                                <input type="checkbox" name="remember" /> Ingat saya?
                              </label>
                              <Link to="/register" className="login-popup-forgot" onClick={closeAllPopups}>Lupa Password?</Link>
                            </div>
                            <button className="login-popup-submit" type="submit" disabled={loginSubmitting}>
                              {loginSubmitting ? 'Memproses...' : 'Masuk'}
                            </button>
                            <p className="login-popup-register-hint">
                              Belum punya akun?{' '}
                              <Link to="/register" className="login-popup-forgot" onClick={closeAllPopups}>Daftar di sini</Link>
                            </p>
                          </form>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Mobile menu toggle */}
            <button className="nav-toggle" type="button" aria-label="Buka menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen((prev) => !prev)}>
              ☰
            </button>
          </div>
        </nav>

        {/* Secondary nav */}
        {!showAsStaff && (
          <div className="navbar-secondary">
            <NavLink to="/tentang-kami">Tentang Kami</NavLink>
            <NavLink to="/cara-order">Cara Order</NavLink>
            <NavLink to="/status">Status Order</NavLink>
            <NavLink to="/portfolio">Portfolio</NavLink>
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
                aria-label="Tutup menu"
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="nav-sidebar-links">
              <Link to="/" onClick={() => setMobileOpen(false)}>Beranda</Link>
              <Link to="/products" onClick={() => setMobileOpen(false)}>Produk</Link>
              <Link to="/portfolio" onClick={() => setMobileOpen(false)}>Portfolio</Link>
              <Link to="/cara-order" onClick={() => setMobileOpen(false)}>Cara Order</Link>
              <Link to="/tentang-kami" onClick={() => setMobileOpen(false)}>Tentang Kami</Link>
              <Link to="/status" onClick={() => setMobileOpen(false)}>Status Order</Link>
              {user && <Link to="/my-orders" onClick={() => setMobileOpen(false)}>Pesanan Saya</Link>}
              {user && <Link to="/profile" onClick={() => setMobileOpen(false)}>Profil Saya</Link>}
              {user && <Link to="/cart" onClick={() => setMobileOpen(false)}>Keranjang ({cartCount})</Link>}
              {!user && <Link to="/register" onClick={() => setMobileOpen(false)}>Login / Daftar</Link>}
              {user && (
                <button className="nav-mobile-logout" type="button" onClick={handleLogout}>
                  Keluar
                </button>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}

export default Navbar;
