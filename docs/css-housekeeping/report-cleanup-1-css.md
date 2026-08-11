# Laporan Pembersihan CSS — Batch 1

**Tanggal:** 2026-08-11 (session)
**Tahap:** Batch 1 — Penghapusan CSS mati (dead CSS) tingkat lanjutan

## Ringkasan

- **File terlibat:** 15 file CSS
- **Aturan (rules) dihapus:** 255
- **Blok `@media` kosong yang dihapus:** 8
- **Kelas (classes) berbeda dalam aturan yang dihapus:** 208
- **Kelas yang hilang sepenuhnya dari CSS:** 203
- **Karakter dihapus:** 36.417
- **Baris:** 12.768 → 10.955
- **Sisa kelas mati yang dipertahankan (rule campuran, konservatif):** 9
- **Verifikasi:**
  - `npm run build` ✓ (Vite build sukses)
  - `npm test` ✓ (33 failed / 372 passed dari 405 — sama dengan baseline; tidak ada regresi)
  - Keseimbangan brace per file ✓
  - **Keamanan:** 0 kelas yang dihapus direferensikan di JS saat ini (raw substring maupun prefix dinamis `prefix-${x}` / `'prefix-' + x`)

## Detail Per File

| File CSS | Char dihapus | Kelas dihapus | Catatan |
|---|---|---|---|
| dashboard.css | 20.326 | 125 | Legacy `odm-*` (37), `proof-modal-*` (21), `invoice-*` (21), `dir-*` (15), `cashier-proof-*` (8), `staff-credentials-*` (7), `adm-*` (7), `subadmin-*` legacy (6), `odm-lightbox-*`, `cw-file-hidden`, `owner-loading` |
| navbar.css | 7.449 | 26 | Legacy popup produk (`produk-kami-*`), sidebar produk (`nav-sidebar-produk-*`), auth (`nav-auth-*`, `nav-masuk`, `nav-daftar`), `nav-toggle`, `nav-avatar-*`, `nav-cart-badge`, `navbar-secondary-produk`, link lama (`nav-orders-link`, `nav-dashboard-link`) |
| statusOrder.css | 2.486 | 18 | `so-alert*` (3), `so-status-badge--*` (4), history (`so-history-*`), shipping, `so-timeline-step`, `so-customer-info`, `so-detail-grid` |
| checkout.css | 1.321 | 7 | `co-payment-overlay`, `co-proof-*` lama (DropZone sekarang pakai `dz-*`) |
| customOrder.css | 811 | 5 | Preview & checkbox lama |
| catalogProduct.css | 859 | 3 | `upload-file-btn`, `visually-hidden`, `design-preview-empty` |
| cart.css | 606 | 4 | `cdm-attachment-label`, `cdm-design-link`, `cdm-design-name`, `cdm-image` |
| chatWidget.css | 356 | 2 | `cw-close`, `cw-file-hidden` |
| home.css | 426 | 3 | `home-custom-drop--over/label`, `home-custom-file-input` |
| shared.css | 392 | 1 | `search-highlight` |
| myOrders.css | 670 | 3 | `my-orders-card-footer`, `my-orders-table-wrap`, `nav-orders-link` |
| invoice.css | 322 | 2 | `delivery-method-badge`, `delivery-method-badge--delivery` |
| profile.css | 201 | 2 | `pf-section-placeholder`, `pf-view-value--email` |
| daily-revenue.css | 152 | 1 | `rev-source-badge--offline` |
| grid.css | 40 | 1 | `stack-lg` |
| **Total** | **36.417** | **203** | 15 file |

## Metode

1. **Deteksi:** Skrip `deadv5.js` mengekstrak kelas CSS dari file CSS, lalu mencocokkan dengan kemunculan literal di semua file JS/JSX (raw substring). Kelas yang TIDAK muncul di JS dan TIDAK cocok dengan pola dinamis (`prefix-${...}` pada template literal, `'prefix-' + x` pada concat) dianggap mati.
2. **Penghapusan:** Skrip `remove-deadcss.js` mem-parsing CSS (brace-matching, string/comment/url-aware), menghapus rule yang SEMUA selector-nya hanya merujuk kelas mati, merekursi ke `@media`/`@supports`/`@container`, dan mempertahankan `@keyframes`/`@font-face`/`@import`/`@charset`.
3. **Perbaikan bug scanner:** versi awal menelan komentar di depan rule ke dalam prelude selector (karena `i` tidak dimajukan saat komentar dilewati), sehingga at-rule seperti `@media` yang didahului komentar tidak terdeteksi sebagai at-rule dan rule matinya lolos. Scanner diperbaiki agar komentar/whitespace di depan blok dibuang ke output (preserved) sebelum menentukan prelude. Hasilnya: 9 rule tambahan (3 blok `@media`) berhasil dibersihkan. **Perbaikan ini hanya membuat penghapusan lebih lengkap — tidak ada rule hidup yang terhapus salah** (removal tetap mensyaratkan SEMUA kelas mati).
4. **Verifikasi pasca:** keseimbangan brace per file, `npm run build`, `npm test`, dan pemeriksaan keamanan: setiap kelas yang dihapus dicek tidak muncul di JS saat ini (raw substring) maupun tidak cocok dengan prefix dinamis yang benar-benar dipakai JS.

## Catatan (kelas mati yang sengaja dipertahankan — 9)

Kelas berikut masih ter-flag mati, tetapi rule-nya TIDAK dihapus karena selector-nya bercampur dengan kelas hidup (aturan konservatif: rule hanya dihapus jika SELURUH selector mati):

- `dashboard.css`: `dir-kpi-grid` (`.rev-kpi-row, .dir-kpi-grid`), `rev-kpi-card--total` (`.rev-kpi-card--total .rev-kpi-label`), `staff-placeholder-msg` (`.staff-welcome-card, .staff-placeholder-msg`)
- `navbar.css`: `produk-arrow` (`.produk-arrow.open`), `nav-sidebar-produk-arrow` / `nav-sidebar-produk-list` (`.nav-sidebar-produk-arrow.open` dst.), `navbar-secondary-produk-btn` (`.navbar-secondary-produk-btn:hover, .navbar-secondary-produk-btn.active`)
- `grid.css`: `cols-2` (`.grid.cols-2`)
- `home.css`: `search-highlight` (`.home-search-dropdown-name .search-highlight`)

Catatan:
- `search-highlight` dihapus dari `shared.css` tetapi dipertahankan di `home.css` (rule campuran).
- Perbaikan lebih lanjut untuk kelas di atas memerlukan pemisahan rule (splitting selector) yang mengubah rule hidup — kandidat untuk batch berikutnya, bukan batch ini.

## Rekomendasi Lanjutan (Batch 2+)

- **Step 2:** Audit basis `so-*`, `mo-*`, `co-*`, `dz-*` (DropZone) yang dipakai JS tapi belum ada definisi CSS-nya (used-but-undefined) — cek `dropzone.css` (`dz-root`, `dz-input`, `dz-label`), `StatusOrderPage` (`so-*`), dsb.
- **Step 3:** Konsolidasi chart colors (`rev-kpi`, `dir-*`).
- **Step 4:** Konsolidasi definisi toast (duplikasi di `dashboard.css` dan `toast.css`).
- **Step 5:** Subadmin — sisa `subadmin-*` yang tidak ter-flag karena substring family hidup; verifikasi manual.
- **Step 6:** `STATUS_CONFIG` — `status--qc` di `orders.js` vs definisi CSS (`status--quality-checking`); verifikasi `status--dikirim/diproses/diterima` di JS.

## Status Git

Catatan: pada sesi ini, histori git repo berubah di tengah pengerjaan (HEAD bergeser dari cabang css-housekeeping ke `main` @ `ddbb18d`; direktori `docs/css-housekeeping/` terhapus). Perubahan CSS di 15 file tetap valid terhadap `main` saat ini: `git diff HEAD -- src/styles/css` = 15 file, 21 insertion(+)/1.834 deletions(-), dan 0 kelas yang dihapus direferensikan di JS `main` saat ini.
