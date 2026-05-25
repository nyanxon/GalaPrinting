/**
 * TentangKamiPage.jsx
 *
 * Static "About Us" page.
 * Requirements: 7.9, 13.4
 */

import { Link } from 'react-router-dom';
import '../../../styles/css/pages/tentangKami.css';

function TentangKamiPage() {
  return (
    <main className="container content-page">
      <h1 className="page-title">Tentang Kami</h1>
      <p className="muted">Kenalan dengan Gala Printing dan cara kami bantu kebutuhan cetakmu.</p>

      <section className="hero stack" aria-label="Ringkasan">
        <h2 className="section-title">Gala Printing</h2>
        <p>
          Kami melayani berbagai kebutuhan printing: stiker, brosur, kartu nama, banner, dan
          <strong> custom order</strong>. Fokus kami adalah hasil rapi, proses jelas, dan komunikasi cepat.
        </p>
        <div className="form-actions">
          <Link className="btn primary" to="/products">Lihat Produk</Link>
          <Link className="btn" to="/cara-order">Cara Order</Link>
        </div>
      </section>

      <section style={{ marginTop: '16px' }}>
        <div className="kpi">
          <div className="card">
            <div className="card-body">
              <div className="card-title">Bisa Custom</div>
              <div className="card-subtitle">Upload desain sendiri atau konsultasi dulu.</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="card-title">Proses Jelas</div>
              <div className="card-subtitle">Cek status order dengan nomor transaksi.</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="card-title">Beragam Produk</div>
              <div className="card-subtitle">Dari kebutuhan bisnis sampai event.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: '16px' }}>
        <div className="card-body">
          <h2 className="section-title">Pertanyaan umum</h2>
          <div className="stack">
            <div>
              <strong>Apakah bisa order dengan desain saya sendiri?</strong>
              <div className="muted">Bisa. Di halaman detail produk ada fitur upload file (mock).</div>
            </div>
            <div>
              <strong>Kalau belum punya desain?</strong>
              <div className="muted">Tulis kebutuhan di &quot;Keterangan&quot; dan nanti kita atur alurnya saat backend siap.</div>
            </div>
            <div>
              <strong>Bagaimana cek status?</strong>
              <div className="muted">Masuk ke halaman Status Order lalu masukkan nomor transaksi.</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default TentangKamiPage;
