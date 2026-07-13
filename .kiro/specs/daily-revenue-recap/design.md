# Design Document — Rekap Data Harian (daily-revenue-recap)

## Overview

Fitur ini menambahkan modul rekap pendapatan harian ke CashierDashboard. Backend menyediakan tiga endpoint REST di bawah `/api/revenue` yang dilindungi JWT + role check. Frontend menyajikan ringkasan KPI per sumber, tabel transaksi website (read-only), dan tabel transaksi manual yang dapat ditambah/edit/hapus melalui modal.

Stack: Express.js + MySQL (mysql2 pool) di backend; React + Vite + JSX di frontend.

---

## Architecture

```
Browser (React)
  └── CashierDashboardPage.jsx
        └── DailyRevenueSection.jsx
              ├── GET  /api/revenue/daily-recap?date=YYYY-MM-DD
              ├── POST /api/revenue/manual-transaction
              ├── PUT  /api/revenue/manual-transaction/:id
              └── DEL  /api/revenue/manual-transaction/:id

Express App (server/src/app.js)
  └── /api/revenue  → revenue.routes.js
        ├── authenticate   (JWT middleware)
        ├── requireRole('cashier','admin','owner')
        └── revenue.controller.js
              └── revenue.service.js
                    └── mysql2 pool (connection.js)
                          └── manual_revenue_transactions  (migration 042)
                          └── orders  (tabel yang sudah ada)
```

---

## Database Schema

### Tabel baru: `manual_revenue_transactions`

File migrasi: `server/src/db/migrations/042_create_manual_revenue_transactions.sql`

```sql
CREATE TABLE IF NOT EXISTS manual_revenue_transactions (
  id               CHAR(36)        NOT NULL,
  transaction_date DATE            NOT NULL,
  source_category  ENUM(
    'offline_store','shopee','tokopedia','tiktok_shop'
  )                                NOT NULL,
  amount           DECIMAL(15, 2)  NOT NULL,
  notes            TEXT,
  created_by       CHAR(36)        NOT NULL,
  updated_by       CHAR(36),
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME,
  PRIMARY KEY (id),
  CONSTRAINT fk_mrt_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_mrt_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  INDEX idx_mrt_date_category (transaction_date, source_category)
);
```

### Tabel yang dipakai (sudah ada): `orders`

Kolom yang relevan: `id`, `order_number`, `customer_id`, `subtotal`, `status`, `created_at`.

Status aktif: `'Finished'`, `'In Delivery'`, `'Quality Checking'`, `'On Progress'`.

---

## Backend Components

### `server/src/services/revenue.service.js`

Layer bisnis. Semua akses database dilakukan melalui fungsi `query` dari `connection.js`.

**Fungsi yang diekspor:**

```javascript
/**
 * Hitung rekap harian untuk satu tanggal.
 * @param {string} date - format YYYY-MM-DD
 * @returns {Promise<DailyRecap>}
 */
export async function getDailyRecap(date)

/**
 * Buat satu entri transaksi manual.
 * @param {{ transaction_date, source_category, amount, notes, userId }} data
 * @returns {Promise<ManualTransaction>}
 */
export async function createManualTransaction(data)

/**
 * Perbarui entri yang sudah ada.
 * @param {string} id
 * @param {{ transaction_date, source_category, amount, notes, userId }} data
 * @returns {Promise<ManualTransaction>}
 */
export async function updateManualTransaction(id, data)

/**
 * Soft-delete transaksi.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function deleteManualTransaction(id, userId)
```

**Tipe data respons `DailyRecap`:**

```javascript
{
  date: string,            // YYYY-MM-DD
  website_total: number,
  manual_by_category: {
    offline_store: number,
    shopee: number,
    tokopedia: number,
    tiktok_shop: number,
  },
  grand_total: number,
  website_transactions: Array<{
    id, order_number, customer_id, subtotal, status, created_at
  }>,
  manual_transactions: Array<{
    id, transaction_date, source_category, amount, notes,
    created_by, updated_by, created_at, updated_at
  }>,
}
```

**Logika query `getDailyRecap`:**

1. Query `orders` dengan `DATE(created_at) = ?` dan `status IN (...)` → jumlahkan `subtotal` sebagai `website_total`, ambil semua baris sebagai `website_transactions`.
2. Query `manual_revenue_transactions` dengan `transaction_date = ?` dan `deleted_at IS NULL` → hitung total per `source_category` sebagai `manual_by_category`, ambil semua baris sebagai `manual_transactions`.
3. Hitung `grand_total = website_total + sum(manual_by_category)`.

### `server/src/controllers/revenue.controller.js`

Pola identik dengan `analytics.controller.js`: ekstrak param, panggil service, wrap respons.

```javascript
export async function getDailyRecap(req, res, next)   // GET  daily-recap
export async function createManualTransaction(req, res, next)  // POST manual-transaction
export async function updateManualTransaction(req, res, next)  // PUT  manual-transaction/:id
export async function deleteManualTransaction(req, res, next)  // DEL  manual-transaction/:id
```

**Helper validasi** (dalam file yang sama):

```javascript
/**
 * Validasi body transaksi manual.
 * @returns {string|null} pesan error pertama, atau null jika valid.
 */
function validateTransactionBody({ transaction_date, source_category, amount })
```

### `server/src/routes/revenue.routes.js`

```javascript
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/revenue.controller.js';

const router = Router();
const guard = [authenticate, requireRole('cashier', 'admin', 'owner')];

router.get('/daily-recap',               ...guard, ctrl.getDailyRecap);
router.post('/manual-transaction',        ...guard, ctrl.createManualTransaction);
router.put('/manual-transaction/:id',     ...guard, ctrl.updateManualTransaction);
router.delete('/manual-transaction/:id',  ...guard, ctrl.deleteManualTransaction);

export default router;
```

### Modifikasi `server/src/app.js`

Tambahkan satu baris import dan satu baris `app.use` setelah baris `analyticsRoutes` yang sudah ada:

```javascript
// Tambah di blok import (setelah analyticsRoutes):
import revenueRoutes from './routes/revenue.routes.js';

// Tambah di blok app.use (setelah /api/analytics):
app.use('/api/revenue', revenueRoutes);
```

---

## Frontend Components

### `src/components/pages/subadmin/sections/DailyRevenueSection.jsx`

Komponen utama yang berisi:

1. **State utama**
   - `selectedDate` — string `YYYY-MM-DD`, default hari ini
   - `recap` — data dari API, null saat loading
   - `loading` — boolean
   - `modal` — `{ mode: 'add'|'edit'|'confirm-delete', transaction?: object } | null`
   - `form` — `{ transaction_date, source_category, amount, notes }`
   - `fieldErrors` — objek kesalahan validasi
   - `submitting` — boolean

2. **KPI Cards (`.rev-kpi-card`)**

   Enam card: Website (Otomatis), Toko Fisik, Shopee, Tokopedia, TikTok Shop, Grand Total. Saat loading, tampilkan skeleton (`.rev-skeleton`).

3. **Tabel Website (read-only)**

   Kolom: No. Order, Status, Nominal. Badge "Otomatis dari Sistem". Data dari `recap.website_transactions`.

4. **Tabel Manual**

   Kolom: Tanggal, Sumber, Nominal, Catatan, Aksi (Edit / Hapus). Data dari `recap.manual_transactions`.

5. **Modal Form (Tambah / Edit)**

   Field:
   - `transaction_date` — `<input type="date">`
   - `source_category` — `<select>` dengan empat pilihan
   - `amount` — `<input type="number" min="1">`
   - `notes` — `<textarea>` (opsional)

   Validasi client-side sebelum submit: lihat bagian [Validation Logic](#validation-logic).

6. **Modal Konfirmasi Hapus**

   Teks konfirmasi eksplisit, dua tombol: "Batal" dan "Hapus". Tidak menggunakan `window.confirm()`.

### Modifikasi `CashierDashboardPage.jsx`

```jsx
// Tambah import
import DailyRevenueSection from './sections/DailyRevenueSection.jsx';

// Tambah ke NAV_ITEMS
{ id: 'recap', label: '📊 Rekap Harian' }

// Tambah ke SECTIONS
recap: <DailyRevenueSection />,
```

### `src/styles/css/pages/daily-revenue.css`

File CSS baru hanya untuk layout spesifik yang belum dicakup oleh class global. Menggunakan CSS variable `--brand-brown` yang sudah ada. Tidak menambahkan CSS variable baru.

Kelas yang mungkin didefinisikan di sini:
- `.rev-kpi-grid` — grid layout untuk summary cards
- `.rev-kpi-card` — card individual (jika belum ada global)
- `.rev-skeleton` — shimmer animation untuk loading state (jika belum ada global)
- `.rev-modal-overlay`, `.rev-modal` — overlay dan container modal

Semua elemen lain (input, button, tabel, toolbar) menggunakan class global yang sudah ada: `.adm-card`, `.adm-table`, `.adm-btn`, `.adm-btn--primary`, `.adm-input`, `.adm-input--error`, `.offline-field-error`.

---

## Data Flow

### GET Rekap Harian

```
User memilih tanggal
  → selectedDate diperbarui
  → useEffect dipanggil → loading=true, recap=null
  → api.get('/api/revenue/daily-recap?date=' + selectedDate)
  → authenticate → requireRole → getDailyRecap controller
  → revenue.service.getDailyRecap(date)
    → query orders (website_total + website_transactions)
    → query manual_revenue_transactions (manual_by_category + manual_transactions)
    → hitung grand_total
  → { ok:true, data: DailyRecap }
  → recap=data, loading=false
  → render KPI cards + kedua tabel
```

### POST Transaksi Manual

```
User klik "＋ Tambah Transaksi" → modal={mode:'add'}
User isi form → klik Simpan
  → validateForm() → fieldErrors jika ada
  → api.post('/api/revenue/manual-transaction', form)
  → validateTransactionBody → uuid v4 → INSERT
  → { ok:true, data: entri_baru }
  → modal=null → loadRecap() → showToast sukses
```

### PUT Transaksi Manual

```
User klik Edit → modal={mode:'edit', transaction: baris_terpilih}
Form terisi data lama → user edit → klik Simpan
  → validateForm() → fieldErrors jika ada
  → api.put('/api/revenue/manual-transaction/' + id, form)
  → validateTransactionBody → UPDATE SET ... WHERE id=? AND deleted_at IS NULL
  → { ok:true, data: entri_terupdate }
  → modal=null → loadRecap() → showToast sukses
```

### DELETE Transaksi Manual

```
User klik Hapus → modal={mode:'confirm-delete', transaction: baris_terpilih}
User klik Hapus di modal konfirmasi
  → api.delete('/api/revenue/manual-transaction/' + id)
  → UPDATE SET deleted_at=NOW(), updated_by=userId WHERE id=? AND deleted_at IS NULL
  → { ok:true, message: "Transaksi berhasil dihapus." }
  → modal=null → loadRecap() → showToast sukses
```

---

## Validation Logic

### Server-side (`validateTransactionBody`)

| Field | Aturan | HTTP | Pesan |
|---|---|---|---|
| `transaction_date` | Wajib, format `YYYY-MM-DD` | 422 | "Tanggal transaksi wajib diisi dan harus berformat YYYY-MM-DD." |
| `source_category` | Wajib, satu dari empat enum | 422 | "Kategori sumber tidak valid." |
| `amount` | Wajib, angka > 0 | 422 | "Nominal transaksi wajib diisi dan harus lebih dari 0." |
| `notes` | Opsional, dipotong 500 char | — | — |

### Client-side (`validateForm`)

| Field | Aturan | Class error |
|---|---|---|
| `transaction_date` | Tidak boleh kosong | `.offline-field-error` + `.adm-input--error` |
| `source_category` | Harus dipilih | `.offline-field-error` + `.adm-input--error` |
| `amount` | Harus > 0 | `.offline-field-error` + `.adm-input--error` |

---

## Error Handling

| Situasi | Backend | Frontend |
|---|---|---|
| Token tidak ada / tidak valid | 401 `{ ok:false, message: "Token tidak valid..." }` | Axios interceptor → refresh atau logout |
| Role tidak diizinkan | 403 `{ ok:false, message: "Akses ditolak." }` | showToast error |
| Validasi input gagal | 422 `{ ok:false, message: "<pesan>" }` | showToast error, modal tetap terbuka |
| ID tidak ditemukan | 404 `{ ok:false, message: "Transaksi tidak ditemukan." }` | showToast error |
| Error server | 500 + next(err) → errorHandler | showToast "Terjadi kesalahan." |
| Koneksi database gagal | Error dilempar ke errorHandler | showToast error |

---

## File Inventory

| File | Status |
|---|---|
| `server/src/db/migrations/042_create_manual_revenue_transactions.sql` | Baru |
| `server/src/services/revenue.service.js` | Baru |
| `server/src/controllers/revenue.controller.js` | Baru |
| `server/src/routes/revenue.routes.js` | Baru |
| `src/components/pages/subadmin/sections/DailyRevenueSection.jsx` | Baru |
| `src/styles/css/pages/daily-revenue.css` | Baru |
| `server/src/app.js` | Dimodifikasi |
| `src/components/pages/subadmin/CashierDashboardPage.jsx` | Dimodifikasi |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Struktur respons rekap harian selalu konsisten

*For any* tanggal berformat `YYYY-MM-DD` yang dikirimkan oleh pengguna terautentikasi dengan role yang diizinkan, respons API `GET /api/revenue/daily-recap` SHALL selalu mengandung field `date`, `website_total`, `manual_by_category`, `grand_total`, `website_transactions`, dan `manual_transactions`.

**Validates: Requirements 2.1, 2.5**

---

### Property 2: website_total hanya menjumlahkan order dengan status aktif

*For any* kumpulan order di database pada tanggal tertentu, `website_total` dalam respons SHALL sama dengan jumlah kolom `subtotal` dari baris yang status-nya termasuk dalam `{'Finished', 'In Delivery', 'Quality Checking', 'On Progress'}`. Order dengan status lain tidak boleh ikut dijumlahkan.

**Validates: Requirements 2.2**

---

### Property 3: grand_total adalah penjumlahan deterministik

*For any* respons rekap harian yang valid, `grand_total` SHALL selalu sama dengan `website_total + sum(Object.values(manual_by_category))`. Invariant ini harus berlaku untuk semua kombinasi nilai website dan manual.

**Validates: Requirements 2.4**

---

### Property 4: Round trip buat-dan-baca transaksi manual

*For any* payload transaksi manual yang valid `{ transaction_date, source_category, amount, notes }`, setelah `POST /api/revenue/manual-transaction` berhasil, melakukan `GET /api/revenue/daily-recap?date=transaction_date` SHALL mengandung entri yang sama dalam `manual_transactions` dengan nilai field yang identik.

**Validates: Requirements 3.1, 3.2**

---

### Property 5: Validasi input server — tanggal, kategori, dan amount

*For any* payload yang memiliki `transaction_date` bukan format `YYYY-MM-DD`, atau `source_category` bukan salah satu dari `{'offline_store', 'shopee', 'tokopedia', 'tiktok_shop'}`, atau `amount` ≤ 0 atau bukan angka, permintaan POST maupun PUT SHALL ditolak dengan status HTTP 422.

**Validates: Requirements 3.3, 3.4, 3.5, 4.4**

---

### Property 6: Pemotongan notes hingga 500 karakter

*For any* string `notes` dengan panjang sembarang, nilai yang tersimpan di database SHALL memiliki panjang maksimal 500 karakter. Untuk string dengan panjang ≤ 500 karakter, nilai yang tersimpan SHALL identik dengan nilai yang dikirimkan.

**Validates: Requirements 3.6**

---

### Property 7: Update memperbarui field yang tepat dan tidak mengubah field lain

*For any* transaksi manual yang ada dengan ID valid, setelah `PUT /api/revenue/manual-transaction/:id` dengan payload valid, nilai `transaction_date`, `source_category`, `amount`, `notes`, `updated_by`, dan `updated_at` SHALL diperbarui. Field `id`, `created_by`, dan `created_at` SHALL tetap tidak berubah.

**Validates: Requirements 4.1, 4.2**

---

### Property 8: Soft delete — baris tetap ada, tidak muncul di rekap

*For any* transaksi manual yang ada, setelah `DELETE /api/revenue/manual-transaction/:id` berhasil: (a) baris masih ada di tabel dengan `deleted_at IS NOT NULL`; (b) transaksi tersebut tidak lagi muncul dalam `manual_transactions` pada respons `GET /api/revenue/daily-recap`; (c) nilai transaksi tersebut tidak lagi termasuk dalam `manual_by_category` dan `grand_total`.

**Validates: Requirements 5.1**

---

### Property 9: Validasi client-side mencegah submission form tidak valid

*For any* kondisi form di mana `transaction_date` kosong, ATAU `source_category` tidak dipilih, ATAU `amount` ≤ 0 atau kosong, fungsi validasi client-side SHALL mengembalikan setidaknya satu error dan mencegah pengiriman request ke API.

**Validates: Requirements 11.1, 11.2, 11.3**
