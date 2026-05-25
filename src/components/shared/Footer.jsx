import { Link } from 'react-router-dom';
import { APP } from '../../core/config.js';

/**
 * Footer component
 *
 * Renders the site footer equivalent to vanilla footer.js.
 * Preserves all aria-* and role attributes.
 * Uses Link from react-router-dom for internal links.
 *
 * Requirements: 6.2, 15.1, 15.2
 */
function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" data-component="footer">
      <div className="container">
        <div className="footer-inner">

          <div className="footer-top">
            {/* Left: brand + links + tagline */}
            <div className="footer-left">
              <strong className="footer-brand">{APP.name}</strong>
              <div className="footer-links" aria-label="Tautan footer">
                <Link to="/products">Produk</Link>
                <Link to="/cara-order">Cara Order</Link>
                <Link to="/portfolio">Portofolio</Link>
                <Link to="/tentang-kami">Tentang Kami</Link>
              </div>
              <div className="muted footer-tagline">
                Cetak apa saja: kartu nama, brosur, banner, stiker, dan custom order.
              </div>
            </div>

            {/* Right: social media */}
            <div className="footer-social">
              <strong className="footer-social-title">Social Media</strong>
              <div className="footer-social-icons">
                <a href="#" className="footer-social-link" aria-label="Facebook">
                  {/* Facebook */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                    <rect width="24" height="24" rx="6" fill="#1877F2"/>
                    <path d="M16 8h-2a1 1 0 00-1 1v2h3l-.5 3H13v7h-3v-7H8v-3h2V9a4 4 0 014-4h2v3z" fill="#fff"/>
                  </svg>
                </a>
                <a href="#" className="footer-social-link" aria-label="TikTok">
                  {/* TikTok */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                    <rect width="24" height="24" rx="6" fill="#010101"/>
                    <path d="M16.5 4h-2v8.5a2 2 0 11-2-2 2 2 0 01.5.07V8.07A4.5 4.5 0 1015 12.5V7.5a6 6 0 003.5 1.1V6.1A4 4 0 0116.5 4z" fill="#fff"/>
                  </svg>
                </a>
                <a href="#" className="footer-social-link" aria-label="Instagram">
                  {/* Instagram */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                    <defs>
                      <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f09433"/>
                        <stop offset="50%" stopColor="#e6683c"/>
                        <stop offset="75%" stopColor="#dc2743"/>
                        <stop offset="100%" stopColor="#bc1888"/>
                      </linearGradient>
                    </defs>
                    <rect width="24" height="24" rx="6" fill="url(#ig)"/>
                    <rect x="6" y="6" width="12" height="12" rx="3.5" stroke="#fff" strokeWidth="1.5" fill="none"/>
                    <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.5" fill="none"/>
                    <circle cx="16" cy="8" r="1" fill="#fff"/>
                  </svg>
                </a>
                <a href="#" className="footer-social-link" aria-label="YouTube">
                  {/* YouTube */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                    <rect width="24" height="24" rx="6" fill="#FF0000"/>
                    <path d="M19.6 8.2a2 2 0 00-1.4-1.4C16.9 6.5 12 6.5 12 6.5s-4.9 0-6.2.3A2 2 0 004.4 8.2 20 20 0 004 12a20 20 0 00.4 3.8 2 2 0 001.4 1.4c1.3.3 6.2.3 6.2.3s4.9 0 6.2-.3a2 2 0 001.4-1.4A20 20 0 0020 12a20 20 0 00-.4-3.8z" fill="#fff"/>
                    <path d="M10 14.5l4-2.5-4-2.5v5z" fill="#FF0000"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {year} {APP.name}. All rights reserved.</span>
            <span className="muted">Bahasa: Indonesia</span>
          </div>

        </div>
      </div>
    </footer>
  );
}

export default Footer;
