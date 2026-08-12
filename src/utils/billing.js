/** Bilangan positif valid, else 0. */
export function parseNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Dimensi yang ditagih (cm): panjang/lebar 1-99 cm dibulatkan naik ke 100 cm (1 m),
 * dimensi ≥ 100 cm tetap apa adanya. Return 0 untuk nilai kosong/0.
 */
export function billableCm(cm) {
  const v = parseNumber(cm);
  if (!(v > 0)) return 0;
  return v < 100 ? 100 : v;
}

/**
 * Luas yang ditagih (m²) dalam desimal:
 * (panjang_billing × lebar_billing) / 10000 — mis. 200cm × 20cm (→ 100cm) = 2 × 1 = 2 m².
 * Dibulatkan ke 4 desimal hanya untuk membersihkan error float.
 * Return 0 jika dimensi belum lengkap.
 */
export function billedAreaM2(lengthCm, widthCm) {
  const l = billableCm(lengthCm);
  const w = billableCm(widthCm);
  if (!l || !w) return 0;
  return Math.round((l / 100) * (w / 100) * 10000) / 10000;
}
