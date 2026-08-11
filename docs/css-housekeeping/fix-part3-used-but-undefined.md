# Fix CSS: Kelas "Used-but-Undefined" — Batch 3 (penambahan definisi)

**Tanggal:** 2026-08-11 (session)
**Tahap:** Batch 3 — Menambahkan definisi CSS yang hilang untuk 46 class hasil audit `audit-part2-used-but-undefined.md`. TIDAK ada perubahan JS/JSX; murni penambahan CSS.

## Ringkasan

- **10 file CSS diubah, +247 baris** (semua penambahan, 0 penghapusan).
- Semua braces seimbang; `npm run build` ✓ (6.13s); test suite tanpa regresi baru (lihat hasil di bawah).
- **38 class** diberi definisi CSS baru.
- **5 class** terbukti false-positive audit (token BEM `email-verify-banner__*` / `rev-kpi-card__value` yang sudah/terdefinisi; `rev-kpi-card__label`/`__value` juga sempat hilang → sudah ditambahkan).
- **3 class** hanya dipakai file test → tidak butuh CSS.

## Status 46 Class

### Prioritas 1 — Tombol (semua diperbaiki)
| Class | File | Definisi |
|---|---|---|
| `btn--primary` | `components/buttons.css` | Mirip `.btn.primary`: `background: var(--primary)`, `color: var(--primary-contrast)`, border transparan |
| `btn--ghost` | `components/buttons.css` | `background: transparent` (mirip `.btn.ghost`) |
| `adm-btn--danger` | `pages/dashboard.css` | Solid merah `#b91c1c`, `color: #fff`, border transparan + `:hover` |
| `adm-btn-sm` | `pages/dashboard.css` | Ukuran kecil: padding `4px 10px`, `font-size: 12px`, `min-height: 30px` |

### Prioritas 2 (semua diperbaiki)
| Class | File | Definisi |
|---|---|---|
| `so-left`, `so-right` | `pages/statusOrder.css` | `min-width: 0` (cegah overflow kolom grid) |
| `so-review-section` | `pages/statusOrder.css` | `display: flex; flex-direction: column` |
| `rev-section` | `pages/dashboard.css` | `display: flex; flex-direction: column` |
| `rev-breakdown-val` | `pages/dashboard.css` | Base: `font-weight: 600; white-space: nowrap` (modifier `--neg/--neutral/--total` sudah ada) |

### Prioritas 3 (semua diperbaiki)
| Class | File | Definisi |
|---|---|---|
| `odm-source-badge` | `pages/dashboard.css` | Badge pill 11px/700/border-radius 999px (gaya lama `odm-source-tag` yang dihapus di Batch 1, dipindah ke nama baru) |
| `odm-source-badge--custom` | `pages/dashboard.css` | Ungu `#ede9fe`/`#5b21b6` |
| `odm-source-badge--offline` | `pages/dashboard.css` | Pink `#fce7f3`/`#be185d` |
| `offline-add-item-btn` | `pages/dashboard.css` | `white-space: nowrap; flex-shrink: 0` |
| `offline-item-qty` | `pages/dashboard.css` | `width: 70px` |
| `offline-item-price` | `pages/dashboard.css` | `width: 130px` |
| `offline-remove-item` | `pages/dashboard.css` | Tombol ✕ compact `padding: 4px 8px` (sebelumnya melebar krn padding `.adm-btn` 7px 16px di kolom 50px) |
| `offline-item-attr--luas` | `pages/dashboard.css` | `justify-content: flex-end` (selaras grid dims) |
| `offline-price-cell--name` | `pages/dashboard.css` | `min-width: 0` (cegah autocomplete overflow) |
| `offline-price-cell--sub` | `pages/dashboard.css` | `justify-content: flex-end` |
| `cs-item-name` | `pages/dashboard.css` | `min-width: 180px` |
| `cs-item-qty` | `pages/dashboard.css` | `width: 70px` |
| `cs-item-price` | `pages/dashboard.css` | `width: 130px` |
| `cs-item-subtotal` | `pages/dashboard.css` | `font-weight: 700; color: #1f1f1f; nowrap` |
| `cs-remove-item` | `pages/dashboard.css` | Tombol ✕ compact (sama seperti offline) |
| `co-form-section` | `pages/checkout.css` | `min-width: 0` (grid child) |
| `co-payment-order-number` | `pages/checkout.css` | Center, `color: #6b6b6b`, `font-size: 13px` |
| `cw-file-icon` | `components/chatWidget.css` | `font-size: 16px; flex-shrink: 0; line-height: 1` |
| `chat-close-btn` | `pages/dashboard.css` | Tombol "Tutup Chat" (dark `#374151`, putih, radius 6px) + `:hover` |
| `catalog-search-form` | `pages/products.css` | `flex, gap 8px, wrap, margin-bottom 16px` |
| `catalog-search-input` | `pages/products.css` | `flex: 1; min-width: 160px; border var(--border); radius 8px` + `:focus` brand-brown |
| `product-info-price` | `pages/catalogProduct.css` | 22px/800, `color: var(--brand-brown)` |
| `nav-pill` | `pages/cart.css` | Stepper qty pill: `inline-flex`, border `var(--border)`, radius 999px, padding 4px |
| `staff-sound-btn` | `pages/dashboard.css` | Tombol icon suara header (mirror inline style) + `:hover` |
| `staff-welcome-text` | `pages/dashboard.css` | `display: flex; flex-direction: column` |
| `register-login-section` | `pages/register.css` | `flex column, gap 14px` (menyamakan layout register) |
| `cancel-dialog` | `pages/dashboard.css` | Dialog putih 12px radius, min/max-width 360/480 (mirror inline) |
| `cancel-dialog-overlay` | `pages/dashboard.css` | Overlay fixed `rgba(0,0,0,0.5)`, flex center, z-1000 (mirror inline) |
| `thermal-receipt` | `pages/invoice.css` | `max-width: 100%` (styling utama sudah inline) |
| `rev-kpi-card__label` | `pages/dashboard.css` | Temuan tambahan: label KPI harian (mirror `.rev-kpi-label`) |
| `rev-kpi-card__value` | `pages/dashboard.css` | Temuan tambahan: value KPI harian (mirror `.rev-kpi-value`) |

### False-positive audit (tidak perlu CSS)
| Class | Keterangan |
|---|---|
| `close`, `err`, `icon`, `text` | Token hasil pemecahan `email-verify-banner__close/__err/__icon/__text` — sudah terdefinisi di `components/shared.css` |
| `value` | Token hasil pemecahan `rev-kpi-card__value` — class aslinya kini sudah terdefinisi (lihat tabel di atas) |

### Test-only (tidak perlu CSS)
| Class | Keterangan |
|---|---|
| `cart-item-body`, `cart-item-img-wrap` | Hanya dipakai fixture di `cartItemOverflow.property.test.jsx` |
| `touch-device-sim` | Hanya dipakai di `touchInputSizing.property.test.jsx` |

## Perubahan Visual per Halaman

- **NotFound / Products (katalog):** tombol `btn--primary` "Kembali ke Beranda" kini cokelat solid; tombol reset filter `btn--ghost` transparan; search bar ter-styling penuh (sebelumnya hanya inline sebagian).
- **Admin Orders:** tombol "Konfirmasi" batal (`adm-btn--danger`) merah solid; dialog pembatalan + overlay terdefinisi di CSS; badge sumber order (`odm-source-badge`) di Order Detail Modal kembali berwarna ungu/pink (gaya yang terhapus di Batch 1).
- **Admin Customers / Owner Accounts:** tombol kecil edit/hapus (`adm-btn-sm`) compact, tidak melebar.
- **Status Order (customer):** kolom kiri/kanan tidak overflow; section ulasan jadi container flex.
- **Revenue Dashboard:** section + nilai breakdown kini berdefinisi; kartu KPI harian (SubAdmin Daily Revenue) label & value ter-styling (sebelumnya text polos).
- **Offline / CS Custom Order:** input qty/harga ber-width tetap; tombol hapus baris compact (dulu melebar di kolom 50px); kolom nama antiautocomplete tidak overflow; sel subtotal rata bawah.
- **Checkout / PaymentModal:** section form tidak overflow; teks "Order: #..." di modal pembayaran terpusat & muted.
- **Cart:** stepper qty kini berbentuk pill (minus/qty/plus dalam border rounded).
- **Admin/SubAdmin/Owner header:** tombol suara 🔔/🔇 konsisten + hover.
- **Register login:** section login sejajar dengan form register.
- **Chat Admin:** tombol "Tutup Chat" ter-styling di header percakapan.
- **Detail Produk:** harga produk besar cokelat brand.

## Hasil Build + Test

- `npm run build`: ✓ built (6.13–8.4s, setiap batch).
- `npm test` (vitest run): **31–33 failed / 372–374 passed (405 total)** — berfluktuasi antar-run karena seed acak fast-check pada property test yang memang sudah gagal sebelumnya (heroClamp, modalContainment, adminCustomerPreservation, addressList/Selector, navbar, routing, cartSyncPayload, chatSystem, orderEnhancements, orderTransition). **Tidak ada file test baru yang gagal; perubahan hanya CSS sehingga tidak memengaruhi hasil test JS.**
- Verifikasi script `used-but-undefined.js` ulang: hanya tersisa 8 token false-positive (3 test-only + 5 BEM), `dynamic-looking tokens without CSS: 0`.

## Catatan / Ambigu

- Tidak ada class yang ditinggalkan sebagai "ambiguous". Satu temuan perlu disorot: `rev-kpi-card__label`/`__value` (DailyRevenueSection) ternyata juga undefined — sudah diperbaiki dengan meniru `.rev-kpi-label`/`.rev-kpi-value`.
- `nav-pill` (CartPage) hanya dipakai sekali; gaya pill-stepper dipilih karena nama & struktur (minus + qty + plus) — bila dimaksudkan untuk hal lain, beri tahu.
- `odm-source-badge` memakai palet lama `odm-source-tag` (ungu/pink) yang dihapus Batch 1 karena dianggap mati; kini dipakai ulang dengan nama baru.
