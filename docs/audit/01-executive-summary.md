# 01 — RINGKASAN EKSEKUTIF

## Apa Itu Sistem Ini

Gala Print adalah aplikasi web monolitik yang menggabungkan **toko online percetakan** dan **back-office operasional**. Pelanggan dapat melihat katalog, mengatur keranjang, checkout, mengunggah desain, melacak status pesanan, mengobrol dengan staff, dan mengunduh invoice. Staff internal menjalankan pesanan melalui alur produksi bertahap (pembayaran → desain → produksi → QC → pengiriman → selesai), mengelola produk/promo/konten homepage, mencatat pendapatan harian, serta berkomunikasi internal lewat DM.

Sistem dibangun sebagai **satu repo dua aplikasi**:

- `src/` — SPA React yang di-build Vite.
- `server/` — API Express + Socket.IO + MySQL, sekaligus menyajikan hasil build frontend pada deployment produksi.

## Teknologi Utama

| Lapisan | Teknologi |
|---|---|
| UI | React 19.2, React Router 8.3, lucide-react, Chart.js, emoji-mart, react-easy-crop |
| Build | Vite 6.4, plugin compression |
| HTTP client | Axios 1.19 |
| i18n | i18next 26 + react-i18next 17 (`id`, `en`, `bal`) |
| Realtime | socket.io-client 4.8 / socket.io 4.7 |
| PDF | jsPDF + autotable (klien), PDFKit (server) |
| API | Express 4.19, express-validator, express-rate-limit |
| Auth | JWT access + refresh token rotation, bcrypt |
| Database | MySQL via mysql2 pool |
| Email | Resend |
| Upload | Multer |
| Test | Vitest 4, fast-check 4, Testing Library, jsdom |
| Deploy | Hostinger; Node wrapper `server/index.js` → `server/src/server.js` |

## Aktor dan Peran

| Aktor | Peran teknis | Fokus |
|---|---|---|
| Pengunjung | tanpa login | katalog, homepage, portfolio, status order |
| Customer | role `customer` di `users_customer` | order, cart, alamat, chat, review, invoice |
| Cashier | `cashier` | pembayaran, order offline/konfirmasi |
| CS | `cs` | desain, catatan order, order custom |
| Operational | `operational` | mulai produksi |
| QC | `qc` | quality check, pengiriman, tracking |
| Admin | `admin` | hampir seluruh operasional |
| Owner | `owner` | analitik, akun, permission, export, reset revenue |
| Offline | `offline` | order toko offline, rekap harian |
| Promoted admin | `users_admin.is_promoted_admin=1` | admin dengan permission dinamis |

Daftar role staff didefinisikan di `server/src/config/roles.js` (`STAFF_ROLES`) dan diduplikasi di frontend (`src/config/roles.js`).

## Kekuatan Sistem

1. **Alur bisnis terdokumentasi di kode** — status order, matriks transisi per role, approval per tahap, dan riwayat status tersimpan eksplisit (`orders.service.js`, `order_history`, `order_approvals`).
2. **Pemisahan customer/staff sudah dimigrasikan** — `users_customer` dan `users_admin` memisahkan domain auth, meski menimbulkan konsekuensi integritas (lihat risiko).
3. **Refresh token rotation dengan deteksi reuse** — ada family token, grace window 10 detik, dan pencabutan family saat token dipakai ulang (`adminAuth.service.js`, `customerAuth.service.js`).
4. **Kebijakan password staff** — `must_change_password` memaksa ganti password sebelum mengakses route terproteksi.
5. **Test suite besar** — 37 file test backend dan 16 file test frontend, banyak berupa property-based test untuk invariant order, chat, permission, dan preservasi bug.
6. **Pengerasan dasar cukup baik** — Helmet, CORS allowlist, rate limit pada auth/analytics, validasi input, query parameterized, `escapeHtml`, dan static asset caching berlapis.
7. **Frontend code-splitting** — halaman dashboard di-lazy-load; build memisahkan chunk admin/owner/offline.
8. **Dukungan tiga bahasa** dan UI responsif dengan sistem CSS terstruktur.

## Risiko Utama

| # | Risiko | Dampak | Severity | Bukti |
|---|---|---|---|---|
| 1 | IDOR detail order: user login dapat membaca order orang lain | Kebocoran data pelanggan (nama, telepon, alamat, item, pembayaran) | **Tinggi** | `orders.routes.js` `GET /:id`; `orders.service.js` `getOrderById` |
| 2 | Tracking publik dengan nomor order saja | Enumerasi status & data order | **Tinggi** | `orders.routes.js` `GET /track`; `trackOrder` |
| 3 | Permission dinamis tidak ditegakkan menyeluruh | Staff dapat mengakses fitur di luar permission UI | **Tinggi** | `checkFeature.js` hanya dipakai export + promo |
| 4 | `/diag` dan `/diag/log` terbuka | Bocor versi runtime, path, log startup | **Sedang–Tinggi** | `server/src/app.js` |
| 5 | Relasi user tanpa FK setelah migrasi 054/055 | Orphan record, data inconsistency | **Sedang** | `054_drop_users_fk_constraints.sql`, `055_drop_legacy_users_table.sql` |
| 6 | Aturan hapus order memakai status usang | Order tidak bisa dihapus / salah izin | **Sedang** | `getOrderDeletePermission()` |
| 7 | Skema dokumentasi drift + migrasi 060 hilang | Onboarding & rebuild DB berisiko | **Sedang** | `combined_schema.sql`, daftar migrasi |
| 8 | CI Node 18/20/22 vs `engines >=24`, tak jalankan test server | Regresi lolos | **Sedang** | `.github/workflows/node.js.yml`, `package.json` |
| 9 | `dist/` tracked | Merge conflict, repo bengkak, build usang | **Rendah–Sedang** | `git ls-files dist` = 171 file |
| 10 | Monolit CSS/komponen | Sulit dirawat, risiko regresi UI | **Rendah–Sedang** | `dashboard.css` 4.496 baris, dll. |

## Kematangan Teknis

**Tingkat: menengah, production-used dengan fondasi kuat namun disiplin pemeliharaan tidak merata.**

- Kuat pada modeling alur order, test, validasi, dan auth refresh.
- Lemah pada konsistensi otorisasi (role vs permission), integritas skema, kebersihan repo, dan batas modul frontend.
- Beberapa solusi tampak evolusioner (patch bertumpuk) alih-alih desain ulang: dua tabel user, JSON discount, status string, permission ganda.

## Prioritas Perbaikan yang Disarankan

### P0 — segera (keamanan)

1. Tambahkan ownership/role check pada `getOrderById` dan seluruh endpoint order yang memakai `:id`.
2. Perketat `/api/orders/track` (wajib phone/email terverifikasi, rate limit, pesan generik).
3. Lindungi atau hapus `/diag` dan `/diag/log`.
4. Audit semua route `/:id` untuk IDOR serupa (invoice, chat, address, review).

### P1 — sprint berikutnya

5. Terapkan `checkFeature()` (atau policy terpusat) ke seluruh route fitur, bukan hanya export/promo.
6. Perbaiki daftar status pada aturan hapus order dan satukan sumber kebenaran status.
7. Sinkronkan `combined_schema.sql`; putuskan apakah migrasi `060` memang tidak diperlukan.
8. Perbaiki CI: Node 24, jalankan `npm test` root dan `server`, tambahkan lint.
9. Hapus `dist/` dari tracking dan bangun di pipeline/deploy.

### P2 — perbaikan struktural

10. Pecah file monolit (`dashboard.css`, `OfflineOrderSection.jsx`, `orders.service.js`).
11. Standarkan layer service frontend; hilangkan panggilan `api` langsung dari komponen.
12. Satukan definisi role/permission antara frontend dan backend.
13. Tambahkan observability terstruktur (request id, log level, error tracking) dan health check DB.
14. Dokumentasikan kontrak API (OpenAPI) dan matriks otorisasi.

## Kesimpulan

Sistem ini **bukan prototipe**: fiturnya luas, alur operasional nyata, dan investasi test signifikan. Namun kualitasnya tidak seragam. Tiga area paling berisiko adalah **otorisasi per-record**, **penegakan permission dinamis**, dan **integritas skema pasca-split user**. Perbaikan P0 relatif kecil secara kode tetapi berdampak besar terhadap keamanan data pelanggan.

BERSAMBUNG ke `02-system-overview.md`
