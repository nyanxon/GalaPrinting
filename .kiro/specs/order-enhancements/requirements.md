# Requirements Document

## Introduction

Fitur ini mencakup lima peningkatan pada sistem pemesanan (order) dan chat yang sudah ada:

1. **Dynamic Pricing** — Harga produk berubah secara real-time sesuai varian yang dipilih (warna / ukuran / bahan) di halaman detail produk.
2. **Promo Code Bar** — Input kode promo pada halaman checkout yang memvalidasi kode dan menerapkan diskon ke subtotal.
3. **Chat Close / Delete** — Admin dapat menutup percakapan secara manual melalui tombol di UI, yang menghapus data percakapan dan pesan dari database serta file terkait dari localStorage.
4. **Order Source Label** — Popup detail pesanan (untuk admin, sub-admin, dan owner) menampilkan badge "Custom Order" atau "Offline Order" sesuai asal pesanan.
5. **Order Cancellation by Admin/Owner** — Admin dan Owner dapat membatalkan pesanan customer yang masuk, dengan kewajiban mengisi alasan pembatalan yang kemudian disimpan dan ditampilkan ke customer.

Sistem yang ada menggunakan arsitektur dual-mode: `USE_BACKEND=true` menggunakan REST API + MySQL, `USE_BACKEND=false` menggunakan localStorage. Semua fitur baru harus mendukung kedua mode tersebut.

---

## Glossary

- **System**: Aplikasi web Gala (frontend React + backend Node.js/Express).
- **Product_Detail_Page**: Halaman `/products/:id` yang menampilkan detail produk dan opsi varian.
- **Variant**: Kombinasi atribut produk yang dapat dipilih customer: warna (`color`), ukuran (`size`), dan/atau bahan (`material`).
- **Variant_Price**: Harga yang berlaku untuk kombinasi varian tertentu, berbeda dari harga dasar produk.
- **Checkout_Page**: Halaman `/checkout` tempat customer mengisi data pengiriman dan menyelesaikan pesanan.
- **Promo_Code**: Kode alfanumerik yang dapat dimasukkan customer untuk mendapatkan diskon.
- **Discount**: Pengurangan harga yang diterapkan ke subtotal berdasarkan kode promo yang valid.
- **Chat_System**: Sistem percakapan antara customer dan admin yang menggunakan tabel `conversations` dan `messages` di database.
- **Conversation**: Satu sesi percakapan antara satu customer dan admin, direpresentasikan oleh baris di tabel `conversations`.
- **Admin**: Pengguna dengan role `admin` yang memiliki akses penuh ke dashboard admin.
- **Owner**: Pengguna dengan role `owner` yang memiliki akses ke dashboard owner.
- **Sub_Admin**: Pengguna dengan role `cashier`, `cs`, `operational`, atau `qc` yang memiliki akses terbatas.
- **Order_Detail_Modal**: Popup/modal yang menampilkan detail lengkap pesanan, digunakan oleh Admin, Sub_Admin, dan Owner.
- **Order_Source**: Asal pesanan, disimpan di kolom `source` pada tabel `orders`: `online`, `offline`, atau `custom`.
- **Custom_Order**: Pesanan yang dibuat oleh CS Admin melalui endpoint `/api/orders/custom`, dengan `source = 'custom'`.
- **Offline_Order**: Pesanan yang dibuat oleh Offline Admin melalui endpoint `/api/orders/offline`, dengan `source = 'offline'`.
- **Cancellation_Reason**: Teks alasan pembatalan yang wajib diisi oleh Admin atau Owner saat membatalkan pesanan.
- **Order_History**: Riwayat perubahan status pesanan, disimpan di tabel `order_history`.

---

## Requirements

### Requirement 1: Dynamic Pricing Berdasarkan Varian

**User Story:** Sebagai customer, saya ingin melihat harga yang berubah secara otomatis ketika saya memilih varian produk (warna, ukuran, atau bahan), sehingga saya mengetahui harga yang tepat sebelum menambahkan produk ke keranjang.

#### Acceptance Criteria

1. THE Product_Detail_Page SHALL menampilkan harga dasar produk saat halaman pertama kali dimuat.
2. WHEN customer memilih Variant pada Product_Detail_Page, THE Product_Detail_Page SHALL memperbarui tampilan harga yang ditampilkan sesuai dengan Variant_Price yang terkait dengan varian tersebut.
3. WHEN customer mengubah pilihan Variant, THE Product_Detail_Page SHALL memperbarui tampilan harga secara real-time tanpa memuat ulang halaman.
4. WHEN customer menambahkan produk ke keranjang, THE System SHALL menyimpan Variant_Price yang berlaku saat itu sebagai harga item di keranjang.
5. IF tidak ada Variant_Price yang dikonfigurasi untuk kombinasi varian yang dipilih, THEN THE Product_Detail_Page SHALL menampilkan harga dasar produk.
6. THE System SHALL menyimpan konfigurasi Variant_Price sebagai bagian dari data produk di database (kolom `variant_prices` bertipe JSON pada tabel `products`).
7. WHEN Admin mengelola produk, THE System SHALL menyediakan antarmuka untuk mengonfigurasi Variant_Price per kombinasi varian.

---

### Requirement 2: Promo Code Bar pada Checkout

**User Story:** Sebagai customer, saya ingin dapat memasukkan kode promo saat checkout, sehingga saya mendapatkan diskon yang sesuai pada total pembayaran saya.

#### Acceptance Criteria

1. THE Checkout_Page SHALL menampilkan input field untuk memasukkan Promo_Code beserta tombol "Terapkan".
2. WHEN customer memasukkan Promo_Code yang valid dan menekan tombol "Terapkan", THE System SHALL menghitung Discount dan menampilkan nilai diskon serta subtotal setelah diskon pada ringkasan pesanan.
3. WHEN customer memasukkan Promo_Code yang tidak valid atau sudah kedaluwarsa, THE System SHALL menampilkan pesan kesalahan yang deskriptif kepada customer.
4. WHEN Promo_Code berhasil diterapkan, THE Checkout_Page SHALL menampilkan kode promo yang aktif dan tombol untuk menghapus kode tersebut.
5. WHEN customer menghapus Promo_Code yang sudah diterapkan, THE Checkout_Page SHALL mengembalikan subtotal ke nilai semula tanpa diskon.
6. WHEN pesanan dibuat dengan Promo_Code yang valid, THE System SHALL menyimpan kode promo dan nilai Discount pada data pesanan.
7. THE System SHALL menyimpan data kode promo (kode, tipe diskon, nilai diskon, tanggal kedaluwarsa, batas penggunaan) di tabel `promo_codes` pada database.
8. IF Promo_Code telah mencapai batas penggunaan maksimum, THEN THE System SHALL menolak kode tersebut dan menampilkan pesan kesalahan kepada customer.
9. THE System SHALL memvalidasi Promo_Code melalui API endpoint sebelum menerapkan diskon, bukan hanya di sisi client.

---

### Requirement 3: Chat Close / Delete oleh Admin

**User Story:** Sebagai Admin, saya ingin dapat menutup dan menghapus percakapan chat secara manual setelah pesanan diselesaikan, sehingga database tetap bersih dan tidak menyimpan riwayat chat yang sudah tidak relevan.

#### Acceptance Criteria

1. THE Chat_System SHALL menampilkan tombol "Tutup Chat" pada header percakapan yang aktif di panel admin.
2. WHEN Admin menekan tombol "Tutup Chat", THE System SHALL menampilkan dialog konfirmasi yang menjelaskan bahwa tindakan ini akan menghapus seluruh riwayat percakapan dan file terkait secara permanen.
3. WHEN Admin mengonfirmasi penghapusan, THE System SHALL menghapus baris Conversation beserta seluruh Message terkait dari database (cascade delete).
4. WHEN Admin mengonfirmasi penghapusan, THE System SHALL menghapus semua file yang diunggah dalam percakapan tersebut dari penyimpanan server (`server/uploads/chat/`).
5. WHEN Admin mengonfirmasi penghapusan, THE System SHALL menghapus data percakapan terkait dari localStorage (key `gala.chats`) pada semua tab browser yang aktif.
6. WHEN penghapusan berhasil, THE Chat_System SHALL memperbarui daftar percakapan dan menghilangkan percakapan yang dihapus dari tampilan.
7. THE System SHALL hanya mengizinkan Admin untuk memicu penghapusan percakapan; penghapusan tidak terjadi secara otomatis oleh sistem.
8. IF penghapusan gagal karena kesalahan server, THEN THE System SHALL menampilkan pesan kesalahan kepada Admin dan tidak menghapus data dari localStorage.

---

### Requirement 4: Order Source Label pada Detail Pesanan

**User Story:** Sebagai Admin, Sub_Admin, atau Owner, saya ingin melihat informasi asal pesanan (Custom Order atau Offline Order) pada popup detail pesanan, sehingga saya dapat memahami konteks pesanan dengan lebih baik.

#### Acceptance Criteria

1. WHEN Admin, Sub_Admin, atau Owner membuka Order_Detail_Modal untuk pesanan dengan `source = 'custom'`, THE Order_Detail_Modal SHALL menampilkan badge berlabel "Custom Order" yang terlihat jelas.
2. WHEN Admin, Sub_Admin, atau Owner membuka Order_Detail_Modal untuk pesanan dengan `source = 'offline'`, THE Order_Detail_Modal SHALL menampilkan badge berlabel "Offline Order" yang terlihat jelas.
3. WHEN Admin, Sub_Admin, atau Owner membuka Order_Detail_Modal untuk pesanan dengan `source = 'online'`, THE Order_Detail_Modal SHALL tidak menampilkan badge sumber pesanan (tampilan standar).
4. THE Order_Detail_Modal SHALL menampilkan badge sumber pesanan di bagian header modal, berdekatan dengan nomor pesanan dan status.
5. THE System SHALL membaca nilai `source` dari data pesanan yang sudah ada di database tanpa memerlukan migrasi skema tambahan.

---

### Requirement 5: Order Cancellation oleh Admin dan Owner

**User Story:** Sebagai Admin atau Owner, saya ingin dapat membatalkan pesanan customer yang masuk dengan menyertakan alasan pembatalan, sehingga customer mengetahui mengapa pesanannya dibatalkan.

#### Acceptance Criteria

1. THE System SHALL menampilkan opsi "Batalkan Pesanan" pada antarmuka manajemen pesanan untuk pengguna dengan role `admin` atau `owner`.
2. WHEN Admin atau Owner memilih opsi "Batalkan Pesanan", THE System SHALL menampilkan dialog yang mewajibkan pengisian Cancellation_Reason sebelum konfirmasi.
3. IF Admin atau Owner mencoba mengonfirmasi pembatalan tanpa mengisi Cancellation_Reason, THEN THE System SHALL menolak aksi tersebut dan menampilkan pesan validasi.
4. WHEN Admin atau Owner mengonfirmasi pembatalan dengan Cancellation_Reason yang valid, THE System SHALL mengubah status pesanan menjadi `Cancelled`.
5. WHEN pesanan dibatalkan, THE System SHALL menyimpan Cancellation_Reason pada kolom `cancellation_reason` di tabel `orders`.
6. WHEN pesanan dibatalkan, THE System SHALL mencatat entri pada Order_History yang menyertakan Cancellation_Reason dan identitas aktor yang melakukan pembatalan.
7. WHEN customer melihat detail pesanan yang dibatalkan, THE System SHALL menampilkan Cancellation_Reason kepada customer.
8. THE System SHALL mengizinkan pembatalan pesanan oleh Admin atau Owner pada semua status pesanan kecuali `Finished` dan `Cancelled`.
9. WHEN pesanan dibatalkan, THE System SHALL menghapus file bukti pembayaran dan file desain yang terkait dengan pesanan tersebut dari penyimpanan server.
