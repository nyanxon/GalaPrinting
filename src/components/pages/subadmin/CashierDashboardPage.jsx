/**
 * CashierDashboardPage.jsx — Dashboard for the Cashier (Kasir) role.
 *
 * Fitur 1: Semua pesanan tampil di list, tidak hilang setelah status berubah.
 * Fitur 2: Menu Invoices — list invoice, update status pembayaran, print resi.
 *
 * Requirements: 11.1, 11.2, 13.4
 */

import '../../../styles/css/pages/dashboard.css';
import SubAdminLayout from './SubAdminLayout.jsx';
import CashierOrdersSection from './sections/CashierOrdersSection.jsx';
import InvoiceSection from '../admin/sections/InvoiceSection.jsx';
import DailyRevenueSection from './sections/DailyRevenueSection.jsx';
import ChatsSection from '../admin/sections/ChatsSection.jsx';
import DMSection from '../admin/sections/DMSection.jsx';
const NAV_ITEMS = [
  { id: 'orders',   label: '📋 Pesanan' },
  { id: 'invoices', label: '🧾 Invoices' },
  { id: 'recap',    label: '📊 Rekap Harian' },
  { id: 'chat',     label: '💬 Chat Customer' },
  { id: 'dm',       label: '📨 Pesan Staff' },
];

const SECTIONS = {
  orders:   <CashierOrdersSection />,
  invoices: <InvoiceSection />,
  recap:    <DailyRevenueSection />,
  chat:     <ChatsSection />,
  dm:       <DMSection />,
};

export default function CashierDashboardPage() {
  return (
    <SubAdminLayout
      navItems={NAV_ITEMS}
      sections={SECTIONS}
      title="Kasir Dashboard"
    />
  );
}
