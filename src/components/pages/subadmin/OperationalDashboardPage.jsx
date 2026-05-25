/**
 * OperationalDashboardPage.jsx — Dashboard for the Operational role.
 *
 * Responsibilities: Production process — printing, finishing, product preparation.
 * Visible order statuses: "Design Accepted", "On Progress"
 *
 * Requirements: 11.1, 11.2, 13.4
 */

import '../../../styles/css/pages/dashboard.css';
import SubAdminLayout from './SubAdminLayout.jsx';
import OperationalOrdersSection from './sections/OperationalOrdersSection.jsx';
import ChatsSection from '../admin/sections/ChatsSection.jsx';
import DMSection from '../admin/sections/DMSection.jsx';

const NAV_ITEMS = [
  { id: 'orders', label: '📋 Pesanan' },
  { id: 'chat',   label: '💬 Chat Customer' },
  { id: 'dm',     label: '📨 Pesan Staff' },
];

const SECTIONS = {
  orders: <OperationalOrdersSection />,
  chat:   <ChatsSection />,
  dm:     <DMSection />,
};

export default function OperationalDashboardPage() {
  return (
    <SubAdminLayout
      navItems={NAV_ITEMS}
      sections={SECTIONS}
      title="Operasional Dashboard"
    />
  );
}
