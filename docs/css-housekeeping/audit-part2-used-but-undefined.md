# Audit CSS: Kelas "Used-but-Undefined" — Batch 2

**Tanggal:** 2026-08-11 (session)
**Tahap:** Batch 2 — Audit kelas yang dipakai JS/JSX tetapi tidak memiliki definisi CSS sama sekali

## Metode

Ekstraksi token class dari atribut `className="..."` / `className={'...'}` / `className={\`...\${x}...\`}` di semua file `src/**/*.js` dan `*.jsx`, lalu dibandingkan dengan seluruh definisi class di `src/styles/css/**/*.css`. Hasilnya: **46 token class tanpa definisi** (setelah menyaring kelas util umum Tailwind/CSS dan token generik). Semua hitung dibandingkan juga dengan definisi yang tersisa setelah Batch 1.

## Hasil: Kandidat Kuat (dipakai komponen nyata, tidak ada CSS)

### Tombol / button
- `btn--ghost` — ProductsPage.jsx:167, 183
- `btn--primary` — NotFoundPage.jsx:31
- `adm-btn--danger` — OrdersSection.jsx:430
- `adm-btn-sm` — CustomersSection.jsx:336, AccountsSection.jsx:290

### Order detail modal (`odm-*`)
- `odm-source-badge` — OrderDetailModal.jsx:132, 133
- `odm-source-badge--custom` — OrderDetailModal.jsx:132
- `odm-source-badge--offline` — OrderDetailModal.jsx:133
- Catatan: Batch 1 menghapus `odm-source-tag--custom/--offline` (mati). Komponen memakai `odm-source-badge-*` yang tidak pernah punya definisi → badge sumber order tidak terstyling.

### Status order (`so-*`) — StatusOrderPage.jsx
- `so-left` (:373), `so-right` (:396), `so-review-section` (:496)
- Catatan: Batch 1 menghapus banyak `so-*` lama (mati); tiga class di atas masih dipakai tapi belum ada definisinya.

### Revenue (`rev-*`) — RevenueSection.jsx
- `rev-section` (:520) — hanya `rev-section-header` yang terdefinisi; base-nya hilang
- `rev-breakdown-val` (:670, 674, 678) — hanya `rev-breakdown-val--neg` yang terdefinisi; base-nya hilang

### Offline / CS / Subadmin
- `offline-add-item-btn`, `offline-item-price`, `offline-item-qty`, `offline-remove-item` — OfflineDashboardPage.jsx
- `offline-item-attr--luas` — OfflineOrderSection.jsx:885
- `offline-price-cell--name`, `offline-price-cell--sub` — OfflineOrderSection.jsx:779, 830
- `cs-item-name`, `cs-item-price`, `cs-item-qty`, `cs-item-subtotal`, `cs-remove-item` — CSCustomOrderSection.jsx:365-399

### Checkout / payment (`co-*`)
- `co-form-section` — CheckoutPage.jsx:223
- `co-payment-order-number` — PaymentModal.jsx:212

### Chat (`cw-*`)
- `cw-file-icon` — ChatWidget.jsx:50
- `chat-close-btn` — ChatsSection.jsx:464

### Katalog / produk
- `catalog-search-form` — ProductsPage.jsx:150
- `catalog-search-input` — ProductsPage.jsx:156
- `product-info-price` — CatalogProductPage.jsx:426

### Lain-lain
- `nav-pill` — CartPage.jsx:260
- `staff-sound-btn` — AdminDashboardPage.jsx:236, SubAdminLayout.jsx:88
- `staff-welcome-text` — AdminDashboardPage.jsx:159, OwnerDashboardPage.jsx:146
- `register-login-section` — RegisterPage.jsx:393
- `cancel-dialog`, `cancel-dialog-overlay` — OrdersSection.jsx:387, 394
- `thermal-receipt` — ThermalReceiptModal.jsx:95

## Hasil: Kandidat Rendah / Perlu Pengecekan Manual

- **Test-only:** `cart-item-body`, `cart-item-img-wrap` (cartItemOverflow.property.test.jsx), `touch-device-sim` (touchInputSizing.property.test.jsx) — class dipakai di file test; biasanya tidak butuh CSS.
- **Token generik:** `close`, `err`, `icon`, `text`, `value` (EmailVerificationBanner.jsx, DailyRevenueSection.jsx) — kemungkinan styling inline/tambahan; verifikasi manual.

## Rekomendasi

1. **Prioritas tinggi:** `btn--primary`/`btn--ghost` dan `adm-btn--danger`/`adm-btn-sm` — tombol utama tanpa gaya primary. Cek apakah seharusnya memakai base `btn`/`adm-btn` + modifier yang sudah ada (kemungkinan typo/rename), lalu tambah definisi atau perbaiki className.
2. **Prioritas sedang:** `so-left`, `so-right`, `so-review-section` (layout StatusOrderPage), `rev-section`, `rev-breakdown-val` (base), `odm-source-badge-*` — komponen nyata yang render tanpa gaya.
3. **Prioritas rendah:** offline/CS/catalog/chat/checkout misc di atas — menambah definisi CSS atau menghapus className yang tidak diperlukan.
4. **DropZone (`dz-*`):** verifikasi terpisah — lihat catatan di bawah.

## Catatan DropZone (`dz-*`) — VERIFIED OK

`dropzone.css` mendefinisikan `dz-root`, `dz-root--compact/--over/--disabled`, `dz-input`, `dz-body`, `dz-icon`, `dz-label`, `dz-hint`, `dz-overlay`, `dz-error`, dan `DropZone.jsx` memakai persis class-class tersebut (`rootCls` di DropZone.jsx:130-133, `dz-input` :158, `dz-label` :174, `dz-hint` :175). Tidak ada celah di sini; catatan lama di report Batch 1 yang meragukan `dz-*` sudah terjawab: DropZone tetap terstyling penuh.
