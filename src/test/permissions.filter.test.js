// Feature: owner-set menu permissions drive the sub-admin sidebar.
// Regression guard: permission key 'chats' maps to sub-admin nav id 'chat'.
import { describe, it, expect } from 'vitest';
import {
  getPermissionsForRole,
  filterNavByPermissions,
} from '../config/permissions.js';

// Nav ids as used by CashierDashboardPage (source of the reported bug).
const CASHIER_NAV = [
  { id: 'orders',   label: '📋 Pesanan' },
  { id: 'invoices', label: '🧾 Invoices' },
  { id: 'recap',    label: '📊 Rekap Harian' },
  { id: 'chat',     label: '💬 Chat Customer' },
  { id: 'dm',       label: '📨 Pesan Staff' },
];

describe('permissions — menu flow owner → cashier', () => {
  it('exposes chats + dm + invoices permission keys for cashier role', () => {
    const keys = getPermissionsForRole('cashier').map((p) => p.key);
    expect(keys).toContain('chats');
    expect(keys).toContain('dm');
    expect(keys).toContain('invoices');
    // Order Offline sudah dipindah dari Cashier ke CS.
    expect(keys).not.toContain('order_offline');
  });

  it('null permissions (never edited) shows every menu', () => {
    expect(filterNavByPermissions(CASHIER_NAV, null).map((i) => i.id)).toEqual([
      'orders', 'invoices', 'recap', 'chat', 'dm',
    ]);
  });

  it('empty permissions (explicitly cleared) shows nothing', () => {
    expect(filterNavByPermissions(CASHIER_NAV, [])).toEqual([]);
  });

  it('owner checking all cashier features keeps Chat Customer AND Pesan Staff visible', () => {
    const allCashierPerms = getPermissionsForRole('cashier').map((p) => p.key);
    const visible = filterNavByPermissions(CASHIER_NAV, allCashierPerms).map((i) => i.id);
    expect(visible).toContain('chat');
    expect(visible).toContain('dm');
    expect(visible).toEqual(['orders', 'invoices', 'recap', 'chat', 'dm']);
  });

  it('unchecking Chats hides Chat Customer but keeps Pesan Staff', () => {
    const perms = getPermissionsForRole('cashier').map((p) => p.key).filter((k) => k !== 'chats');
    const visible = filterNavByPermissions(CASHIER_NAV, perms).map((i) => i.id);
    expect(visible).not.toContain('chat');
    expect(visible).toContain('dm');
  });

  it('unchecking DM hides Pesan Staff but keeps Chat Customer', () => {
    const perms = getPermissionsForRole('cashier').map((p) => p.key).filter((k) => k !== 'dm');
    const visible = filterNavByPermissions(CASHIER_NAV, perms).map((i) => i.id);
    expect(visible).toContain('chat');
    expect(visible).not.toContain('dm');
  });

  it('each permission key alone reveals exactly its mapped menu', () => {
    const cases = [
      { perms: ['orders'],        visible: ['orders'] },
      { perms: ['invoices'],      visible: ['invoices'] },
      { perms: ['daily_recap'],   visible: ['recap'] },
      { perms: ['chats'],         visible: ['chat'] },
      { perms: ['dm'],            visible: ['dm'] },
    ];
    for (const { perms, visible } of cases) {
      expect(filterNavByPermissions(CASHIER_NAV, perms).map((i) => i.id)).toEqual(visible);
    }
  });
});
