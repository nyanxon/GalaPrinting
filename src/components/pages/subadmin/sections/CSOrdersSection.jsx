/**
 * CSOrdersSection.jsx — Orders filtered to design-related statuses for CS role.
 *
 * CS responsibilities: design consultation and design approval confirmation.
 * Visible statuses: "Payment Accepted", "Waiting for Design Approval", "Design Accepted"
 *
 * Requirements: 11.1, 13.4
 */

import SubAdminOrdersSection from './SubAdminOrdersSection.jsx';

const CS_STATUSES = ['Payment Accepted', 'Waiting for Design Approval', 'Design Accepted'];

export default function CSOrdersSection() {
  return <SubAdminOrdersSection visibleStatuses={CS_STATUSES} />;
}
