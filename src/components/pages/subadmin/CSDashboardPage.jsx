/**
 * CSDashboardPage.jsx — Dashboard for the Customer Service (CS) role.
 *
 * Responsibilities: Design consultation and design approval confirmation.
 * Sections:
 *   - Orders: filtered to design-related statuses
 *   - Order Offline: input pesanan toko langsung (form input order manual)
 *   - Custom Order: create a custom order for a registered customer
 *   - Chat: WhatsApp-style chat panel with customers
 *   - DM: staff-to-staff direct messaging
 *
 * Requirements: 11.1, 11.2, 13.4
 */

import '../../../styles/css/pages/dashboard.css';
import SubAdminLayout from './SubAdminLayout.jsx';
import SubAdminOrdersSection from './sections/SubAdminOrdersSection.jsx';
import CSCustomOrderSection from './sections/CSCustomOrderSection.jsx';
import OfflineOrderSection from './sections/OfflineOrderSection.jsx';
import ChatsSection from '../admin/sections/ChatsSection.jsx';
import DMSection from '../admin/sections/DMSection.jsx';

const NAV_ITEMS = [
  { id: 'orders',       label: '📋 Pesanan' },
  { id: 'offline',      label: '🏪 Order Offline' },
  { id: 'custom-order', label: '➕ Custom Order' },
  { id: 'chat',         label: '💬 Chat Customer' },
  { id: 'dm',           label: '📨 Pesan Staff' },
];

const SECTIONS = {
  orders:         <SubAdminOrdersSection />,
  offline:        <OfflineOrderSection />,
  'custom-order': <CSCustomOrderSection />,
  chat:           <ChatsSection />,
  dm:             <DMSection />,
};

export default function CSDashboardPage() {
  return (
    <SubAdminLayout
      navItems={NAV_ITEMS}
      sections={SECTIONS}
      title="Customer Service Dashboard"
    />
  );
}
