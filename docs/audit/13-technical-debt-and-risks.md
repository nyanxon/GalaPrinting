# 13 — UTANG TEKNIS & RISIKO

## Ringkasan

Utang teknis bersifat evolusioner: banyak fitur ditambahkan bertahap, menghasilkan duplikasi, file monolitik, dan keputusan sementara yang tetap dipakai.

## Utang Teknis

### Backend

| Item | Lokasi | Jenis | Usia | Dampak | Rekomendasi |
|---|---|---|---|---|---|
| `orders.service.js` monolitik (1001 baris) | `server/src/services/orders.service.js` | Arsitektur | Tinggi | Sulit diuji/dirawat | Pecah: `orderCreation`, `orderTransitions`, `orderFulfillment`, `orderDeletion` |
| SQL manual tanpa ORM | seluruh `services/` | Arsitektur | Tinggi | Duplikasi, rawan typo | Pertimbangkan query builder atau repository pattern |
| Tanpa FK user pasca-split | migrasi 053–055 | Data | Sedang | Integritas lemah | Validasi aplikasi + cleanup job |
| Status string tanpa enum terpusat | order, history | Data | Tinggi | Nilai usang | `constants/status.js` + validasi |
| JSON tanpa skema | `attributes`, `discounts`, `metadata` | Data | Sedang | Validasi lemah | Zod schema |
| `checkFeature` cakupan sempit | `middleware/checkFeature.js` | Otorisasi | Sedang | Permission tidak efektif | Perluas atau ganti policy engine |
| `failedLoginMap` in-memory | `auth.controller.js` | Skalabilitas | Sedang | Hilang restart, multi-instance | Redis/in-memory store dengan TTL |
| DDL di startup | `ensure*Tables.js` | Deploy | Sedang | Hak DB luas saat runtime | Pindahkan ke migrasi saja |
| Email inline template | `email.service.js` | Maintainability | Sedang | Panjang, sulit i18n | Template terpisah |
| Approval lock bentrok dengan reject | `orderApprovals.service.js` | Bisnis | Sedang | Blokir alur valid | Perbaiki logika lock |

### Frontend

| Item | Lokasi | Jenis | Usia | Dampak | Rekomendasi |
|---|---|---|---|---|---|
| `orders.js` service besar (40KB) | `src/services/orders.js` | Arsitektur | Tinggi | Lambat, sulit di-debug | Pecah per domain |
| `dashboard.css` 4496 baris | `src/styles/css/pages/dashboard.css` | Styling | Tinggi | Konflik spesifisitas | CSS modules / Tailwind / BEM |
| Panggilan `api` langsung | banyak komponen | Arsitektur | Sedang | Kontrak tidak terpusat | Pindahkan ke service |
| `dist/` di-commit | `dist/` | Repo | Tinggi | Konflik, artefak usang | `.gitignore` + build di CI |
| Duplikasi role/permission | `src/config/*` vs `server/config/*` | Konsistensi | Sedang | Divergensi | Shared package atau generate |
| Komponen monolit | `OfflineOrderSection`, `HomepageSection` | UI | Sedang | Sulit diuji | Split ke sub-komponen |
| RoleGuard single-role | `RoleGuard.jsx` | UX/Auth | Sedang | Kurang fleksibel | Multi-role/hierarki |

### Infra/DevOps

| Item | Lokasi | Jenis | Usia | Dampak | Rekomendasi |
|---|---|---|---|---|---|
| CI Node mismatch | `.github/workflows/node.js.yml` | CI | Sedang | Tes tidak sesuai prod | Node 24 |
| CI tak jalankan test server | workflow | CI | Sedang | Regresi backend lolos | Tambahkan step server test |
| Tidak ada typecheck | — | QA | Tinggi | Bug runtime | `tsc --noEmit` / JSDoc |
| Tidak ada coverage | — | QA | Sedang | Tidak tahu cakupan | Vitest coverage |
| Tidak ada E2E | — | QA | Tinggi | Alur kritis tak teruji | Playwright |
| README bisa lebih lengkap | `README.md` | Docs | Sedang | Onboarding lambat | Tambahkan env, migrasi, deploy |

## Risiko Operasional

| Risiko | Probabilitas | Dampak | Mitigasi |
|---|---|---|---|
| DB down saat startup | Rendah | **Tinggi** | `testConnection()` hanya warning — server tetap listen. Pertimbangkan health check ketat. |
| Storage penuh (upload 100MB) | Sedang | **Tinggi** | Monitor disk Hostinger; validasi ukuran; cleanup orphan |
| Refresh token reuse massal | Rendah | **Tinggi** | Sudah ada deteksi family revoke |
| Migrasi gagal di produksi | Sedang | **Tinggi** | Backup sebelum migrasi; test di staging |
| `dist/` usang | Sedang | **Sedang** | Build ulang atau hapus dari tracking |
| File di `/uploads` bocor | Sedang | **Tinggi** | Auth/signed URL segera |
| Order macet karena approval lock | Sedang | **Sedang** | Perbaiki logika lock |
| Hapus order salah | Sedang | **Sedang** | Perbaiki aturan hapus |

## Risiko Keamanan (Ringkas)

Lihat `12-security-review.md`. P0: IDOR, tracking enumerasi, `/diag`.

## Risiko Bisnis

| Risiko | Dampak |
|---|---|
| Kesalahan status produksi | Pesanan terlambat/salah kirim |
| Invoice salah (DP/lunas) | Kesalahan tagihan |
| Diskon salah hitung | Kerugian finansial |
| Order dihapus tidak sengaja | Kehilangan histori |
| Promo abuse | Kerugian |

## Debt Heatmap (Prioritas)

| Area | Severity | Effort | Priority |
|---|---|---|---|
| IDOR + tracking + /diag | Kritis | Rendah | **P0** |
| Permission enforcement | Tinggi | Sedang | **P0** |
| Approval lock fix | Tinggi | Sedang | **P1** |
| Order delete rules | Tinggi | Rendah | **P1** |
| CI fix (Node 24 + server tests) | Tinggi | Rendah | **P1** |
| Upload auth/signed URL | Tinggi | Sedang | **P1** |
| `orders.service.js` split | Tinggi | Tinggi | **P2** |
| `dist/` cleanup | Sedang | Rendah | **P2** |
| CSS/komponen split | Sedang | Tinggi | **P3** |

## Rekomendasi Strategis

1. **Keamanan dulu** — fokus P0 dalam 1–2 hari.
2. **CI menjadi gate** — wajib lint + test server sebelum merge.
3. **Modularisasi bertahap** — tidak rewrite besar, ekstrak fungsi per domain.
4. **Standardisasi** — satu sumber kebenaran status/role/permission.
5. **Dokumentasi** — tambahkan ADR untuk keputusan besar (split user, approval lock).
6. **Observability** — request id, error tracking, health endpoint.
7. **Backup strategy** — pastikan backup DB + upload sebelum migrasi.

## Estimasi Teknis

| Perbaikan | Kompleksitas | Catatan |
|---|---|---|
| Tambah ownership check `getOrderById` | Rendah | Butuh akses role dari context/service |
| Lindungi `/diag` | Sangat rendah | Hapus atau tambah auth |
| Perbaiki delete permission | Rendah | Ubah array status |
| Perbaiki approval lock | Sedang | Butuh mapping jalur reject |
| Terapkan `checkFeature` lebih luas | Sedang | Inventaris route + uji |
| Pecah `orders.service.js` | Tinggi | Butuh regresi test ketat |
| Auth `/uploads` | Tinggi | Perlu redesign static serving |

## Kesimpulan

Utang teknis terbesar adalah **konsistensi arsitektur** (duplikasi, monolit, permission tidak konsisten). Risiko terbesarnya adalah **keamanan otorisasi**. Sistem ini masih layak dipelihara, tetapi tanpa perbaikan P0, ada **risiko kebocoran data pelanggan** yang nyata.

BERSAMBUNG ke `14-open-questions.md`
