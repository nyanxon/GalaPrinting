/**
 * ReviewsSection.jsx — Review moderation table with search and pagination.
 * Equivalent to vanilla admin/sections/reviewsSection.js
 *
 * Requirements: 9.2, 16.4
 */

import { useState, useEffect, useCallback } from 'react';
import { listReviews, deleteReview } from '../../../../services/reviews.js';
import { showToast } from '../../../../core/toastEmitter.js';
import { track } from '../../../../utils/activityTracker.js';
import { resolveApiUrl } from '../../../../core/httpClient.js';
import { getSocket } from '../../../../core/socket.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';

const PAGE_SIZE = 10;

function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export default function ReviewsSection() {
  const [allReviews, setAllReviews] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadReviews = useCallback(async () => {
    try {
      const reviews = await listReviews();
      setAllReviews(Array.isArray(reviews) ? reviews : []);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Real-time: review baru bisa muncul setelah order Finished → reload saat status berubah
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleOrderStatusChanged() {
      loadReviews();
    }

    socket.on('order:status_changed', handleOrderStatusChanged);

    return () => {
      socket.off('order:status_changed', handleOrderStatusChanged);
    };
  }, [loadReviews]);

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
    track('Hapus Ulasan', { targetType: 'review', targetId: reviewId });
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
