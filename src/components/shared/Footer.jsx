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
                <a href="https://wa.me/6282177882929" className="footer-social-link" aria-label="WhatsApp">
                  {/* WhatsApp */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <rect width="24" height="24" rx="6" fill="#25D366" />
                    <path
                      fill="#fff"
                      d="M12 5a7 7 0 0 0-6.06 10.5L5 19l3.64-.95A7 7 0 1 0 12 5zm3.98 9.78c-.17.48-.98.91-1.35.97-.35.06-.79.09-1.28-.07-.3-.1-.69-.23-1.19-.45-2.09-.9-3.45-3.1-3.56-3.25-.11-.15-.85-1.13-.85-2.15 0-1.02.53-1.52.72-1.73.19-.21.42-.26.56-.26h.4c.13 0 .3-.05.46.34.17.41.57 1.39.62 1.49.05.1.08.22.02.35-.06.13-.09.21-.18.32-.09.11-.19.25-.27.33-.09.09-.18.19-.08.37.1.18.46.76.99 1.23.68.61 1.25.8 1.43.89.18.09.28.08.39-.05.11-.13.45-.52.57-.69.12-.17.24-.14.4-.08.17.06 1.06.5 1.24.59.18.09.3.13.34.21.05.08.05.47-.12.95z"
                    />
                  </svg>
                </a>
                <a href="https://www.tiktok.com/@galaprintbali" className="footer-social-link" aria-label="TikTok">
                  {/* TikTok */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                    <rect width="24" height="24" rx="6" fill="#010101"/>
                    <path d="M16.5 4h-2v8.5a2 2 0 11-2-2 2 2 0 01.5.07V8.07A4.5 4.5 0 1015 12.5V7.5a6 6 0 003.5 1.1V6.1A4 4 0 0116.5 4z" fill="#fff"/>
                  </svg>
                </a>
                <a href="https://www.instagram.com/galaprint.bali" className="footer-social-link" aria-label="Instagram">
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
                <a href="https://www.youtube.com/@GalaPrinting" className="footer-social-link" aria-label="YouTube">
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
