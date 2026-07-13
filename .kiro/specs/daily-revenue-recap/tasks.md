# Rencana Implementasi: Rekap Data Harian (daily-revenue-recap)

## Ikhtisar

Implementasi ini menambahkan modul rekap pendapatan harian ke CashierDashboard. Urutan implementasi mengikuti alur dependency: migrasi database → backend service → backend controller → backend routes → registrasi di app.js → frontend komponen → frontend CSS → integrasi ke CashierDashboardPage.

## Tasks

- [ ] 1. Buat file migrasi SQL untuk tabel `manual_revenue_transactions`
  - Buat file `server/src/db/migrations/042_create_manual_revenue_transactions.sql`
  - Definisikan tabel dengan semua kolom sesuai desain: `id` CHAR(36) PK, `transaction_date` DATE NOT NULL, `source_category` ENUM NOT NULL, `amount` DECIMAL(15,2) NOT NULL, `notes` TEXT nullable, `created_by` CHAR(36) FK ke `users.id`, `updated_by` CHAR(36) FK ke `users.id` nullable, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, `deleted_at` DATETIME nullable
  - Tambahkan INDEX pada `(transaction_date, source_category)`
  - Tambahkan CONSTRAINT FK untuk `created_by` dan `updated_by` ke tabel `users`
  - File ini akan otomatis dieksekusi oleh mekanisme migrasi di `server/src/db/migrate.js`
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Implementasi backend service layer
  - [ ] 2.1 Buat file `server/src/services/revenue.service.js`
    - Import `{ query }` dari `../db/connection.js` dan `{ randomUUID }` dari `crypto`
    - Implementasikan fungsi `getDailyRecap(date)`: query `orders` dengan `DATE(created_at) = ?` dan `status IN ('Finished', 'In Delivery', 'Quality Checking', 'On Progress')` untuk `website_total` dan `website_transactions`; query `manual_revenue_transactions` dengan `transaction_date = ?` dan `deleted_at IS NULL` untuk `manual_by_category` dan `manual_transactions`; hitung `grand_total = website_total + sum(manual_by_category)`
    - Implementasikan fungsi `createManualTransaction({ transaction_date, source_category, amount, notes, userId })`: generate UUID v4, INSERT ke tabel, return entri baru
    - Implementasikan fungsi `updateManualTransaction(id, { transaction_date, source_category, amount, notes, userId })`: UPDATE baris dimana `id = ?` dan `deleted_at IS NULL`, set `updated_by` dan `updated_at`; return entri terupdate atau throw 404 jika tidak ditemukan
    - Implementasikan fungsi `deleteManualTransaction(id, userId)`: UPDATE SET `deleted_at = NOW()` dan `updated_by = userId` dimana `id = ?` dan `deleted_at IS NULL`; throw 404 jika tidak ditemukan
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 5.1_

  - [ ]* 2.2 Tulis property test untuk `getDailyRecap` — Property 1 & 2
    - **Property 1: Struktur respons rekap harian selalu konsisten**
    - **Validates: Requirements 2.1, 2.5**
    - **Property 2: website_total hanya menjumlahkan order dengan status aktif**
    - **Validates: Requirements 2.2**

  - [ ]* 2.3 Tulis property test untuk kalkulasi `grand_total` — Property 3
    - **Property 3: grand_total adalah penjumlahan deterministik**
    - **Validates: Requirements 2.4**

  - [ ]* 2.4 Tulis property test untuk `createManualTransaction` dan `getDailyRecap` — Property 4
    - **Property 4: Round trip buat-dan-baca transaksi manual**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 2.5 Tulis property test untuk pemotongan `notes` — Property 6
    - **Property 6: Pemotongan notes hingga 500 karakter**
    - **Validates: Requirements 3.6**

  - [ ]* 2.6 Tulis property test untuk `updateManualTransaction` — Property 7
    - **Property 7: Update memperbarui field yang tepat dan tidak mengubah field lain**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 2.7 Tulis property test untuk soft delete — Property 8
    - **Property 8: Soft delete — baris tetap ada, tidak muncul di rekap**
    - **Validates: Requirements 5.1**

- [ ] 3. Implementasi backend controller
  - [ ] 3.1 Buat file `server/src/controllers/revenue.controller.js`
    - Import `* as svc` dari `../services/revenue.service.js`
    - Implementasikan fungsi helper `validateTransactionBody({ transaction_date, source_category, amount })`: validasi format tanggal `YYYY-MM-DD`, validasi `source_category` dari enum yang valid, validasi `amount > 0`; kembalikan string pesan error pertama atau null jika valid
    - Implementasikan `getDailyRecap(req, res, next)`: ambil `date` dari query string (default hari ini `new Date().toISOString().slice(0, 10)` jika tidak ada atau format salah), panggil `svc.getDailyRecap(date)`, kembalikan `{ ok: true, data }` dengan status 200
    - Implementasikan `createManualTransaction(req, res, next)`: potong `notes` hingga 500 karakter sebelum validasi, panggil `validateTransactionBody`, jika error kembalikan 422, panggil `svc.createManualTransaction`, kembalikan `{ ok: true, data }` dengan status 201
    - Implementasikan `updateManualTransaction(req, res, next)`: ambil `id` dari `req.params.id`, potong `notes`, panggil `validateTransactionBody`, panggil `svc.updateManualTransaction`, tangani error 404 dari service
    - Implementasikan `deleteManualTransaction(req, res, next)`: ambil `id` dari `req.params.id`, panggil `svc.deleteManualTransaction`, kembalikan `{ ok: true, message: "Transaksi berhasil dihapus." }`
    - _Requirements: 2.1, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_

  - [ ]* 3.2 Tulis unit test untuk `validateTransactionBody` — Property 5
    - **Property 5: Validasi input server — tanggal, kategori, dan amount**
    - **Validates: Requirements 3.3, 3.4, 3.5, 4.4**
    - Test setiap kombinasi input tidak valid menghasilkan status 422
    - Test input valid menghasilkan null (lolos validasi)

- [ ] 4. Buat file route revenue dan daftarkan di app.js
  - [ ] 4.1 Buat file `server/src/routes/revenue.routes.js`
    - Import `Router` dari `express`, import `authenticate` dari `../middleware/auth.js`, import `requireRole` dari `../middleware/requireRole.js`, import `* as ctrl` dari `../controllers/revenue.controller.js`
    - Definisikan `guard = [authenticate, requireRole('cashier', 'admin', 'owner')]`
    - Daftarkan route: `GET /daily-recap`, `POST /manual-transaction`, `PUT /manual-transaction/:id`, `DELETE /manual-transaction/:id` — semua dengan `...guard`
    - _Requirements: 6.1_

  - [ ] 4.2 Modifikasi `server/src/app.js` untuk mendaftarkan revenue routes
    - Tambahkan baris import: `import revenueRoutes from './routes/revenue.routes.js';` setelah baris import `analyticsRoutes`
    - Tambahkan baris `app.use('/api/revenue', revenueRoutes);` setelah baris `app.use('/api/analytics', analyticsRoutes);`
    - _Requirements: 6.2_

- [ ] 5. Checkpoint — Verifikasi backend berfungsi
  - Pastikan semua file backend bisa di-parse tanpa error sintaks
  - Pastikan import dan export konsisten antar file (service → controller → routes → app.js)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implementasi frontend CSS
  - [ ] 6.1 Buat file `src/styles/css/pages/daily-revenue.css`
    - Definisikan class `.rev-kpi-grid` sebagai CSS Grid dengan `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))` dan `gap`
    - Definisikan class `.rev-kpi-card` untuk card individual: border, padding, border-radius, menggunakan `var(--brand-brown)` untuk accent warna
    - Definisikan class `.rev-skeleton` dengan animasi shimmer (`@keyframes rev-shimmer`) untuk loading state
    - Definisikan class `.rev-modal-overlay` sebagai fixed overlay dengan backdrop semi-transparan
    - Definisikan class `.rev-modal` sebagai container modal dengan max-width, padding, border-radius, background putih
    - Semua elemen input/button/tabel menggunakan class global yang sudah ada (`.adm-card`, `.adm-table`, `.adm-btn`, `.adm-btn--primary`, `.adm-input`, `.adm-input--error`, `.offline-field-error`) — tidak perlu didefinisikan ulang
    - Jangan tambahkan CSS variable baru — gunakan `var(--brand-brown)` yang sudah ada
    - _Requirements: 7.4, 11.4_

- [ ] 7. Implementasi komponen frontend `DailyRevenueSection.jsx`
  - [ ] 7.1 Buat skeleton struktur komponen dan state management
    - Buat file `src/components/pages/subadmin/sections/DailyRevenueSection.jsx`
    - Import CSS: `import '../../../../../styles/css/pages/daily-revenue.css'`
    - Import dependencies: `{ useState, useEffect }` dari `react`, `{ api }` dari `../../../../core/httpClient.js`, `{ formatCurrency }` dari `../../../../core/helpers.js`, `{ showToast }` dari `../../../../core/toastEmitter.js`
    - Definisikan state: `selectedDate` (default `new Date().toISOString().slice(0, 10)`), `recap` (null), `loading` (false), `modal` (null), `form` (`{ transaction_date, source_category, amount, notes }`), `fieldErrors` ({}), `submitting` (false)
    - Implementasikan fungsi `loadRecap(date)`: set `loading=true`, `recap=null`, panggil `api.get('/api/revenue/daily-recap?date=' + date)`, set `recap=res.data.data`, tangani error dengan `showToast`
    - Implementasikan `useEffect` yang memanggil `loadRecap(selectedDate)` setiap kali `selectedDate` berubah
    - _Requirements: 7.2, 7.3_

  - [ ] 7.2 Implementasi date picker, KPI cards, dan skeleton loader
    - Render input `<input type="date">` dengan nilai `selectedDate` dan handler `onChange` yang memperbarui `selectedDate`
    - Render section KPI cards (`.rev-kpi-grid`): enam `.rev-kpi-card` untuk Website, Toko Fisik, Shopee, Tokopedia, TikTok Shop, dan Grand Total
    - Saat `loading === true`, ganti konten card dengan elemen `.rev-skeleton`
    - Saat `recap !== null`, tampilkan nilai dari `recap.website_total`, `recap.manual_by_category.*`, dan `recap.grand_total` menggunakan `formatCurrency`
    - _Requirements: 7.2, 7.4, 7.5_

  - [ ] 7.3 Implementasi tabel website (read-only) dan tabel transaksi manual
    - Render tabel website dengan kolom: No. Order, Status, Nominal — data dari `recap.website_transactions`
    - Tambahkan badge bertulisan "Otomatis dari Sistem" di atas tabel website
    - Render tabel manual dengan kolom: Tanggal, Sumber, Nominal, Catatan, Aksi — data dari `recap.manual_transactions`
    - Pada setiap baris tabel manual, tambahkan tombol "Edit" (onClick: buka modal edit dengan data baris) dan tombol "Hapus" (onClick: buka modal konfirmasi hapus)
    - _Requirements: 7.6, 7.7_

  - [ ] 7.4 Implementasi modal form tambah/edit transaksi manual
    - Implementasikan fungsi `validateForm()`: validasi `form.transaction_date` tidak kosong, `form.source_category` dipilih, `form.amount > 0`; set `fieldErrors` dan kembalikan false jika ada error
    - Implementasikan fungsi `handleOpenAdd()`: set `form` ke nilai kosong, set `modal = { mode: 'add' }`
    - Implementasikan fungsi `handleOpenEdit(transaction)`: set `form` ke data transaksi terpilih, set `modal = { mode: 'edit', transaction }`
    - Render modal (`modal.mode === 'add' || modal.mode === 'edit'`) dengan class `.rev-modal-overlay` dan `.rev-modal`
    - Modal berisi field: `<input type="date">` untuk tanggal, `<select>` untuk kategori dengan empat pilihan (`offline_store`, `shopee`, `tokopedia`, `tiktok_shop`), `<input type="number" min="1">` untuk nominal, `<textarea>` untuk catatan
    - Tampilkan pesan `.offline-field-error` dan class `.adm-input--error` pada field yang gagal validasi
    - Tambahkan tombol "Batal" dan "Simpan"; tombol "Batal" menutup modal, tombol "Simpan" memanggil fungsi submit
    - Tombol "＋ Tambah Transaksi" di atas tabel manual memanggil `handleOpenAdd()`
    - _Requirements: 8.1, 8.2, 11.1, 11.2, 11.3_

  - [ ] 7.5 Implementasi submit form tambah dan edit
    - Implementasikan `handleSubmit()`: panggil `validateForm()`, jika gagal return; set `submitting=true`; tentukan metode (POST untuk add, PUT untuk edit); kirim request ke API; jika `ok: true`, set `modal=null`, panggil `loadRecap(selectedDate)`, tampilkan toast sukses; jika `ok: false`, tampilkan toast error tanpa menutup modal; reset `submitting=false`
    - _Requirements: 8.3, 8.4, 9.2, 9.3_

  - [ ] 7.6 Implementasi modal konfirmasi hapus
    - Implementasikan `handleOpenDelete(transaction)`: set `modal = { mode: 'confirm-delete', transaction }`
    - Render modal konfirmasi (`modal.mode === 'confirm-delete'`) dengan teks konfirmasi eksplisit (misal "Apakah Anda yakin ingin menghapus transaksi ini?")
    - Modal berisi dua tombol: "Batal" (menutup modal) dan "Hapus" (memanggil `handleConfirmDelete`)
    - Implementasikan `handleConfirmDelete()`: kirim DELETE ke `/api/revenue/manual-transaction/:id`; jika `ok: true`, set `modal=null`, panggil `loadRecap(selectedDate)`, tampilkan toast sukses; jika `ok: false`, tampilkan toast error
    - Tidak menggunakan `window.confirm()`
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 7.7 Tulis unit test untuk fungsi `validateForm` di `DailyRevenueSection` — Property 9
    - **Property 9: Validasi client-side mencegah submission form tidak valid**
    - **Validates: Requirements 11.1, 11.2, 11.3**
    - Test setiap kondisi form tidak valid: tanggal kosong, kategori tidak dipilih, amount ≤ 0
    - Verifikasi fungsi mengembalikan error dan mencegah API call

- [ ] 8. Integrasi ke `CashierDashboardPage.jsx`
  - [ ] 8.1 Modifikasi `src/components/pages/subadmin/CashierDashboardPage.jsx`
    - Tambahkan baris import: `import DailyRevenueSection from './sections/DailyRevenueSection.jsx';`
    - Tambahkan `{ id: 'recap', label: '📊 Rekap Harian' }` ke array `NAV_ITEMS`
    - Tambahkan `recap: <DailyRevenueSection />,` ke objek `SECTIONS`
    - _Requirements: 7.1_

- [ ] 9. Checkpoint akhir — Verifikasi integrasi penuh
  - Pastikan semua import antar komponen valid dan file ada di path yang benar
  - Pastikan CSS diimport dengan benar di `DailyRevenueSection.jsx`
  - Pastikan tidak ada CSS variable baru yang ditambahkan
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Task bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirement ID spesifik untuk keterlacakan
- Checkpoint memastikan validasi bertahap sebelum melanjutkan ke fase berikutnya
- Property test memvalidasi invariant sistem yang universal
- Unit test memvalidasi contoh spesifik dan kondisi edge case
- Seluruh CSS variable menggunakan `var(--brand-brown)` yang sudah ada — tidak ada CSS variable baru

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "6.1"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4"] },
    { "id": 8, "tasks": ["7.5", "7.6"] },
    { "id": 9, "tasks": ["7.7", "8.1"] }
  ]
}
```
