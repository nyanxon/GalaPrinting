/**
 * OperationalOrdersSection.jsx — Orders untuk Operational role.
 *
 * Fitur 1: Operational sekarang melihat SEMUA order.
 * Tombol advance hanya muncul saat order di tahap "Design Accepted" (butuh diproses Operational).
 *
 * Requirements: 11.1, 13.4
 */

import SubAdminOrdersSection from './SubAdminOrdersSection.jsx';

export default function OperationalOrdersSection() {
  return <SubAdminOrdersSection />;
}
