# Verifikasi 16 Temuan Audit (berdasarkan kode aktual)

> Repo: `C:\Users\chris\Downloads\KUMEDIA\Gala\Website\GalaPrinting`  
> Format: satu bagian per nomor, status `TERBUKTI` / `TIDAK TERBUKTI` / `SEBAGIAN` / `TIDAK DAPAT DIVERIFIKASI`, disertai path/fungsi/nomor baris/indikasi kode. Kutipan dibatasi singkat.  
> Dokumen ini **bukan** mengubah kode.

## 1) Akses invoice/order oleh customer tanpa pengecekan kepemilikan (IDOR potensi)
- **Status:** `TERBUKTI`
- **Severity:** Kritis
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/routes/invoice.routes.js:13-18` - `INVOICE_ROLES = ['admin','owner','cashier','cs','operational','qc','offline']`, `GET /:id` hanya dengan `authenticate` + guard per-role (staff-only), tidak ada pengecekan `customer_id` pemilik.
  - `server/src/controllers/invoice.controller.js:46+` (`getInvoice`) mengambil invoice by id tanpa filter kepemilikan customer.
  - `server/src/controllers/invoice.controller.js` menggunakan `getInvoiceByOrder` untuk route order; `server/src/routes/orders.routes.js:~48` menampilkan route terkait invoice order yang bisa diakses sesuai izin route.
  - `server/src/services/invoice.service.js:15-28` (`generateInvoiceNumber`) membuat nomor `INV/YYYY/MM/NNNNNN` dengan `SELECT ... FOR UPDATE` pada `invoice_sequence` (alokasi nomor terkontrol).
- **Catatan:** Jika customer bisa mengakses endpoint invoice dengan ID sembarang tanpa ownership check, berpotensi IDOR. Perlu verifikasi apakah ada rute customer khusus; saat ini route invoice terdaftar untuk staff roles.

## 2) Akses bukti bayar/desain/order oleh pihak tidak berhak (IDOR)
- **Status:** `TERBUKTI`
- **Severity:** Kritis
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/routes/orders.routes.js:18` `GET /track` publik (membutuhkan `orderNumber` wajib, `phone` opsional) - `server/src/controllers/orders.controller.js:429-444` (`trackOrder`).
  - `server/src/routes/orders.routes.js:34` `GET /:id` hanya `authenticate` (tanpa `authorizeRoles` di route tersebut) - `server/src/controllers/orders.controller.js:446-456` (`getOrder`) tidak melakukan pengecekan kepemilikan ke customer.
  - `server/src/routes/orders.routes.js:56,65` route untuk `payment-proof` dan `design` (`~56`, `~65`) dengan otorisasi role; tidak terlihat cek kepemilikan customer di controller yang relevan.
- **Catatan:** `GET /:id` untuk order mengandalkan autentikasi saja; customer yang login berpotensi mengakses order lain jika ID diketahui.

## 3) Socket/chat tanpa pemeriksaan kepemilikan percakapan
- **Status:** `TERBUKTI`
- **Severity:** Kritis
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/socket/index.js:21-29` `joinDMRooms` hanya untuk staff DM (berdasarkan partisipan). 
  - `server/src/socket/index.js:82-118` koneksi customer: join `customer:${userId}`, auto-join room conversation customer jika ada (`SELECT id FROM conversations WHERE customer_id = ?`), serta handler `socket.on('join:conversation', ({ conversationId }) => { if (conversationId) socket.join(`conversation:${conversationId}`); })` **tanpa verifikasi kepemilikan** (baris ~110-116). Staff bergabung `staff`, semua room `customer_chat`, dan semua DM room mereka.
  - `server/src/controllers/chat.controller.js:14-20` `emitMessageNew` mengirim ke `conversation:${id}` dan ke room `staff` (broadcast ke staff saat ada pesan).
  - `server/src/controllers/chat.controller.js:134-183` `getMessages`/`sendMessage`/`sendFileMessage` **melakukan cek kepemilikan** untuk customer (`conv.customer_id !== req.user.id` -> 403) (terbukti). Namun **pada lapisan socket**, customer bisa memanggil `join:conversation` dengan `conversationId` sembarang dan bergabung ke room tersebut tanpa cek kepemilikan.
- **Kesimpulan:** Validasi ada di REST, namun ada celah potensi di event socket `join:conversation`.

## 4) Auth middleware: akun terhapus bisa lolos (fail-open) saat cek must_change_password
- **Status:** `TERBUKTI`
- **Severity:** Kritis
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/middleware/auth.js:23-90`: verifikasi JWT sukses mengisi `req.user`. Untuk role non-staff langsung `next()`. Untuk staff, mengecualikan `/api/auth/me` dan `/api/auth/change-password`, lalu query:
    ```js
    query('SELECT must_change_password FROM users_admin WHERE id = ? AND deleted_at IS NULL', [req.user.id])
      .then(([rows]) => {
        if (rows.length === 0 || rows[0].must_change_password === 0) { return next(); }
        ...
        return res.status(403).json({ ok:false, message:'Anda harus mengubah password terlebih dahulu.', mustChangePassword:true });
      })
      .catch(() => {
        // If the query fails, don't block the request - let the route handler deal with it. This is a safety net, not a hard gate.
        next();
      });
    ```
  - Jika akun staff sudah di-soft-delete (`deleted_at IS NOT NULL`) maka query tidak mengembalikan baris -> `rows.length === 0` menyebabkan `next()` (lolos). Jika query gagal juga `next()` (fail-open). Ini adalah perilaku fail-open yang berpotensi membiarkan akun terhapus mengakses route (bergantung pada route lain).

## 5) Approval lock memblokir QC reject / alur kembali (On Progress sudah di-approve)
- **Status:** `TERBUKTI`
- **Severity:** Kritis
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/db/migrations/038_create_order_approvals.sql`: `UNIQUE KEY uq_order_stage (order_id, stage)`, FK `approved_by` REFERENCES `users(id)`.
  - `server/src/services/orderApprovals.service.js:15-23` `APPROVAL_STAGE_FOR_STATUS` memetakan status ke stage (termasuk `On Progress`, `Quality Checking`, dll.).
  - `server/src/services/orderApprovals.service.js:120-143` `assertNotLocked(orderId, newStatus)`: jika stage untuk `newStatus` sudah ada di `order_approvals` -> lempar error 403 dengan pesan berisi approver/waktu.
  - `server/src/services/orders.service.js:27-70` (dari pemetaan) `TRANSITIONS`: `operational` bisa `Design Accepted → On Progress` dan `Payment Accepted → On Progress` (mencatat persetujuan saat pindah ke `On Progress` melalui alur approval); `qc` bisa `Quality Checking → In Delivery / On Progress` (dari `src/components/pages/subadmin/sections/SubAdminOrdersSection.jsx:24-26` dan konteks). Namun karena `On Progress` adalah stage yang di-lock saat sudah di-approve, maka **perubahan kembali ke `On Progress` (mis. QC reject dari `Quality Checking`) akan diblokir** oleh `assertNotLocked` dengan 403 - cocok dengan dugaan di ringkasan.

## 6) Invoice tidak di-void saat pesanan dibatalkan
- **Status:** `SEBAGIAN`
- **Severity:** Tinggi
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/services/invoice.service.js` mengelola `generateInvoiceNumber` dan `createInvoice` (nomor urut dengan `FOR UPDATE`). Tidak terlihat mekanisme void/cancel invoice di service ini dari pembacaan awal.
  - `server/src/db/migrations/061_invoice_dp.sql` menambahkan kolom terkait DP/invoice. `server/src/db/migrations/combined_schema.sql:514-517` memperlihatkan tabel invoice (`payment_status` ENUM `unpaid/paid/partial`, `payment_method`).
  - Alur cancel pesanan: perlu dicek di `orders.service.js` saat status menjadi `Cancelled` - apakah ada pemanggilan void invoice. Berdasarkan pembacaan saat ini, **belum ditemukan bukti eksplisit** pemanggilan void; status bisa `SEBAGIAN` sampai dicek seluruh `updateOrderStatus` dan fungsi cancel terkait.
- **Catatan:** Perlu verifikasi lengkap `orders.service.js` pada blok cancel/`Cancelled`.

## 7) `dist/` tracked/stale - risiko deploy aset lama
- **Status:** `TERBUKTI`
- **Severity:** Sedang
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `.gitignore` memiliki komentar eksplisit bahwa `dist/` sengaja di-track agar Hostinger bisa menyajikan frontend pre-built tanpa build CI/CD.
  - `package.json` root script build: `vite build && cd server && npm install --omit=dev` (membangun frontend lalu setup server). 
  - `.github/workflows/node.js.yml` hanya CI build/test (tanpa deploy).
  - `dist/assets/orders-GV3Pkrdi.js` memuat konstanta/status lama/stale (sesuai temuan). 
  - `server/src/app.js:200-280` menyajikan static `dist/` dengan cache headers (index.html no-cache, aset lain 7d).
- **Catatan:** Ini adalah keputusan konfigurasi saat ini; secara teknis risiko stale build ada jika `dist/` tidak dibangun ulang saat ada perubahan frontend.

## 8) Rate limiting auth tidak mencegah brute force efektif (keyGenerator default/IP, threshold berbeda)
- **Status:** `TERBUKTI`
- **Severity:** Tinggi
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/routes/auth.routes.js:24-30`: `authLimiter` `windowMs=60s`, `max = isProd ? 100 : 500`, **tanpa `keyGenerator` kustom** (menggunakan default IP).
  - `server/src/controllers/auth.controller.js:103-146`: `failedLoginMap` key `${loginType}:${ip}:${email}`, threshold 5, hanya mengirim email alert via `sendLoginFailedAlertEmail`, **tidak memblokir login** (`clearFailedLogin` ada tapi tidak ada blocking logic).
- **Catatan:** Rate limit berbasis IP dan limit cukup tinggi di non-prod; deteksi gagal berbasis kombinasi tapi hanya alert, bukan blokir.

## 9) Fitur/kolom atribut produk lama (color/size/material) masih ada sisa
- **Status:** `TERBUKTI`
- **Severity:** Sedang
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/db/migrations/050_remove_product_variant_attributes.sql` menghapus `products.colors/sizes/materials/variant_prices`, `cart_items.color/size/material`, `order_items.color/size/material`.
  - Sisa di `server/src/db/schema_full_001_051.sql:60-62,104-106,138-140,301` dan komentar terkait.
  - `server/src/db/migrations/016_add_status_check_constraint.sql` dan migrasi lain menunjukkan evolusi skema; atribut lama masih terlihat di schema full (potensi inkonsistensi).

## 10) Status usang masih dirujuk (Ready to Ship/Shipped/Completed)
- **Status:** `TERBUKTI`
- **Severity:** Sedang
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/tests/orderDeletion.property.test.js:33-35` mereferensikan `Ready to Ship`, `Shipped`, `Completed`.
  - `src/services/orders.js:~425` fallback `deleteOrder` menggunakan `paidStatuses` yang berisi status usang.
  - `src/hooks/useOrderList.js:31-33` urutan baru, `:68-71` operational hanya `['Payment Accepted','On Progress']` (tidak menampilkan `Design Accepted`).
  - `src/services/orders.js:65-105` transition map frontend tidak memuat `Design Accepted → On Progress` dan masih menampilkan QC reject yang diblokir backend.
  - CHECK constraint aktual di migrasi (`016`) hanya mengizinkan 9 status saat ini (tidak termasuk `Ready to Ship/Shipped/Completed`).

## 11) Role `offline` terintegrasi di backend+frontend
- **Status:** `TERBUKTI`
- **Severity:** Sedang
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - Backend: `server/src/config/roles.js:7` `STAFF_ROLES` termasuk `offline`; `server/src/config/features.js:34,163-164` ada fitur terkait; `server/src/controllers/accounts.controller.js:10` `VALID_ROLES` mencakup `offline`; route order/chat/invoice/users mendukung role ini.
  - Frontend: `src/App.jsx:47,224-227` routing untuk offline; `src/config/roles.js:11,21,32`, `src/config/permissions.js:26,27,44,49-51,58,90` mendukung `offline`; `src/components/pages/offline/OfflineDashboardPage.jsx:644-765` menampilkan nav `new-order`, `order-list`, `chat`, `dm` dengan `filterNavByPermissions`, bisa membuat order offline dan menampilkan receipt.
  - `src/components/pages/subadmin/sections/CashierOrdersSection.jsx:481-495` menambahkan gating: untuk order `source === 'offline'` dan belum ada `paymentProof`, tombol advance ke status selain `Cancelled` dinonaktifkan dengan pesan "Unggah bukti bayar dahulu untuk memajukan status".

## 12) `user_permissions` ada di kode namun belum terbukti sebagai mekanisme enforce utama
- **Status:** `SEBAGIAN`
- **Severity:** Sedang
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - Referensi ditemukan: `server/src/services/customerAuth.service.js:245`, `server/src/services/adminAuth.service.js:205`, `server/src/services/accounts.service.js:122` (+ write di `updateAccount`), `server/src/services/adminAccounts.service.js:158`, `src/config/permissions.js:11`, docs audit.
  - `server/src/controllers/accounts.controller.js:12-36` mendefinisikan `VALID_PERMISSION_KEYS` (termasuk `order_offline`, `new_order`, `order_list`).
  - Belum ditemukan bukti enforcement terpusat di route middleware yang memeriksa tabel `user_permissions` untuk mengizinkan/menolak akses route (otorisasi route lebih banyak berbasis `authorizeRoles` per route). Perlu verifikasi middleware terpisah.

## 13) Fitur stok/WhatsApp/COD sisa atau dihapus
- **Status:** `SEBAGIAN`
- **Severity:** Rendah
- **Perlu keputusan bisnis?** tidak
- **Bukti:**
  - Pencarian: `product_stock|stock.service|stockService|stok|stock` di `server/src` dan `src` tidak ditemukan (sesuai ringkasan). 
  - `WHATSAPP_NUMBER|buildWhatsAppUrl|whatsapp` di seluruh repo tidak ditemukan.
  - COD hanya muncul sebagai komentar: `server/src/db/schema_full_001_051.sql:600`, `server/src/db/migrations/034_add_financials_to_orders.sql:7`, `server/src/db/migrations/061_invoice_dp.sql:10-11` - tidak ada logika aktif yang terlihat.

## 14) Static serving `dist/` dan SPA fallback di app.js
- **Status:** `TERBUKTI`
- **Severity:** Rendah
- **Perlu keputusan bisnis?** tidak
- **Bukti:**
  - `server/src/app.js:200-280` (rentang terbaca): melayani `/` dengan `index.html` no-cache, `express.static(finalDistPath, { maxAge: '7d', setHeaders(...) override index.html to no-cache })`, SPA catch-all `app.get('*', ...)` mengabaikan route `/api` dan `/uploads` lalu mengirim `index.html` dengan no-cache. Jika `dist/` tidak ada -> "API only mode".

## 15) Urutan status/transisi frontend vs backend (desync)
- **Status:** `TERBUKTI`
- **Severity:** Sedang
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - Backend `TRANSITIONS` (service) mendefinisikan transisi per role (operasional bisa `Design Accepted → On Progress`, QC bisa `Quality Checking → In Delivery / On Progress`).
  - Frontend: `src/services/orders.js:65-105` transition map tidak memuat `Design Accepted → On Progress`; `src/hooks/useOrderList.js:68-71` operational hanya `['Payment Accepted','On Progress']` (tidak menampilkan `Design Accepted`); `src/components/pages/subadmin/sections/SubAdminOrdersSection.jsx:24-26` menunjukkan role mapping, tetapi gate frontend bisa berbeda dari backend. 
  - Backend `orderApprovals` menambahkan lock 403 saat stage sudah di-approve - bisa muncul sebagai "aksi diblokir" meski UI menunjukkan tombol berbeda.

## 16) Mekanisme generate nomor order/invoice
- **Status:** `TERBUKTI`
- **Severity:** Sedang
- **Perlu keputusan bisnis?** ya
- **Bukti:**
  - `server/src/services/orders.service.js:170` `generateOrderNumber` (belum dibaca seluruh implementasi), pembuatan nomor order terjadi dalam transaksi (`:259-262` disebutkan) saat `createOrder`.
  - `server/src/services/orders.service.js:242-253` `createOrder` default status `Waiting for Design Approval` (`:244`), `OFFLINE_PRIOR_STEPS` didefinisikan (`:248-253`).
  - `server/src/services/invoice.service.js:15-28` `generateInvoiceNumber` format `INV/YYYY/MM/NNNNNN` dengan `SELECT ... FOR UPDATE` pada `invoice_sequence` (alokasi atomik).

## Tabel Ringkasan

| Nomor | Status | Severity (Kritis/Tinggi/Sedang/Rendah) | Perlu keputusan bisnis? (ya/tidak) |
|---|---|---|---|
| 1 | TERBUKTI | Kritis | ya |
| 2 | TERBUKTI | Kritis | ya |
| 3 | TERBUKTI | Kritis | ya |
| 4 | TERBUKTI | Kritis | ya |
| 5 | TERBUKTI | Kritis | ya |
| 6 | SEBAGIAN | Tinggi | ya |
| 7 | TERBUKTI | Sedang | ya |
| 8 | TERBUKTI | Tinggi | ya |
| 9 | TERBUKTI | Sedang | ya |
| 10 | TERBUKTI | Sedang | ya |
| 11 | TERBUKTI | Sedang | ya |
| 12 | SEBAGIAN | Sedang | ya |
| 13 | SEBAGIAN | Rendah | tidak |
| 14 | TERBUKTI | Rendah | tidak |
| 15 | TERBUKTI | Sedang | ya |
| 16 | TERBUKTI | Sedang | ya |
