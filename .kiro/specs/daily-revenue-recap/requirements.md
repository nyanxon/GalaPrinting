# Requirements Document

## Introduction

Fitur Rekap Data Harian memungkinkan pengguna berperan Kasir (cashier), Admin, dan Owner untuk melihat dan mencatat pendapatan harian dari semua saluran penjualan. Pendapatan dari website (tabel `orders`) ditampilkan secara otomatis berdasarkan status aktif. Pendapatan dari toko fisik (offline_store), Shopee, Tokopedia, dan TikTok Shop diinput secara manual per transaksi. Halaman ini ditambahkan sebagai seksi baru "📊 Rekap Harian" di dalam `CashierDashboardPage`.

## Glossary

- **RevenueSystem**: Sistem backend (Express + MySQL) yang mengelola endpoint `/api/revenue/*` dan tabel `manual_revenue_transactions`.
- **RecapPage**: Komponen frontend React `DailyRevenueSection.jsx` yang ditampilkan di dalam `CashierDashboardPage`.
- **ManualTransaction**: Satu entri pendapatan yang diinput secara manual oleh pengguna, disimpan di tabel `manual_revenue_transactions`.
- **WebsiteTransaction**: Entri dari tabel `orders` dengan status aktif (`Finished`, `In Delivery`, `Quality Checking`, `On Progress`).
- **SourceCategory**: Kategori sumber pendapatan manual, salah satu dari: `offline_store`, `shopee`, `tokopedia`, `tiktok_shop`.
- **DailyRecap**: Agregasi total pendapatan per tanggal dan per sumber, mencakup website dan semua kategori manual.
- **Kasir**: Pengguna dengan role `cashier` yang memiliki akses ke fitur ini.
- **AuthenticatedUser**: Pengguna yang sudah terautentikasi dan memegang role `cashier`, `admin`, atau `owner`.
- **SoftDelete**: Mekanisme penghapusan data dengan mengisi kolom `deleted_at`, tanpa menghapus baris dari database.

---

## Requirements

### Requirement 1: Migrasi Database

**User Story:** Sebagai developer, saya ingin tabel `manual_revenue_transactions` tersedia di database, sehingga transaksi pendapatan manual dapat disimpan dan dikelola.

#### Acceptance Criteria

1. THE RevenueSystem SHALL menyediakan tabel `manual_revenue_transactions` dengan kolom: `id` (CHAR 36, PK), `transaction_date` (DATE, NOT NULL), `source_category` (ENUM `offline_store`, `shopee`, `tokopedia`, `tiktok_shop`, NOT NULL), `amount` (DECIMAL 15,2, NOT NULL), `notes` (TEXT, nullable), `created_by` (CHAR 36, FK ke `users.id`, NOT NULL), `updated_by` (CHAR 36, FK ke `users.id`, nullable), `created_at` (DATETIME, NOT NULL), `updated_at` (DATETIME, NOT NULL), `deleted_at` (DATETIME, nullable).
2. THE RevenueSystem SHALL mendefinisikan INDEX pada kombinasi kolom `(transaction_date, source_category)` di tabel `manual_revenue_transactions`.
3. THE RevenueSystem SHALL menggunakan file migrasi bernomor berurutan (`042_create_manual_revenue_transactions.sql`) yang kompatibel dengan mekanisme migrasi yang sudah ada di `server/src/db/migrate.js`.

---

### Requirement 2: Endpoint GET Rekap Harian

**User Story:** Sebagai Kasir, saya ingin mendapatkan data rekap pendapatan untuk satu tanggal tertentu, sehingga saya bisa melihat total dari semua sumber sekaligus.

#### Acceptance Criteria

1. WHEN permintaan GET `/api/revenue/daily-recap?date=YYYY-MM-DD` diterima dengan token valid dan role yang diizinkan, THE RevenueSystem SHALL mengembalikan respons `{ ok: true, data: { date, website_total, manual_by_category, grand_total, website_transactions, manual_transactions } }` dengan status HTTP 200.
2. THE RevenueSystem SHALL menghitung `website_total` sebagai jumlah kolom `subtotal` dari tabel `orders` dimana `DATE(created_at) = date` dan `status IN ('Finished', 'In Delivery', 'Quality Checking', 'On Progress')`.
3. THE RevenueSystem SHALL menghitung `manual_by_category` sebagai objek yang berisi total `amount` per `source_category` untuk baris `manual_revenue_transactions` dimana `transaction_date = date` dan `deleted_at IS NULL`.
4. THE RevenueSystem SHALL menghitung `grand_total` sebagai penjumlahan `website_total` dan semua nilai di `manual_by_category`.
5. THE RevenueSystem SHALL menyertakan daftar `website_transactions` (baris orders aktif pada tanggal tersebut) dan daftar `manual_transactions` (baris manual tidak terhapus pada tanggal tersebut) dalam respons.
6. IF parameter `date` tidak disertakan atau formatnya bukan `YYYY-MM-DD`, THEN THE RevenueSystem SHALL menggunakan tanggal hari ini (zona waktu server) sebagai nilai default.
7. IF token tidak valid atau tidak disertakan, THEN THE RevenueSystem SHALL mengembalikan respons `{ ok: false, message: "Token tidak valid atau sudah kedaluwarsa." }` dengan status HTTP 401.
8. IF role pengguna bukan `cashier`, `admin`, atau `owner`, THEN THE RevenueSystem SHALL mengembalikan respons `{ ok: false, message: "Akses ditolak." }` dengan status HTTP 403.

---

### Requirement 3: Endpoint POST Buat Transaksi Manual

**User Story:** Sebagai Kasir, saya ingin menambahkan transaksi pendapatan manual, sehingga penjualan dari toko fisik dan marketplace dapat tercatat.

#### Acceptance Criteria

1. WHEN permintaan POST `/api/revenue/manual-transaction` diterima dengan body `{ transaction_date, source_category, amount, notes }` dan token valid, THE RevenueSystem SHALL menyimpan entri baru di tabel `manual_revenue_transactions` dan mengembalikan `{ ok: true, data: <entri_baru> }` dengan status HTTP 201.
2. THE RevenueSystem SHALL mengisi `id` dengan UUID v4 yang baru digenerate, `created_by` dengan `req.user.id`, `created_at` dan `updated_at` dengan waktu saat ini.
3. IF `transaction_date` kosong atau bukan format `YYYY-MM-DD`, THEN THE RevenueSystem SHALL mengembalikan `{ ok: false, message: "Tanggal transaksi wajib diisi dan harus berformat YYYY-MM-DD." }` dengan status HTTP 422.
4. IF `source_category` kosong atau bukan salah satu dari `offline_store`, `shopee`, `tokopedia`, `tiktok_shop`, THEN THE RevenueSystem SHALL mengembalikan `{ ok: false, message: "Kategori sumber tidak valid." }` dengan status HTTP 422.
5. IF `amount` kosong, bukan angka, atau bernilai kurang dari atau sama dengan 0, THEN THE RevenueSystem SHALL mengembalikan `{ ok: false, message: "Nominal transaksi wajib diisi dan harus lebih dari 0." }` dengan status HTTP 422.
6. IF `notes` disertakan, THEN THE RevenueSystem SHALL memotong nilai `notes` hingga maksimal 500 karakter sebelum menyimpan.

---

### Requirement 4: Endpoint PUT Edit Transaksi Manual

**User Story:** Sebagai Kasir, saya ingin mengedit transaksi pendapatan manual yang sudah ada, sehingga kesalahan input dapat diperbaiki.

#### Acceptance Criteria

1. WHEN permintaan PUT `/api/revenue/manual-transaction/:id` diterima dengan body valid dan token valid, THE RevenueSystem SHALL memperbarui entri di tabel `manual_revenue_transactions` dan mengembalikan `{ ok: true, data: <entri_terupdate> }` dengan status HTTP 200.
2. THE RevenueSystem SHALL mengisi `updated_by` dengan `req.user.id` dan memperbarui `updated_at` dengan waktu saat ini pada setiap operasi edit.
3. IF transaksi dengan `:id` yang diberikan tidak ditemukan atau `deleted_at IS NOT NULL`, THEN THE RevenueSystem SHALL mengembalikan `{ ok: false, message: "Transaksi tidak ditemukan." }` dengan status HTTP 404.
4. IF salah satu field yang dikirimkan tidak valid (mengikuti aturan validasi yang sama seperti Requirement 3), THEN THE RevenueSystem SHALL mengembalikan pesan error validasi yang sesuai dengan status HTTP 422.

---

### Requirement 5: Endpoint DELETE Soft Delete Transaksi Manual

**User Story:** Sebagai Kasir, saya ingin menghapus transaksi pendapatan manual, sehingga entri yang salah tidak mempengaruhi total rekap.

#### Acceptance Criteria

1. WHEN permintaan DELETE `/api/revenue/manual-transaction/:id` diterima dengan token valid, THE RevenueSystem SHALL mengisi kolom `deleted_at` dengan waktu saat ini dan mengisi `updated_by` dengan `req.user.id`, tanpa menghapus baris dari database, lalu mengembalikan `{ ok: true, message: "Transaksi berhasil dihapus." }` dengan status HTTP 200.
2. IF transaksi dengan `:id` yang diberikan tidak ditemukan atau `deleted_at IS NOT NULL`, THEN THE RevenueSystem SHALL mengembalikan `{ ok: false, message: "Transaksi tidak ditemukan." }` dengan status HTTP 404.

---

### Requirement 6: Registrasi Route Backend

**User Story:** Sebagai developer, saya ingin route `/api/revenue/*` terdaftar di Express app, sehingga semua endpoint rekap harian dapat diakses.

#### Acceptance Criteria

1. THE RevenueSystem SHALL mendaftarkan semua route revenue di file `server/src/routes/revenue.routes.js` yang baru, dengan middleware `authenticate` dan `requireRole('cashier', 'admin', 'owner')` diterapkan pada seluruh router.
2. THE RevenueSystem SHALL mendaftarkan router revenue di `server/src/app.js` pada path `/api/revenue` sebelum middleware static file serving.

---

### Requirement 7: Komponen Halaman Rekap Harian (Frontend)

**User Story:** Sebagai Kasir, saya ingin melihat rekap pendapatan harian di dashboard saya, sehingga saya dapat memantau pendapatan dari semua sumber dalam satu tampilan.

#### Acceptance Criteria

1. THE RecapPage SHALL ditambahkan sebagai entri `{ id: 'recap', label: '📊 Rekap Harian' }` pada array `NAV_ITEMS` dan sebagai kunci `recap` pada objek `SECTIONS` di `CashierDashboardPage.jsx`.
2. THE RecapPage SHALL menampilkan date picker (type `date`) dengan nilai default tanggal hari ini (format `YYYY-MM-DD`) saat pertama kali dimuat.
3. WHEN tanggal di date picker diubah, THE RecapPage SHALL memanggil ulang `GET /api/revenue/daily-recap?date=<tanggal_baru>` dan memperbarui seluruh tampilan dengan data terbaru.
4. WHILE data sedang dimuat dari API, THE RecapPage SHALL menampilkan elemen skeleton loader menggunakan class CSS `.rev-skeleton`.
5. THE RecapPage SHALL menampilkan summary cards (menggunakan class CSS `.rev-kpi-card`) untuk setiap sumber: `Website (Otomatis)`, `Toko Fisik`, `Shopee`, `Tokopedia`, `TikTok Shop`, dan satu card `Grand Total`.
6. THE RecapPage SHALL menampilkan tabel transaksi website (read-only) dengan badge bertulisan "Otomatis dari Sistem", memuat data dari field `website_transactions` pada respons API.
7. THE RecapPage SHALL menampilkan tabel transaksi manual dengan tombol "Edit" dan "Hapus" per baris, memuat data dari field `manual_transactions` pada respons API.

---

### Requirement 8: Form Tambah Transaksi Manual (Frontend)

**User Story:** Sebagai Kasir, saya ingin menambahkan transaksi pendapatan manual melalui form, sehingga penjualan dari marketplace dan toko fisik dapat dicatat dengan mudah.

#### Acceptance Criteria

1. THE RecapPage SHALL menampilkan tombol "＋ Tambah Transaksi" yang ketika diklik, membuka modal form berisi field: tanggal transaksi, kategori sumber (dropdown dengan pilihan `offline_store`, `shopee`, `tokopedia`, `tiktok_shop`), nominal (input angka), dan catatan (textarea, opsional).
2. WHEN pengguna mengklik tombol simpan pada modal dan validasi client-side gagal, THE RecapPage SHALL menampilkan pesan error inline di bawah setiap field yang tidak valid menggunakan class CSS `.offline-field-error` dan memberi border merah dengan class `.adm-input--error` pada input yang bersangkutan, tanpa menutup modal.
3. WHEN pengguna mengklik tombol simpan pada modal dan semua field valid, THE RecapPage SHALL mengirimkan permintaan POST ke `/api/revenue/manual-transaction` dan menutup modal jika respons API `ok: true`, lalu memuat ulang data rekap.
4. IF respons API mengembalikan `ok: false`, THEN THE RecapPage SHALL menampilkan pesan error dari field `message` menggunakan toast notification, tanpa menutup modal.

---

### Requirement 9: Edit Transaksi Manual (Frontend)

**User Story:** Sebagai Kasir, saya ingin mengedit transaksi manual yang sudah ada, sehingga kesalahan input dapat diperbaiki langsung dari tabel.

#### Acceptance Criteria

1. WHEN pengguna mengklik tombol "Edit" pada baris transaksi manual, THE RecapPage SHALL membuka modal form yang sama dengan field terisi data transaksi yang dipilih.
2. WHEN pengguna mengklik tombol simpan pada modal edit dan semua field valid, THE RecapPage SHALL mengirimkan permintaan PUT ke `/api/revenue/manual-transaction/:id` dan menutup modal jika respons API `ok: true`, lalu memuat ulang data rekap.
3. IF respons API PUT mengembalikan `ok: false`, THEN THE RecapPage SHALL menampilkan pesan error dari field `message` menggunakan toast notification, tanpa menutup modal.

---

### Requirement 10: Konfirmasi dan Hapus Transaksi Manual (Frontend)

**User Story:** Sebagai Kasir, saya ingin menghapus transaksi manual dengan konfirmasi terlebih dahulu, sehingga penghapusan tidak terjadi secara tidak sengaja.

#### Acceptance Criteria

1. WHEN pengguna mengklik tombol "Hapus" pada baris transaksi manual, THE RecapPage SHALL menampilkan modal konfirmasi yang menanyakan apakah pengguna yakin ingin menghapus transaksi tersebut, tanpa menggunakan fungsi `window.confirm()` bawaan browser.
2. WHEN pengguna mengkonfirmasi penghapusan pada modal, THE RecapPage SHALL mengirimkan permintaan DELETE ke `/api/revenue/manual-transaction/:id` dan menutup modal konfirmasi jika respons API `ok: true`, lalu memuat ulang data rekap.
3. IF respons API DELETE mengembalikan `ok: false`, THEN THE RecapPage SHALL menampilkan pesan error dari field `message` menggunakan toast notification.

---

### Requirement 11: Validasi Client-Side (Frontend)

**User Story:** Sebagai Kasir, saya ingin mendapat umpan balik validasi segera saat mengisi form, sehingga saya tahu field mana yang perlu diperbaiki sebelum mengirim data.

#### Acceptance Criteria

1. THE RecapPage SHALL memvalidasi bahwa field tanggal tidak kosong sebelum pengiriman form; WHEN kosong, THE RecapPage SHALL menampilkan pesan "Tanggal transaksi wajib diisi." di bawah field menggunakan class `.offline-field-error`.
2. THE RecapPage SHALL memvalidasi bahwa field kategori dipilih sebelum pengiriman form; WHEN tidak dipilih, THE RecapPage SHALL menampilkan pesan "Kategori sumber wajib dipilih." di bawah field menggunakan class `.offline-field-error`.
3. THE RecapPage SHALL memvalidasi bahwa nominal lebih dari 0 sebelum pengiriman form; WHEN bernilai 0 atau kosong, THE RecapPage SHALL menampilkan pesan "Nominal wajib diisi dan harus lebih dari 0." di bawah field menggunakan class `.offline-field-error`.
4. THE RecapPage SHALL menggunakan CSS variable `--brand-brown` dan class CSS yang sudah ada (`.adm-card`, `.adm-table`, `.adm-btn`, `.adm-btn--primary`, `.adm-input`) untuk semua elemen antarmuka, tanpa menambahkan CSS variable baru.
