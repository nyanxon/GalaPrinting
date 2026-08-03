// Feature: daily-revenue-recap — getRecapRange must group rows by YYYY-MM-DD
// keys even when mysql2 returns DATE/DATETIME columns as JS Date objects.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/connection.js', () => ({
  query: vi.fn(),
}));

import { getRecapRange } from '../services/revenue.service.js';
import { query } from '../db/connection.js';

/**
 * Reproduce mysql2 v3 default typeCast: DATE/DATETIME columns arrive as
 * JS Date objects (midnight local for DATE), not strings.
 */
function mysqlDate(y, m, d) {
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

beforeEach(() => {
  query.mockReset();
});

describe('getRecapRange groups rows by YYYY-MM-DD key', () => {
  it('keeps website transactions whose pay_date is a Date object', async () => {
    query
      .mockResolvedValueOnce([
        [
          {
            id: 'w1',
            order_number: 'ORD-001',
            subtotal: '100000',
            status: 'Completed',
            source: 'online',
            pay_date: mysqlDate(2026, 7, 20),
            paid_at: new Date('2026-07-20T02:30:00.000Z'),
          },
          {
            id: 'w2',
            order_number: 'ORD-002',
            subtotal: '25000',
            status: 'Completed',
            source: 'offline',
            pay_date: mysqlDate(2026, 7, 20),
            paid_at: new Date('2026-07-20T05:00:00.000Z'),
          },
          {
            id: 'w3',
            order_number: 'ORD-003',
            subtotal: '50000',
            status: 'Completed',
            source: 'online',
            pay_date: mysqlDate(2026, 7, 21),
            paid_at: new Date('2026-07-21T03:00:00.000Z'),
          },
        ],
        [],
      ])
      .mockResolvedValueOnce([[], []]);

    const days = await getRecapRange('2026-07-20', '2026-07-21');

    expect(days).toHaveLength(2);
    expect(days[0].date).toBe('2026-07-20');
    expect(days[0].website_transactions).toHaveLength(2);
    expect(days[0].website_total).toBe(125000);
    expect(days[1].date).toBe('2026-07-21');
    expect(days[1].website_transactions).toHaveLength(1);
    expect(days[1].website_total).toBe(50000);
  });

  it('keeps manual transactions whose transaction_date is a Date object', async () => {
    query
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([
        [
          {
            id: 'm1',
            source_category: 'shopee',
            amount: '150000',
            notes: 'Penjualan marketplace',
            transaction_date: mysqlDate(2026, 7, 22),
          },
          {
            id: 'm2',
            source_category: 'offline_store',
            amount: '75000',
            notes: '',
            transaction_date: mysqlDate(2026, 7, 22),
          },
          {
            id: 'm3',
            source_category: 'tokopedia',
            amount: '40000',
            notes: '',
            transaction_date: mysqlDate(2026, 7, 23),
          },
        ],
        [],
      ]);

    const days = await getRecapRange('2026-07-22', '2026-07-23');

    expect(days).toHaveLength(2);
    expect(days[0].date).toBe('2026-07-22');
    expect(days[0].manual_transactions).toHaveLength(2);
    expect(days[0].manual_by_category.shopee).toBe(150000);
    expect(days[0].manual_by_category.offline_store).toBe(75000);
    expect(days[0].grand_total).toBe(225000);
    expect(days[1].date).toBe('2026-07-23');
    expect(days[1].manual_transactions).toHaveLength(1);
    expect(days[1].manual_by_category.tokopedia).toBe(40000);
    expect(days[1].grand_total).toBe(40000);
  });
});
