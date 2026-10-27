# 05 — REFERENSI API

## Konvensi

- Base URL: `/api` (same-origin) atau `VITE_API_URL + /api` pada dev terpisah.
- Autentikasi default: header `Authorization: Bearer <accessToken>`.
- Refresh token dikirim sebagai cookie httpOnly pada `/api/auth/refresh` dan `/api/auth/logout`.
- Respons sukses bervariasi: `{ ok: true, data }`, array langsung, atau objek domain. Klien harus membaca controller terkait.
- Respons error umumnya `{ ok: false, message }`.
- Validasi input memakai `express-validator` pada sebagian route; tidak semua body divalidasi di layer route.
- Semua respons `/api/*` diberi `Cache-Control: no-store`.
- Upload multipart memakai field yang ditentukan per route (`file`, `image`, `avatar`, `photo`).

## Ringkasan Router

| Prefix | Router | Jumlah endpoint |
|---|---|---:|
| `/api/auth` | `auth.routes.js` | 13 |
| `/api/products` | `products.routes.js` | 6 |
| `/api/categories` | `products.routes.js` | 4 |
| `/api/orders` | `orders.routes.js` | 16 |
| `/api/cart` | `cart.routes.js` | 6 |
| `/api/conversations` | `chat.routes.js` | 11 |
| `/api/reviews` | `reviews.routes.js` | 4 |
| `/api/analytics` | `analytics.routes.js` | 9 |
| `/api/revenue` | `revenue.routes.js` | 5 |
| `/api/users` | `users.routes.js` | 4 |
| `/api/promo` | `promo.routes.js` | 7 |
| `/api/profile` | `profile.routes.js` | 5 |
| `/api/addresses` | `addresses.routes.js` | 4 |
| `/api/export` | `export.routes.js` | 3 |
| `/api/homepage` | `homepage.routes.js` | 16 |
| `/api/invoices` | `invoice.routes.js` | 7 |
| `/api/upload` | `upload.routes.js` | 6 |
| `/api/admin/accounts` | `accounts.routes.js` | 4 |
| `/api/admin-accounts` | `adminAccounts.routes.js` | 7 |
| `/api/features` | `features.routes.js` | 1 |
| `/api/activity-log` | `activityLog.routes.js` | 9 |

## Auth — `/api/auth`

Sumber: `server/src/routes/auth.routes.js`.

| Method | Path | Auth | Rate limit | Keterangan |
|---|---|---|---|---|
| POST | `/register` | publik | 100/menit (prod) | registrasi customer; validasi nama/email/phone/password≥6/gender/dob |
| POST | `/login` | publik | 100/menit | login customer |
| POST | `/admin-login` | publik | 100/menit | login staff (`users_admin`) |
| POST | `/refresh` | cookie | 100/menit | rotasi refresh token; deteksi reuse |
| POST | `/logout` | cookie/token | 100/menit | cabut refresh token |
| GET | `/me` | Bearer | — | profil user aktif; tetap boleh saat `must_change_password` |
| POST | `/change-password` | Bearer | — | wajib untuk staff dengan `must_change_password` |
| GET | `/verify-email` | publik (query token) | — | verifikasi email |
| POST | `/resend-verification` | Bearer | 3/menit | kirim ulang verifikasi |
| POST | `/forgot-password` | publik | 5/15 menit | reset customer |
| POST | `/reset-password` | publik (token) | 10/15 menit | reset customer |
| POST | `/staff/forgot-password` | publik | 5/15 menit | reset staff, scoped `users_admin` |
| POST | `/staff/reset-password` | publik (token) | 10/15 menit | reset staff |

## Produk & Kategori

Sumber: `server/src/routes/products.routes.js`.

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/products/upload-image` | Bearer | admin, owner |
| GET | `/api/products` | publik | — |
| GET | `/api/products/search` | publik | — |
| GET | `/api/products/:id` | publik | — |
| POST | `/api/products` | Bearer | admin, owner |
| PUT | `/api/products/:id` | Bearer | admin, owner |
| DELETE | `/api/products/:id` | Bearer | admin, owner |
| GET | `/api/categories` | publik | — |
| POST | `/api/categories` | Bearer | admin, owner |
| PUT | `/api/categories/:id` | Bearer | admin, owner |
| DELETE | `/api/categories/:id` | Bearer | admin, owner |

Catatan: `attributes` divalidasi maksimal 30 atribut, tiap atribut wajib nama dan minimal 1 nilai. `priceCustomer`/`price_customer` dan `priceBroker`/`price_broker` menerima dua gaya penamaan.

## Order — `/api/orders`

Sumber: `server/src/routes/orders.routes.js`.

| Method | Path | Auth | Role | Keterangan |
|---|---|---|---|---|
| GET | `/track` | publik | — | tracking berdasarkan `orderNumber` (+ `phone` opsional) |
| POST | `/` | Bearer | semua role | buat order standar |
| GET | `/my` | Bearer | semua role | daftar order milik user |
| POST | `/custom-customer` | Bearer | semua role | order custom oleh customer |
| POST | `/custom` | Bearer | cs, admin | order custom oleh staff |
| POST | `/offline` | Bearer | offline, admin, cs | order offline |
| GET | `/` | Bearer | semua staff | daftar order staff |
| GET | `/:id` | Bearer | **semua user login** | detail order (lihat temuan IDOR) |
| PATCH | `/:id/status` | Bearer | semua staff | transisi status |
| PATCH | `/:id/note` | Bearer | admin, cs | catatan admin |
| PATCH | `/:id/edit` | Bearer | cs, admin | edit order staff |
| PATCH | `/:id/tracking` | Bearer | qc, admin | nomor resi/kurir |
| PATCH | `/:id/delivery-method` | Bearer | qc, cs, admin | metode kirim |
| PATCH | `/:id/pickup` | Bearer | qc, admin | info pickup |
| DELETE | `/:id` | Bearer | cs, admin, cashier | hapus order (aturan status di service) |
| GET | `/:orderId/invoice` | Bearer | semua login | invoice untuk order |
| POST | `/:id/payment-proof` | Bearer | semua role | upload bukti bayar (field `file`) |
| POST | `/:id/items/:itemId/design` | Bearer | semua role | upload desain item (field `file`) |

## Keranjang — `/api/cart`

Seluruh route memakai `router.use(authenticate)`.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/` | ambil cart user |
| POST | `/items` | tambah item |
| PATCH | `/items/:itemId` | ubah quantity |
| DELETE | `/items/:itemId` | hapus item |
| DELETE | `/` | kosongkan cart |
| POST | `/sync` | sinkronisasi cart (guest/local → server) |

## Chat — `/api/conversations`

Sumber: `server/src/routes/chat.routes.js`.

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/unread-count` | Bearer | customer |
| GET | `/` | Bearer | semua staff |
| POST | `/` | Bearer | semua login (customer get/create) |
| GET | `/dm` | Bearer | semua staff |
| POST | `/dm` | Bearer | semua staff |
| GET | `/:id/messages` | Bearer | semua login (controller membatasi) |
| POST | `/:id/messages` | Bearer | semua login |
| POST | `/:id/messages/file` | Bearer | semua login (field `file`) |
| POST | `/mark-read` | Bearer | customer |
| PATCH | `/:id/read` | Bearer | semua staff |
| PATCH | `/:id/hide` | Bearer | admin |
| DELETE | `/:id` | Bearer | admin |

Catatan: route `/mark-read` dideklarasikan **setelah** `/:id/messages`, sehingga `POST /api/conversations/mark-read` berpotensi tertangkap pola `/:id/messages`? Tidak — jumlah segmen berbeda (`/mark-read` vs `/:id/messages`), jadi aman. `GET /dm` sengaja sebelum `/:id/messages`.

## Review — `/api/reviews`

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/` | publik | — |
| GET | `/reviewed-items` | Bearer | customer |
| POST | `/` | Bearer | customer; multipart `photo`; rating 1–5 |
| DELETE | `/:id` | Bearer | controller menentukan pemilik/admin |

## Analitik — `/api/analytics`

| Method | Path | Auth | Role | Limit |
|---|---|---|---|---|
| GET | `/revenue` | Bearer | owner, admin | — |
| GET | `/monthly` | Bearer | owner, admin | — |
| GET | `/visits` | Bearer | owner, admin | — |
| GET | `/visits/total` | Bearer | owner, admin | — |
| GET | `/product-views` | Bearer | owner, admin | — |
| GET | `/best-sellers` | Bearer | owner, admin | — |
| POST | `/reset` | Bearer | owner | 3/jam |
| POST | `/visit` | publik | — | 60/menit |
| POST | `/product-view` | publik | — | 60/menit |

## Rekap Pendapatan — `/api/revenue`

Guard: `authenticate + requireRole('cashier','admin','owner')`.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/daily-recap` | rekap harian (order + transaksi manual) |
| GET | `/recap-range` | rekap rentang tanggal |
| POST | `/manual-transaction` | tambah transaksi manual |
| PUT | `/manual-transaction/:id` | ubah transaksi manual |
| DELETE | `/manual-transaction/:id` | soft delete transaksi manual |

## User & Staff — `/api/users`

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/customers` | Bearer | semua staff |
| GET | `/staff` | Bearer | semua staff |
| POST | `/staff` | Bearer | admin |
| DELETE | `/:id` | Bearer | owner |

## Promo — `/api/promo`

| Method | Path | Auth | Role | Catatan |
|---|---|---|---|---|
| POST | `/validate` | Bearer | customer | validasi terhadap subtotal |
| GET | `/stats` | Bearer | admin, owner | sebelum `/:id` |
| GET | `/` | Bearer | admin, owner + `checkFeature('promo.view')` | trial permission dinamis |
| POST | `/` | Bearer | admin, owner | — |
| PUT | `/:id` | Bearer | admin, owner | — |
| DELETE | `/:id` | Bearer | admin, owner | — |
| GET | `/:id/usage` | Bearer | admin, owner | log pemakaian |

## Profil & Notifikasi — `/api/profile`

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/` | Bearer | profil |
| PUT | `/` | Bearer | ubah nama/phone/dob/gender |
| POST | `/avatar` | Bearer | multipart `avatar` |
| GET | `/notifications` | Bearer | preferensi notifikasi |
| PUT | `/notifications` | Bearer | ubah preferensi |

## Alamat — `/api/addresses`

| Method | Path | Auth |
|---|---|---|
| GET | `/` | Bearer |
| POST | `/` | Bearer |
| PUT | `/:id` | Bearer |
| DELETE | `/:id` | Bearer |

## Ekspor — `/api/export`

| Method | Path | Auth | Role | Fitur |
|---|---|---|---|---|
| GET | `/database` | Bearer | owner, admin | `checkFeature('export.database')` |
| GET | `/uploads` | Bearer | owner, admin | — |
| GET | `/all` | Bearer | owner, admin | — |

## Homepage — `/api/homepage`

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/upload-image` | Bearer | admin, owner |
| GET | `/hero` | publik | — |
| GET | `/hero/all` | Bearer | admin, owner |
| POST | `/hero` | Bearer | admin, owner |
| PUT | `/hero/reorder` | Bearer | admin, owner |
| PUT | `/hero/:id` | Bearer | admin, owner |
| DELETE | `/hero/:id` | Bearer | admin, owner |
| GET | `/design-items` | publik | — |
| GET | `/design-items/all` | Bearer | admin, owner |
| POST | `/design-items` | Bearer | admin, owner |
| PUT | `/design-items/reorder` | Bearer | admin, owner |
| PUT | `/design-items/:id` | Bearer | admin, owner |
| DELETE | `/design-items/:id` | Bearer | admin, owner |
| GET | `/cat-banners` | publik | — |
| GET | `/cat-banners/map` | publik | — |
| POST/PUT | `/cat-banners` | Bearer | admin, owner |
| DELETE | `/cat-banners/:id` | Bearer | admin, owner |

## Invoice — `/api/invoices`

`INVOICE_ROLES = ['cashier','admin','owner']`; `VIEW_ROLES = INVOICE_ROLES + ['cs','operational','qc','offline']`.

| Method | Path | Role |
|---|---|---|
| GET | `/` | VIEW_ROLES |
| POST | `/` | INVOICE_ROLES |
| GET | `/:id` | VIEW_ROLES |
| PATCH | `/:id` | INVOICE_ROLES |
| PATCH | `/:id/payment-status` | INVOICE_ROLES |
| POST | `/:id/send-email` | INVOICE_ROLES |
| GET | `/:id/pdf` | VIEW_ROLES |

## Upload — `/api/upload`

Semua route `authenticate`; field multipart `file`.

| Method | Path | Folder |
|---|---|---|
| POST | `/design` | designs |
| POST | `/payment` | payments |
| POST | `/avatar` | avatars |
| POST | `/chat` | chat |
| POST | `/product` | products |
| POST | `/review` | reviews |

## Akun (Owner/Staff) — `/api/admin/accounts`

| Method | Path | Guard |
|---|---|---|
| GET | `/` | owner |
| GET | `/:id` | owner |
| PUT | `/:id` | owner |
| POST | `/customers` | staff (admin/owner/cashier/cs/operational/qc/offline) |

## Admin Accounts & Permission — `/api/admin-accounts`

| Method | Path | Guard |
|---|---|---|
| GET | `/` | owner/admin |
| POST | `/` | owner/admin |
| GET | `/customers` | owner/admin |
| POST | `/:userId/promote` | owner/admin |
| POST | `/:userId/revoke` | owner/admin |
| GET | `/:userId/permissions` | owner/admin |
| PUT | `/:userId/permissions` | owner/admin |

## Feature Catalog — `/api/features`

| Method | Path | Role |
|---|---|---|
| GET | `/` | owner |

## Activity Log — `/api/activity-log`

Guard staff; `POST /batch` memakai `optionalAuth` + `batchLimiter`.

| Method | Path | Keterangan |
|---|---|---|
| POST | `/batch` | kirim batch event dari klien |
| GET | `/pdf` | ekspor PDF |
| GET | `/unread-count` | jumlah belum dibaca |
| POST | `/read-all` | tandai semua dibaca |
| GET | `/retention` | baca konfigurasi retensi |
| PUT | `/retention` | ubah retensi |
| DELETE | `/older-than` | hapus log lebih lama dari batas |
| GET | `/` | daftar log |
| POST | `/:id/read` | tandai satu log dibaca |

## Endpoint Non-API

| Method | Path | Keterangan |
|---|---|---|
| GET | `/diag` | diagnostik runtime **tanpa auth** |
| GET | `/diag/log` | isi `startup-diag.log` **tanpa auth** |
| GET | `/uploads/*` | static file upload **tanpa auth** |
| GET | `/assets/*` | static build, cache 1 tahun |
| GET | `*` | SPA fallback `index.html` |

## Catatan Kontrak

- Tidak ada dokumentasi OpenAPI/Swagger.
- Nama field campuran `snake_case` (DB) dan `camelCase` (payload frontend), terutama produk.
- Beberapa endpoint mengembalikan struktur berbeda; jangan mengasumsikan envelope seragam.
- Status HTTP error bergantung `err.status`; validasi express-validator ditangani controller (`400`/`422`).
- Rate limit memakai IP dari `trust proxy = 1`.

BERSAMBUNG ke `06-authentication-authorization.md`
