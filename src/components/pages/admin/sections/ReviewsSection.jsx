/**
 * ReviewsSection.jsx — Review moderation table with search and pagination.
 * Equivalent to vanilla admin/sections/reviewsSection.js
 *
 * Requirements: 9.2, 16.4
 */

import { useState, useEffect } from 'react';
import { listReviews, deleteReview } from '../../../../services/reviewService.js';
import { showToast } from '../../../../core/toastEmitter.js';
import { resolveApiUrl } from '../../../../core/httpClient.js';

const PAGE_SIZE = 10;

function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function PaginationBar({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const pages = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) {
    pages.push(p);
  }

  return (
    <div className="adm-pagination">
      <span className="adm-page-info">
        {start}–{end} dari {total}
      </span>
      <div className="adm-page-btns">
        <button
          className="adm-page-btn"
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            className={`adm-page-btn${p === page ? ' active' : ''}`}
            type="button"
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          className="adm-page-btn"
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default function ReviewsSection() {
  const [allReviews, setAllReviews] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  async function loadReviews() {
    try {
      const reviews = await listReviews();
      setAllReviews(Array.isArray(reviews) ? reviews : []);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    }
  }

  useEffect(() => {
    loadReviews();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = searchQuery.toLowerCase();
  const filtered = q
    ? allReviews.filter(
        (r) =>
          (r.productName || '').toLowerCase().includes(q) ||
          (r.customerName || '').toLowerCase().includes(q) ||
          (r.comment || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q)
      )
    : allReviews;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const items = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearchChange(e) {
    setSearchQuery(e.target.value.trim());
    setCurrentPage(1);
  }

  async function handleDelete(reviewId) {
    if (!window.confirm('Hapus ulasan ini?')) return;
    await deleteReview(reviewId);
    showToast('Ulasan dihapus.', 'success');
    loadReviews();
  }

  return (
    <div className="adm-card">
      <div className="adm-toolbar">
        <h2 className="adm-section-title">Ulasan Produk ({total})</h2>
        <div className="adm-toolbar-right">
          <input
            className="adm-input adm-search"
            type="search"
            placeholder="Cari produk / customer / komentar…"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Cari ulasan"
          />
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Kategori</th>
              <th>Rating</th>
              <th>Customer</th>
              <th>Komentar</th>
              <th>Foto</th>
              <th>Tanggal</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="adm-empty">
                  Belum ada ulasan.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td>{r.productName || '—'}</td>
                  <td>{r.category || '—'}</td>
                  <td>
                    <span className="adm-stars" title={`${r.rating}/5`}>
                      {stars(r.rating)}
                    </span>
                  </td>
                  <td>{r.customerName || '—'}</td>
                  <td>{r.comment || '—'}</td>
                  <td>
                    {r.photoUrl ? (
                      <a href={resolveApiUrl(r.photoUrl) || r.photoUrl} target="_blank" rel="noopener noreferrer" title="Lihat foto">
                        <img
                          src={resolveApiUrl(r.photoUrl) || r.photoUrl}
                          alt="Foto ulasan"
                          style={{
                            width: 48, height: 48, objectFit: 'cover',
                            borderRadius: 6, border: '1px solid var(--border)',
                            display: 'block',
                          }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </a>
                    ) : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
                  </td>
                  <td className="adm-date">
                    {new Date(r.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td>
                    <button
                      className="adm-btn adm-btn--delete"
                      type="button"
                      onClick={() => handleDelete(r.id)}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={safePage}
        totalPages={totalPages}
        total={total}
        limit={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
