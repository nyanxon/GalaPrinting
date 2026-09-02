// Fitur Stok — Fase 2: logika layanan stok (decrement/restock atomik & mapping).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  config: {
    nodeEnv: 'test',
    db: { host: 'localhost', port: 3306, name: 'test', user: 'test', password: '' },
    jwt: { accessSecret: 'test-access', refreshSecret: 'test-refresh', accessExpiresIn: '15m', refreshExpiresIn: '7d' },
    bcryptRounds: 10,
    email: { resendApiKey: null, fromEmail: 'test@test.com', adminEmail: null, frontendUrl: 'http://localhost:5173' },
    isDev: false, isProd: false,
  },
}));

vi.mock('../db/connection.js', () => ({
  query: vi.fn(),
  pool: { getConnection: vi.fn() },
}));

import { query } from '../db/connection.js';
import {
  StockInsufficientError,
  canonicalCombination,
  hashCombination,
  getStock,
  batchGetStocks,
  listProductStock,
  setProductStock,
  ensureProductStockRows,
  decrementStock,
  restockItems,
} from '../services/stock.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

const COMBO = [{ name: 'Bahan', value: 'AP150' }, { name: 'Ukuran', value: 'A3' }];
const HASH = hashCombination(COMBO);

describe('canonicalCombination / hashCombination', () => {
  it('menerima input array maupun JSON string (kolom DB)', () => {
    expect(canonicalCombination(JSON.stringify([{ name: 'Ukuran', value: 'A3' }, { name: 'Bahan', value: 'AP150' }])))
      .toEqual(COMBO);
    expect(canonicalCombination('garbage')).toEqual([]);
    expect(hashCombination(JSON.stringify(COMBO))).toBe(HASH);
  });
});

describe('getStock', () => {
  it('baris belum ada → fail-safe 0', async () => {
    query.mockResolvedValue([[]]);
    await expect(getStock('p1', COMBO)).resolves.toBe(0);
  });

  it('mengembalikan stok dari baris yang cocok', async () => {
    query.mockResolvedValue([[{ stock_quantity: 7 }]]);
    await expect(getStock('p1', COMBO)).resolves.toBe(7);
  });
});

describe('batchGetStocks', () => {
  it('mapping key ${productId}:${hash}, default 0 untuk yang tak ada', async () => {
    query.mockResolvedValue([[
      { product_id: 'p1', combination_hash: HASH, stock_quantity: 5 },
    ]]);
    const map = await batchGetStocks([
      { productId: 'p1', combination: COMBO },
      { productId: 'p2', combination: COMBO },
    ]);
    expect(map.get(`p1:${HASH}`)).toBe(5);
    expect(map.get(`p2:${HASH}`)).toBe(0);
  });
});

describe('listProductStock', () => {
  it('parse JSON kombinasi dari kolom & bentuk respons admin', async () => {
    query.mockResolvedValue([[
      { id: 'r1', attribute_combination: JSON.stringify(COMBO), stock_quantity: 3, updated_at: new Date('2026-01-01') },
      { id: 'r2', attribute_combination: JSON.stringify([]), stock_quantity: 0, updated_at: new Date('2026-01-02') },
    ]]);
    const rows = await listProductStock('p1');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'r1', combination: COMBO, stockQuantity: 3 });
    expect(rows[1].combination).toEqual([]);
  });
});

describe('setProductStock', () => {
  it('upsert dengan hash kanonik & JSON', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);
    await setProductStock('p1', COMBO, 12);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toContain(HASH);
    expect(params).toContain(JSON.stringify(COMBO));
    expect(params).toContain(12);
  });
});

describe('ensureProductStockRows', () => {
  it('INSERT IGNORE semua kombinasi (cartesian) dengan stok 0', async () => {
    query.mockResolvedValue([{ affectedRows: 2 }]);
    await ensureProductStockRows('p1', JSON.stringify([
      { name: 'Bahan', values: ['AP150', 'HVS'] },
      { name: 'Ukuran', values: ['A4', 'A3'] },
    ]));
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('INSERT IGNORE');
    // 4 kombinasi × 5 kolom
    expect(params).toHaveLength(20);
    expect(params.filter((p) => p === 0)).toHaveLength(4);
  });

  it('produk tanpa atribut → satu baris kombinasi kosong', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);
    await ensureProductStockRows('p1', null);
    const [, params] = query.mock.calls[0];
    expect(params).toContain('[]');
  });
});

describe('decrementStock (atomik dalam transaksi)', () => {
  function mockConn() {
    return {
      execute: vi.fn(async (sql, params) => {
        if (sql.includes('SET stock_quantity = stock_quantity -')) {
          // cukup jika param QTY terakhir <= stok tersedia (dipetakan diuji terpisah)
          const qty = params[0];
          return [{ affectedRows: qty <= 3 ? 1 : 0 }];
        }
        if (sql.includes('SELECT stock_quantity')) {
          return [[{ stock_quantity: 3 }]];
        }
        return [[]];
      }),
    };
  }

  it('agregasi item kembar & kurangi stok per kombinasi unik', async () => {
    const conn = mockConn();
    await decrementStock(conn, [
      { productId: 'p1', name: 'Stiker', combination: COMBO, quantity: 1 },
      { productId: 'p1', name: 'Stiker', combination: COMBO, quantity: 2 },
      { productId: 'p2', name: 'Poster', combination: [{ name: 'Bahan', value: 'AP150' }], quantity: 1 },
    ]);
    // 2 UPDATE (satu per kombinasi unik): p1:HASH qty 3, p2:hash(qty 1)
    const updates = conn.execute.mock.calls.filter(([sql]) => sql.includes('SET stock_quantity = stock_quantity -'));
    expect(updates).toHaveLength(2);
    expect(updates[0][1][0]).toBe(3);
  });

  it('stok kurang → StockInsufficientError dengan detail (rollback di caller)', async () => {
    const conn = mockConn();
    const err = await decrementStock(conn, [
      { productId: 'p1', name: 'Stiker', combination: COMBO, quantity: 5 },
    ]).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(StockInsufficientError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('STOCK_INSUFFICIENT');
    expect(err.message).toContain('Stiker');
    expect(err.message).toContain('diminta 5');
    expect(err.details[0].available).toBe(3);
  });

  it('item tanpa productId dilewati (tidak ada UPDATE)', async () => {
    const conn = mockConn();
    await decrementStock(conn, [
      { productId: null, name: 'Custom', combination: [], quantity: 2 },
      { productId: 'p1', name: 'Stiker', combination: COMBO, quantity: 1 },
    ]);
    const updates = conn.execute.mock.calls.filter(([sql]) => sql.includes('SET stock_quantity = stock_quantity -'));
    expect(updates).toHaveLength(1);
  });
});

describe('restockItems', () => {
  function mockConn() {
    return { execute: vi.fn(async () => [{ affectedRows: 1 }]) };
  }

  it('UPDATE +quantity per item ber-produk, lewati custom tanpa product', async () => {
    const conn = mockConn();
    await restockItems([
      { product_id: 'p1', quantity: 2, attributes: COMBO },
      { product_id: 'p1', quantity: 1, attributes: COMBO },
      { product_id: null, quantity: 5, attributes: [] },
    ], conn);
    const updates = conn.execute.mock.calls.filter(([sql]) => sql.includes('SET stock_quantity = stock_quantity +'));
    expect(updates).toHaveLength(2);
    // param pertama = kuantitas yang dikembalikan
    expect(updates.map(([, p]) => p[0])).toEqual([2, 1]);
    // hash kombinasi dipakai
    expect(updates[0][1][2]).toBe(HASH);
  });

  it('tanpa conn → memakai pool query', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);
    await restockItems([{ productId: 'p1', quantity: 1, attributes: COMBO }]);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('SET stock_quantity = stock_quantity +');
    expect(params[0]).toBe(1);
  });
});