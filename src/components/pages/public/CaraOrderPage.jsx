/**
 * CaraOrderPage.jsx
 *
 * Static content page explaining how to order.
 * Requirements: 7.9, 13.4
 */

import { Link } from 'react-router-dom';
import '../../../styles/css/pages/caraOrder.css';

function CaraOrderPage() {
  return (
    <main className="container content-page">
      <h1 className="page-title">Cara Order</h1>
      <p className="muted">Langkah singkat untuk pesan produk printing di Gala Printing.</p>

      <section className="card" style={{ marginTop: '16px' }}>
        <div className="card-body">
          <div className="steps">
            <div className="step">
              <div className="step-title">Pilih produk</div>
              <div className="muted">Buka halaman Produk lalu pilih item yang kamu mau.</div>
            </div>
            <div className="step">
              <div className="step-title">Atur opsi</div>
              <div className="muted">Pilih bahan, warna, ukuran print, jumlah, dan isi keterangan bila perlu.</div>
            </div>
            <div className="step">
              <div className="step-title">Upload desain</div>
              <div className="muted">Upload file desain (JPG/JPEG/PNG). Di mock ini kami simpan nama filenya dulu.</div>
            </div>
            <div className="step">
              <div className="step-title">Tambah ke keranjang</div>
              <div className="muted">Klik &quot;Tambah ke Keranjang&quot;, lalu cek ringkasan belanja kamu.</div>
            </div>
            <div className="step">
              <div className="step-title">Checkout</div>
              <div className="muted">Klik Checkout (Mock). Sistem akan membuat nomor transaksi untuk cek status.</div>
            </div>
            <div className="step">
              <div className="step-title">Cek status order</div>
              <div className="muted">Masukkan nomor transaksi di halaman Status Order.</div>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '14px' }}>
            <Link className="btn primary" to="/products">Mulai Belanja</Link>
            <Link className="btn" to="/status">Cek Status Order</Link>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: '16px' }}>
        <div className="card-body">
          <h2 className="section-title">Catatan</h2>
          <div className="muted">
            Saat backend sudah tersedia, alur checkout akan dilengkapi dengan alamat pengiriman, metode pembayaran,
            dan notifikasi otomatis.
          </div>
        </div>
      </section>
    </main>
  );
}

export default CaraOrderPage;
