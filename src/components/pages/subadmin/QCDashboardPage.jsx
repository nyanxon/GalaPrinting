/**
 * QCDashboardPage.jsx — Dashboard for the Quality Control (QC) role.
 *
 * Responsibilities: Quality check, packaging, and courier delivery.
 * Visible order statuses: "On Progress", "Quality Checking", "In Delivery", "Finished"
 *
 * Requirements: 11.1, 11.2, 13.4
 */

import '../../../styles/css/pages/dashboard.css';
import SubAdminLayout from './SubAdminLayout.jsx';
import QCOrdersSection from './sections/QCOrdersSection.jsx';
import ChatsSection from '../admin/sections/ChatsSection.jsx';
import DMSection from '../admin/sections/DMSection.jsx';

const NAV_ITEMS = [
  { id: 'orders', label: '📋 Pesanan' },
  { id: 'chat',   label: '💬 Chat Customer' },
  { id: 'dm',     label: '📨 Pesan Staff' },
];

const SECTIONS = {
  orders: <QCOrdersSection />,
  chat:   <ChatsSection />,
  dm:     <DMSection />,
};

export default function QCDashboardPage() {
  return (
    <SubAdminLayout
      navItems={NAV_ITEMS}
      sections={SECTIONS}
      title="Quality Control Dashboard"
    />
  );
}
