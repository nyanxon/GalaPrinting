import { describe, it, expect } from 'vitest';
import { billableCm, billedAreaM2 } from '../utils/billing.js';

describe('billableCm — dimensi yang ditagih (round-up ke 100 cm)', () => {
  it('dimensi 1-99 cm dibulatkan naik ke 100 cm', () => {
    expect(billableCm('1')).toBe(100);
    expect(billableCm('50')).toBe(100);
    expect(billableCm('99')).toBe(100);
    expect(billableCm(80)).toBe(100);
    expect(billableCm(0.5)).toBe(100);
  });

  it('dimensi ≥ 100 cm tetap apa adanya', () => {
    expect(billableCm('100')).toBe(100);
    expect(billableCm('150')).toBe(150);
    expect(billableCm('250')).toBe(250);
    expect(billableCm(200)).toBe(200);
  });

  it('nilai kosong/0/non-angka menghasilkan 0', () => {
    expect(billableCm('')).toBe(0);
    expect(billableCm('0')).toBe(0);
    expect(billableCm('abc')).toBe(0);
    expect(billableCm(null)).toBe(0);
    expect(billableCm(undefined)).toBe(0);
  });
});

describe('billedAreaM2 — luas yang ditagih', () => {
  it('200 × 20 cm → 2 m² (lebar dibulatkan ke 1 m)', () => {
    expect(billedAreaM2('200', '20')).toBe(2);
  });

  it('150 × 50 cm → 1,5 m² (lebar dibulatkan ke 1 m)', () => {
    expect(billedAreaM2('150', '50')).toBe(1.5);
  });

  it('50 × 80 cm → 1 m² (keduanya dibulatkan ke 1 m)', () => {
    expect(billedAreaM2('50', '80')).toBe(1);
  });

  it('120 × 100 cm → 1,2 m² (tanpa pembulatan)', () => {
    expect(billedAreaM2('120', '100')).toBe(1.2);
  });

  it('0,5 × 200 cm → 2 m² (0,5 cm dibulatkan ke 1 m)', () => {
    expect(billedAreaM2('0.5', '200')).toBe(2);
  });

  it('dimensi kosong menghasilkan 0', () => {
    expect(billedAreaM2('', '200')).toBe(0);
    expect(billedAreaM2('120', '')).toBe(0);
  });
});
