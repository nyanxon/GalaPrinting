# 08 — MODUL BACKEND

## Struktur

```
server/src/
├── app.js                 factory Express
├── server.js              HTTP + Socket.IO + startup
├── config/                env, roles, features
├── routes/                21 router
├── controllers/           20 controller
├── services/              22 service
├── middleware/            auth, requireRole, checkFeature, optionalAuth, upload, error
├── db/                    connection, migrate, seeds, ensure*, migrations/
├── socket/index.js
├── jobs/activityLogPurge.js
└── utils/                 jwt, hash, storage, discounts, invoicePdf, pagination, escapeHtml
```

Pola: **route → controller → service → query**. Controller menangani HTTP; service menangani SQL/transaksi; util bersifat stateless.

## Controllers

| File | Tanggung jawab | Catatan |
|---|---|---|
| `auth.controller.js` | register/login customer & staff, refresh, logout, me, verifikasi email, reset/ganti password | cookie refresh, failed-login alert, dispatch dua service |
| `orders.controller.js` | semua endpoint order, tracking, upload bukti/desain, delete | memanggil emitter Socket.IO; validasi tersebar |
| `cart.controller.js` | cart CRUD + sync | user dari `req.user` |
| `chat.controller.js` | conversation, DM, message, file, read, hide/delete | otorisasi percakapan ada di controller `[TIDAK TERVERIFIKASI detail]` |
| `products.controller.js` | produk + kategori + upload gambar | validasi harga/atribut di route |
| `reviews.controller.js` | list, reviewed-items, create, delete | upload foto |
| `analytics.controller.js` | revenue, monthly, visits, product views, best sellers, reset | rate limit di route |
| `revenue.controller.js` | rekap harian/rentang, transaksi manual | guard cashier/admin/owner |
| `promo.controller.js` | validasi, CRUD, usage, stats | `checkFeature` pada list |
| `invoice.controller.js` | list, create, get, update, payment status, email, PDF | `getInvoiceByOrder` dipakai order route |
| `profile.controller.js` | profil, update, avatar | customer/staff |
| `notifications.controller.js` | preferensi notifikasi | 8 flag |
| `addresses.controller.js` | CRUD alamat milik user | kepemilikan di service |
| `upload.controller.js` | handler generik per folder | `StorageService.save` |
| `export.controller.js` | dump SQL, ZIP upload, gabungan | `checkFeature` hanya di `/database` |
| `homepage.controller.js` | hero, design item, category banner | publik untuk GET |
| `accounts.controller.js` | akun lintas tabel, update role/permission, buat customer | owner/staff guard |
| `adminAccounts.controller.js` | staff list/create, promote/revoke, permission dinamis, katalog fitur | `ALL_FEATURES` dari config |
| `activityLog.controller.js` | batch insert, list, PDF, unread, read, retensi, purge manual | `optionalAuth` untuk batch |
| `users.controller.js` | list customer/staff, create staff, soft delete | role legacy |

## Services

### Auth & Akun

| Service | Fungsi penting |
|---|---|
| `customerAuth.service.js` | register, login, token pair, refresh rotation, revoke, verify email, resend, forgot/reset, change password |
| `adminAuth.service.js` | sama untuk staff + `createStaffAccount` |
| `accounts.service.js` | list lintas `users_customer`/`users_admin`, detail + permission, update role transaksional (pindah tabel), create customer |
| `adminAccounts.service.js` | list staff, create staff, promote/revoke, katalog fitur, baca/upsert `admin_permissions` |
| `users.service.js` | list customers/staff, create staff, soft delete |
| `userLookup.js` | helper `findUserById`, `findUserByEmail`, `existsInCustomers/Admins/Either` |
| `profile.service.js` | profil & avatar berdasarkan role |
| `notifications.service.js` | default + upsert preferensi |
| `addresses.service.js` | CRUD alamat dengan scope `userId` |

Catatan:
- Update role customer → staff **memindahkan baris** antar tabel dan menyalin banyak kolom (termasuk token) — rawan jika skema berubah.
- Promote/revoke mempertahankan baris permission untuk re-promote.

### Order & Invoice

| Service | Fungsi penting |
|---|---|
| `orders.service.js` | create/list/find/get, transisi status, edit staff, catatan, tracking, pickup, delivery, attach file, permission delete, delete |
| `orderApprovals.service.js` | map stage, get/record approval, `assertNotLocked` |
| `invoice.service.js` | create, get by id/order, list, `computeInvoicePayment`, update payment status, update invoice |
| `promo.service.js` | CRUD promo, validasi, usage log, stats, increment usage |
| `products.service.js` | normalisasi atribut, modifier harga, CRUD produk/kategori, resolve kategori, visible filter |
| `cart.service.js` | cart per user, add/update/remove/clear/sync |
| `reviews.service.js` | list/create/delete review, cek item sudah direview |

`orders.service.js` adalah modul terbesar (±1.001 baris) dan menanggung terlalu banyak tanggung jawab: transaksi, aturan role, notifikasi, invoice, file cleanup, dan tracking. Lihat `13-technical-debt-and-risks.md`.

### Konten, Analitik, Log

| Service | Fungsi penting |
|---|---|
| `homepage.service.js` | hero multi-banner, design showcase, category banner + reorder |
| `analytics.service.js` | revenue, monthly, visits, product views, best sellers, reset seluruh data revenue |
| `revenue.service.js` | rekap harian/rentang dari order + transaksi manual; create/update/soft-delete |
| `activityLog.service.js` | batch insert, list + read-state, PDF list, purge, retensi di `app_settings` |
| `email.service.js` | 11 fungsi email (verifikasi, reset, order, admin alert, invoice + PDF, promo, login alert) |
| `chat.service.js` | conversation customer/DM, messages, read, hide/delete, unread |

## Middleware

| File | Perilaku |
|---|---|
| `auth.js` | verifikasi Bearer, set `req.user`, blokir staff `must_change_password`, fail-open saat DB error |
| `requireRole.js` | cek role dari token; 401/403 |
| `checkFeature.js` | cek `is_promoted_admin` + `admin_permissions`; skip untuk non-promoted |
| `optionalAuth.js` | mengisi `req.user` bila token valid, tanpa menolak request |
| `upload.js` | Multer memory disk (`os.tmpdir`), MIME allowlist per tipe, limit 100 MB (homepage 10 MB) |
| `errorHandler.js` | normalisasi error upload/body, pesan generik 500 di produksi, stack hanya dev |

Detail upload:

| Tipe | MIME diizinkan | Batas |
|---|---|---|
| design | JPEG, PNG, PDF, ZIP | 100 MB |
| payment | JPEG, PNG, GIF, WEBP, BMP, TIFF, HEIC, PDF, ZIP | 100 MB |
| chat | JPEG, PNG, PDF, ZIP | 100 MB |
| avatar | JPEG, PNG, WEBP, GIF | 100 MB |
| product | JPEG, PNG, WEBP | 100 MB |
| review | JPEG, PNG, WEBP, PDF | 100 MB |
| homepage | JPEG, PNG, WEBP | 10 MB |

Catatan: validasi hanya berdasarkan `mimetype` dari klien (bukan magic bytes), ekstensi asli dipakai saat menyimpan, dan file disimpan ke disk lokal.

## Utils

| File | Isi |
|---|---|
| `jwt.js` | sign/verify access & refresh |
| `hash.js` | bcrypt hash/compare |
| `storage.js` | `StorageService.save/delete`, `ensureUploadDirs`, 7 subdirektori |
| `discounts.js` | normalisasi/serialisasi diskon order & item |
| `invoicePdf.js` | generate PDF invoice (PDFKit), dukungan DP |
| `pagination.js` | helper limit/offset |
| `escapeHtml.js` | sanitasi HTML untuk email/PDF |

## Jobs

`jobs/activityLogPurge.js`:
- dijalankan saat startup (`startActivityLogPurgeJob`);
- membaca setting retensi dari `app_settings`;
- default retensi **0 = auto-purge OFF**;
- menghapus log lebih lama dari cutoff secara berkala;
- kegagalan tidak mematikan server.

`[TIDAK TERVERIFIKASI]` interval job dan apakah memakai `setInterval`/cron.

## Socket

`socket/index.js`:
- inisialisasi `new Server(httpServer, { cors: { origin: config.clientOrigin, credentials: true } })`;
- autentikasi via `handshake.auth.token` (access token);
- customer: join `customer:{id}` dan conversation miliknya;
- staff: join `staff`, `staff:{id}`, semua `customer_chat`, dan DM miliknya;
- tidak ada rate limit/event validation di level socket.

Detail di `10-realtime-chat-notifications.md`.

## Database Helpers

| File | Fungsi |
|---|---|
| `connection.js` | pool mysql2, `query`, `getConnection`, `testConnection` |
| `migrate.js` | eksekusi semua `.sql` berurutan |
| `seedFeatures.js` / `seed_features.sql` | isi katalog `features` |
| `ensureHomepageTables.js` | DDL homepage saat startup |
| `ensureActivityLogTables.js` | DDL activity log saat startup |

`testConnection()` hanya memberi warning; server tetap listen walau DB tidak tersedia. Akibatnya health check bisa tampak hidup padahal API akan gagal.

## Konfigurasi Fitur

`config/features.js` berisi katalog `FEATURE_CATEGORIES` dan key (mis. `dashboard.view`, `orders.view`, `orders.create`, `export.database`, `promo.view`). Katalog ini dipakai:
- `seedFeatures.js` untuk mengisi tabel `features`;
- `adminAccounts.service.js` untuk daftar permission;
- `checkFeature` untuk validasi runtime (hanya 2 route).

## Observability

- Log: `morgan` (dev) / logger sederhana (prod) + `console.error` tersebar.
- Startup: `startup-diag.log` di root proyek.
- Tidak ada request id, structured logging, metrics, tracing, atau error tracker.
- `/diag` menyediakan info runtime (tanpa auth).
- Tidak ada health check DB di endpoint publik.

## Ringkasan Masalah Modul

| Modul | Masalah |
|---|---|
| `orders.service.js` | terlalu besar; aturan status ganda; status hapus usang; notifikasi bercampur |
| `checkFeature.js` | komentar usang; cakupan sempit |
| `upload.js` | limit 100 MB untuk hampir semua tipe; validasi MIME saja |
| `auth.controller.js` | `failedLoginMap` in-memory tanpa TTL |
| `accounts.service.js` | migrasi baris antar tabel menyalin banyak kolom |
| `email.service.js` | 687 baris; template inline; kegagalan fire-and-forget |
| `analytics.service.js` | reset menghapus data; perlu audit ketat |
| `invoicePdf.js` | 15 KB kode PDF; perlu uji layout |
| `activityLog` | DDL ganda (migrasi + ensure) |
| `server.js` | startup tetap lanjut saat DB down |

BERSAMBUNG ke `09-frontend-architecture.md`
