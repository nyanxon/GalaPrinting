/**
 * PaginationBar.jsx — Shared pagination bar (prev / page-numbers / next).
 *
 * Consolidation of the duplicated inline PaginationBar previously defined in
 * OrdersSection, ReviewsSection, CustomersSection, ProductsSection,
 * InvoiceSection, AccountsSection, and RevenueSection.
 *
 * Props:
 *   - page        {number}  current page (1-based)
 *   - totalPages  {number}  total number of pages
 *   - total       {number}  total number of items
 *   - limit       {number}  items per page
 *   - onPageChange {function} called with the new page number
 */

export default function PaginationBar({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

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
