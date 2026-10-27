# 00 — INDEX AUDIT TEKNIS GALA PRINT

## Metadata

| Item | Nilai |
|---|---|
| Nama sistem | Gala Print / Gala Printing |
| Jenis | Aplikasi web pemesanan & operasional percetakan |
| Frontend | React 19 + Vite 6 + React Router 8 |
| Backend | Express 4 + MySQL (mysql2) + Socket.IO |
| Bahasa | JavaScript (ESM), JSX, CSS |
| Root repo | `C:\Users\chris\Downloads\KUMEDIA\Gala\Website\GalaPrinting` |
| Branch | `main` |
| Commit terakhir saat audit | `adea1a6 fix` |
| Status working tree | Bersih (tidak ada perubahan sebelum audit) |
| Tanggal audit | 23 Oktober 2026 |
| Sifat audit | READ-ONLY. Satu-satunya artefak yang dibuat adalah `docs/audit/*` |
| Metode | Pembacaan kode langsung, inventaris route/migrasi, cross-check frontend↔backend, tanpa menjalankan aplikasi |

## Tujuan Dokumen

Dokumen ini dan 14 dokumen turunannya dibuat agar **engineer atau AI lain dapat memahami sistem secara utuh tanpa akses ke repository**. Isi mencakup arsitektur, model data, API, autentikasi/otorisasi, siklus order, modul backend, arsitektur frontend, realtime, kualitas, keamanan, utang teknis, dan pertanyaan terbuka.

## Konvensi

- `[FAKTA]` — diklaim berdasarkan kode yang dibaca; disertai path file dan, bila relevan, nama fungsi.
- `[REKOMENDASI]` — saran perbaikan, bukan kondisi saat ini.
- `[TIDAK TERVERIFIKASI]` — belum dikonfirmasi dari kode/runtime; jangan dianggap benar.
- `[ASUMSI]` — inferensi wajar, bukan bukti.
- Semua path relatif terhadap root repo.
- Nilai secret **tidak pernah** ditulis; hanya nama environment variable.
- Ukuran LOC adalah hasil hitung file sumber (bukan komentar/blank) dan bersifat indikatif.

## Peta Dokumen

| File | Isi |
|---|---|
| `00-INDEX.md` | Indeks, konvensi, ringkasan temuan |
| `01-executive-summary.md` | Ringkasan eksekutif, kekuatan, risiko utama, prioritas |
| `02-system-overview.md` | Aktor, fitur, alur bisnis, integrasi, environment |
| `03-architecture.md` | Arsitektur repo, backend, frontend, deploy, request lifecycle |
| `04-data-model.md` | Tabel, relasi, migrasi, drift skema |
| `05-api-reference.md` | Daftar endpoint per router + auth/role |
| `06-authentication-authorization.md` | Login, JWT, refresh, role, permission dinamis |
| `07-order-lifecycle.md` | Pembuatan order, status, approval, invoice, pembatalan |
| `08-backend-modules.md` | Controller/service/middleware/util/job/socket |
| `09-frontend-architecture.md` | Routing, context, service layer, komponen, styling, i18n |
| `10-realtime-chat-notifications.md` | Socket.IO, chat, notifikasi email/preferensi, activity log |
| `11-testing-and-quality.md` | Test suite, CI, lint/format, observabilitas |
| `12-security-review.md` | Temuan keamanan + severity + bukti |
| `13-technical-debt-and-risks.md` | Utang teknis, risiko operasional, rekomendasi |
| `14-open-questions.md` | Hal yang belum jelas / perlu konfirmasi |

> Catatan: nama file `01`–`14` tidak ditentukan eksplisit oleh peminta audit. Mapping di atas adalah keputusan audit; isi dan nomor urut mengikuti kebutuhan pelaporan.

## Skala Kode (Indikatif)

| Area | Jumlah file | Jumlah baris |
|---|---:|---:|
| Frontend `src/` (js/jsx/css) | 202 | ±49.900 |
| Backend `server/src/` (js/sql) | 190 | ±23.100 |
| CSS | 33 file | termasuk `dashboard.css` ±4.496 baris |
| Test backend | 37 file | termasuk property test besar |
| Test frontend | 16 file | termasuk routing & property test |
| Migrasi SQL | 62 file (001–063, tanpa 060) | — |

## Ringkasan Temuan Kunci

### Kritis / Tinggi

1. **IDOR pada detail order** — `GET /api/orders/:id` hanya memakai `authenticate`, tanpa cek kepemilikan. User login mana pun (termasuk customer) dapat membaca order milik customer lain jika mengetahui/menebak ID. Bukti: `server/src/routes/orders.routes.js` dan `server/src/services/orders.service.js` (`getOrderById`). Detail: `12-security-review.md`.
2. **Enumerasi tracking publik** — `GET /api/orders/track` publik dan hanya mewajibkan `orderNumber`; `phone` opsional. Nomor order berurutan per bulan sehingga dapat ditebak. Bukti: `server/src/routes/orders.routes.js`, `orders.controller.js`.
3. **Otorisasi permission dinamis belum menegakkan akses secara luas** — `checkFeature()` hanya dipakai di route export dan daftar promo. `requireRole()` hardcoded masih menjadi penentu utama. Artinya UI permission dapat terlihat granular, tetapi banyak route tidak memeriksa permission. Bukti: `server/src/middleware/checkFeature.js`, `server/src/routes/export.routes.js`, `promo.routes.js`.
4. **Endpoint diagnostik terbuka** — `GET /diag` dan `GET /diag/log` tanpa autentikasi membocorkan versi Node, environment, port, cwd, uptime, dan isi `startup-diag.log`. Bukti: `server/src/app.js`.
5. **Dua tabel user + banyak relasi tanpa FK** — migrasi `053` memisahkan `users_customer`/`users_admin`, `054` menghapus seluruh FK ke `users`, `055` menghapus tabel `users`. Integritas referensial kini sepenuhnya tanggung jawab aplikasi. Bukti: `server/src/db/migrations/053…055`.

### Sedang

6. **Status usang pada aturan hapus order** — `getOrderDeletePermission()` memakai `'Ready to Ship'`, `'Shipped'`, `'Completed'` yang tidak ada dalam alur status aktual. Bukti: `server/src/services/orders.service.js`.
7. **Drift dokumentasi skema** — `server/src/db/migrations/combined_schema.sql` masih memakai `users` legacy dan belum memuat perubahan 052+. `schema_full_001_051.sql` hanya sampai 051. Tidak ada migrasi `060`.
8. **CI tidak selaras** — workflow memakai Node 18/20/22, sedangkan root `package.json` mensyaratkan Node `>=24`; CI juga tidak menjalankan test backend (`server/`).
9. **`dist/` ikut ter-commit** — 171 file build tracked di git, berisiko konflik/merge dan membengkakkan repo.
10. **Layer service frontend tidak konsisten** — hanya 13 service; belasan komponen memanggil `api` langsung, mempersulit testing dan perubahan kontrak.
11. **File monolitik** — `dashboard.css` ±4.496 baris, `OfflineOrderSection.jsx` ±1.345 baris, `orders.service.js` ±1.001 baris, `checkout.css` ±895 baris.
12. **Komentar/aturan akses ganda** — aturan role diduplikasi di backend (`config/roles.js`, `requireRole`) dan frontend (`src/config/roles.js`, `permissions.js`), rawan divergensi.

### Rendah / Informasi

13. **Artefak sampah** — file `dasdasd` di root berisi output `git log` berwarna, bukan kode.
14. **Bahasa komentar campur** — Indonesia/Inggris; sebagian komentar sudah usang (mis. `checkFeature.js` menyebut tabel `users`).
15. **Test suite luas tetapi berat** — 37 test backend + 16 test frontend, dominan property test; waktu eksekusi dan flakiness perlu diukur `[TIDAK TERVERIFIKASI]`.

## Cara Membaca Cepat

- Ingin gambaran produk & risiko: baca `01`, lalu `12`.
- Ingin memahami alur order: `07`, didukung `04` dan `05`.
- Ingin mengubah API: `05` + `06` + `08`.
- Ingin mengubah UI: `09` + `10`.
- Ingin menilai kualitas: `11` + `13`.
- Ingin lanjut audit: `14`.

## Batasan Audit

- Aplikasi tidak dijalankan; tidak ada pengujian runtime, beban, atau browser.
- Isi database produksi tidak diperiksa; kesimpulan skema berasal dari file migrasi.
- Perilaku deployment Hostinger tidak diverifikasi langsung.
- Beberapa file besar dibaca parsial; klaim yang belum kuat ditandai `[TIDAK TERVERIFIKASI]`.
- Tidak ada audit dependensi (`npm audit`) atau pemindaian secret otomatis.

BERSAMBUNG ke `01-executive-summary.md`
