/**
 * PortfolioPage.jsx
 *
 * Static portfolio/gallery page.
 * Requirements: 7.9, 13.4
 */

import { Link } from 'react-router-dom';
import '../../../styles/css/pages/portfolio.css';

function PortfolioPage() {
  return (
    <main className="container content-page">
      <h1 className="page-title">Portofolio</h1>
      <p className="muted">Contoh hasil pekerjaan (sementara masih mock).</p>

      <section className="portfolio-grid grid cols-3">
        <div className="portfolio-item"><span>Stiker</span></div>
        <div className="portfolio-item"><span>Brosur</span></div>
        <div className="portfolio-item"><span>Kartu Nama</span></div>
        <div className="portfolio-item"><span>Banner</span></div>
        <div className="portfolio-item"><span>Packaging</span></div>
        <div className="portfolio-item"><span>Custom</span></div>
      </section>

      <section className="card" style={{ marginTop: '16px' }}>
        <div className="card-body">
          <h2 className="section-title">Mau order custom?</h2>
          <div className="muted">Bisa. Untuk sekarang, pilih produk terdekat lalu tulis detail di kolom keterangan.</div>
          <div className="form-actions" style={{ marginTop: '10px' }}>
            <Link className="btn primary" to="/products">Ke Produk</Link>
            <Link className="btn" to="/cara-order">Cara Order</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default PortfolioPage;
