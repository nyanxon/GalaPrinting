/**
 * OperationalOrdersSection.jsx — Orders filtered to production statuses.
 *
 * Operational responsibilities: printing, finishing, product preparation.
 * Visible statuses: "Design Accepted", "On Progress"
 *
 * Requirements: 11.1, 13.4
 */

import SubAdminOrdersSection from './SubAdminOrdersSection.jsx';

const OPERATIONAL_STATUSES = ['Design Accepted', 'On Progress'];

export default function OperationalOrdersSection() {
  return <SubAdminOrdersSection visibleStatuses={OPERATIONAL_STATUSES} />;
}
