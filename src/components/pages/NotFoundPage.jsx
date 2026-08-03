/**
 * NotFoundPage.jsx
 *
 * User-friendly 404 message with a link back to /.
 * Requirements: 2.2
 */

import { Link } from 'react-router';

function NotFoundPage() {
  return (
    <main>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }} aria-hidden="true">
          404
        </div>
        <h1 style={{ marginBottom: '0.5rem' }}>Halaman Tidak Ditemukan</h1>
        <p style={{ color: 'var(--text-muted, #666)', marginBottom: '1.5rem' }}>
          Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        <Link className="btn btn--primary" to="/">
          ← Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}

export default NotFoundPage;
