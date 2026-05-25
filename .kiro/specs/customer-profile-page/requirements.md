# Requirements Document

## Introduction

Fitur Customer Profile Page memungkinkan pelanggan Gala Printing untuk mengelola informasi pribadi mereka, daftar alamat pengiriman, dan preferensi notifikasi email. Halaman profil dapat diakses melalui ikon profil di navbar. Alamat yang tersimpan dapat dipilih langsung saat checkout sehingga pelanggan tidak perlu mengetik ulang data pengiriman. Foto profil mendukung crop dan zoom sebelum disimpan, dan ikon profil di navbar akan menampilkan foto profil pelanggan jika sudah diunggah.

---

## Glossary

- **Profile_Page**: Halaman `/profile` yang hanya dapat diakses oleh pelanggan yang sudah login.
- **Profile_Form**: Formulir pada bagian Biodata Diri di Profile_Page.
- **Address_List**: Daftar alamat pengiriman yang tersimpan milik pelanggan.
- **Address_Form**: Formulir untuk menambah atau mengedit satu entri alamat.
- **Notification_Settings**: Panel preferensi notifikasi email pelanggan.
- **Image_Cropper**: Komponen antarmuka untuk memilih area, zoom in/out, dan memotong foto profil sebelum diunggah.
- **Profile_Photo**: Foto profil pelanggan yang telah di-crop dan disimpan.
- **Navbar**: Komponen navigasi utama yang tampil di semua halaman publik.
- **Checkout_Page**: Halaman `/checkout` tempat pelanggan menyelesaikan pemesanan.
- **Address_Selector**: Komponen dropdown/modal di Checkout_Page untuk memilih alamat tersimpan.
- **Email_Service**: Layanan pengiriman email transaksional menggunakan Resend.
- **Customer**: Pengguna dengan role `customer` yang sudah login.
- **API_Server**: Backend Express.js yang melayani endpoint REST.

---

## Requirements

### Requirement 1: Akses Halaman Profil

**User Story:** Sebagai pelanggan, saya ingin mengakses halaman profil saya, agar saya dapat melihat dan mengelola informasi akun saya.

#### Acceptance Criteria

1. WHEN seorang Customer mengunjungi `/profile`, THE Profile_Page SHALL menampilkan tiga bagian: Biodata Diri, Daftar Alamat, dan Notifikasi.
2. WHEN pengguna yang belum login mengunjungi `/profile`, THE Profile_Page SHALL mengalihkan pengguna ke halaman `/register`.
3. WHEN pengguna dengan role selain `customer` mengunjungi `/profile`, THE Profile_Page SHALL mengalihkan pengguna ke halaman `/register`.

---

### Requirement 2: Biodata Diri (Personal Information)

**User Story:** Sebagai pelanggan, saya ingin melihat dan mengedit informasi pribadi saya, agar data akun saya selalu akurat.

#### Acceptance Criteria

1. THE Profile_Page SHALL menampilkan bidang berikut pada bagian Biodata Diri: foto profil, nama, tanggal lahir, jenis kelamin, email, dan nomor handphone.
2. WHEN Customer mengklik tombol edit pada bagian Biodata Diri, THE Profile_Form SHALL beralih ke mode edit dan memungkinkan perubahan pada bidang: nama, tanggal lahir, jenis kelamin, dan nomor handphone.
3. WHEN Customer menyimpan perubahan Biodata Diri dengan data valid, THE API_Server SHALL memperbarui data profil Customer di database dan mengembalikan data terbaru.
4. WHEN Customer menyimpan perubahan Biodata Diri dengan nama kosong, THE Profile_Form SHALL menampilkan pesan kesalahan "Nama wajib diisi." dan tidak mengirim permintaan ke API_Server.
5. WHEN Customer menyimpan perubahan Biodata Diri dengan nomor handphone yang tidak valid (bukan format numerik 8–15 digit), THE Profile_Form SHALL menampilkan pesan kesalahan "Nomor handphone tidak valid." dan tidak mengirim permintaan ke API_Server.
6. THE Profile_Form SHALL menampilkan bidang email sebagai read-only karena email digunakan sebagai identitas login.
7. WHEN Customer berhasil menyimpan perubahan Biodata Diri, THE Profile_Page SHALL menampilkan notifikasi sukses "Profil berhasil diperbarui."

---

### Requirement 3: Unggah dan Crop Foto Profil

**User Story:** Sebagai pelanggan, saya ingin mengunggah foto profil dan memilih bagian foto yang ingin ditampilkan, agar foto profil saya terlihat sesuai keinginan.

#### Acceptance Criteria

1. WHEN Customer mengklik area foto profil atau tombol ganti foto, THE Image_Cropper SHALL terbuka dan memungkinkan Customer memilih file gambar dari perangkat.
2. WHEN Customer memilih file gambar, THE Image_Cropper SHALL menampilkan pratinjau gambar dengan kontrol zoom in, zoom out, dan geser/posisi untuk memilih area crop.
3. WHEN Customer mengkonfirmasi crop, THE Profile_Page SHALL mengunggah hasil crop ke API_Server sebagai file JPEG atau PNG.
4. IF file yang dipilih bukan format gambar (JPEG, PNG, WebP, GIF), THEN THE Image_Cropper SHALL menampilkan pesan kesalahan "Format file tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF."
5. IF ukuran file gambar melebihi 5 MB, THEN THE Image_Cropper SHALL menampilkan pesan kesalahan "Ukuran file maksimal 5 MB."
6. WHEN foto profil berhasil diunggah, THE API_Server SHALL menyimpan file ke direktori `uploads/avatars/` dan memperbarui URL foto profil Customer di database.
7. WHEN foto profil berhasil diunggah, THE Navbar SHALL segera menampilkan Profile_Photo terbaru sebagai ikon profil Customer tanpa perlu me-refresh halaman.

---

### Requirement 4: Ikon Profil di Navbar

**User Story:** Sebagai pelanggan, saya ingin melihat foto profil saya di navbar, agar saya dapat dengan mudah mengakses halaman profil dan mengetahui bahwa saya sudah login.

#### Acceptance Criteria

1. WHEN Customer yang sudah login tidak memiliki Profile_Photo, THE Navbar SHALL menampilkan ikon profil default (SVG/emoji) yang dapat diklik untuk menuju `/profile`.
2. WHEN Customer yang sudah login memiliki Profile_Photo, THE Navbar SHALL menampilkan Profile_Photo sebagai gambar bulat (avatar) yang dapat diklik untuk menuju `/profile`.
3. WHEN pengguna belum login, THE Navbar SHALL tidak menampilkan ikon profil atau avatar.
4. THE Navbar SHALL menampilkan tautan "Profil Saya" yang mengarah ke `/profile` pada menu navigasi Customer.

---

### Requirement 5: Daftar Alamat (Address List)

**User Story:** Sebagai pelanggan, saya ingin menyimpan beberapa alamat pengiriman, agar saya tidak perlu mengetik ulang alamat setiap kali checkout.

#### Acceptance Criteria

1. THE Profile_Page SHALL menampilkan semua alamat tersimpan milik Customer pada bagian Daftar Alamat.
2. WHEN Customer mengklik tombol "Tambah Alamat", THE Address_Form SHALL terbuka dan memungkinkan Customer mengisi bidang: judul, nama, nomor telepon, dan alamat lengkap.
3. WHEN Customer menyimpan Address_Form dengan semua bidang wajib terisi valid, THE API_Server SHALL menyimpan alamat baru dan mengembalikan daftar alamat terbaru.
4. WHEN Customer menyimpan Address_Form dengan judul kosong, THE Address_Form SHALL menampilkan pesan kesalahan "Judul alamat wajib diisi."
5. WHEN Customer menyimpan Address_Form dengan nama kosong, THE Address_Form SHALL menampilkan pesan kesalahan "Nama wajib diisi."
6. WHEN Customer menyimpan Address_Form dengan nomor telepon kosong, THE Address_Form SHALL menampilkan pesan kesalahan "Nomor telepon wajib diisi."
7. WHEN Customer menyimpan Address_Form dengan alamat lengkap kosong, THE Address_Form SHALL menampilkan pesan kesalahan "Alamat lengkap wajib diisi."
8. WHEN Customer sudah memiliki 10 alamat tersimpan, THE Profile_Page SHALL menonaktifkan tombol "Tambah Alamat" dan menampilkan pesan "Batas maksimal 10 alamat telah tercapai."
9. WHEN Customer mengklik tombol edit pada salah satu alamat, THE Address_Form SHALL terbuka dengan data alamat yang dipilih dan memungkinkan Customer mengubah semua bidang.
10. WHEN Customer mengklik tombol hapus pada salah satu alamat, THE Profile_Page SHALL menampilkan konfirmasi penghapusan sebelum menghapus alamat.
11. WHEN Customer mengkonfirmasi penghapusan alamat, THE API_Server SHALL menghapus alamat dari database dan mengembalikan daftar alamat terbaru.

---

### Requirement 6: Pemilihan Alamat saat Checkout

**User Story:** Sebagai pelanggan, saya ingin memilih alamat tersimpan saat checkout, agar saya tidak perlu mengetik ulang data pengiriman.

#### Acceptance Criteria

1. WHEN Customer yang memiliki alamat tersimpan membuka Checkout_Page, THE Checkout_Page SHALL menampilkan Address_Selector untuk memilih dari alamat tersimpan.
2. WHEN Customer memilih alamat dari Address_Selector, THE Checkout_Page SHALL mengisi otomatis bidang nama, nomor telepon, dan alamat pengiriman dengan data dari alamat yang dipilih.
3. WHEN Customer yang tidak memiliki alamat tersimpan membuka Checkout_Page, THE Checkout_Page SHALL menampilkan formulir input manual seperti sebelumnya.
4. WHEN Customer memilih alamat dari Address_Selector, THE Checkout_Page SHALL tetap memungkinkan Customer mengedit bidang nama, nomor telepon, dan alamat secara manual setelah pemilihan.
5. THE Checkout_Page SHALL memungkinkan Customer untuk tidak memilih alamat tersimpan dan mengisi formulir secara manual.

---

### Requirement 7: Preferensi Notifikasi Email

**User Story:** Sebagai pelanggan, saya ingin mengatur notifikasi email yang saya terima, agar saya hanya mendapat email yang relevan bagi saya.

#### Acceptance Criteria

1. THE Profile_Page SHALL menampilkan lima opsi notifikasi email pada bagian Notifikasi, masing-masing dengan checkbox: Pembayaran Diterima, Pesanan Dikirim, Pesanan Selesai, Pesanan Dibatalkan, dan Berita Promo Gala Printing.
2. WHEN Customer mengubah status checkbox notifikasi dan menyimpan, THE API_Server SHALL memperbarui preferensi notifikasi Customer di database.
3. WHEN Customer berhasil menyimpan preferensi notifikasi, THE Profile_Page SHALL menampilkan notifikasi sukses "Preferensi notifikasi berhasil disimpan."
4. WHEN Customer pertama kali membuka halaman profil, THE Notification_Settings SHALL menampilkan status checkbox sesuai preferensi yang tersimpan di database.

---

### Requirement 8: Pengiriman Email Notifikasi

**User Story:** Sebagai pelanggan, saya ingin menerima email notifikasi sesuai preferensi saya, agar saya selalu mendapat informasi terkini tentang pesanan saya.

#### Acceptance Criteria

1. WHEN status pesanan berubah menjadi "Pembayaran Diterima" dan Customer mengaktifkan notifikasi Pembayaran Diterima, THE Email_Service SHALL mengirim email notifikasi ke alamat email Customer.
2. WHEN status pesanan berubah menjadi "Dikirim" dan Customer mengaktifkan notifikasi Pesanan Dikirim, THE Email_Service SHALL mengirim email notifikasi ke alamat email Customer.
3. WHEN status pesanan berubah menjadi "Selesai" dan Customer mengaktifkan notifikasi Pesanan Selesai, THE Email_Service SHALL mengirim email notifikasi ke alamat email Customer.
4. WHEN status pesanan berubah menjadi "Dibatalkan" dan Customer mengaktifkan notifikasi Pesanan Dibatalkan, THE Email_Service SHALL mengirim email notifikasi ke alamat email Customer.
5. WHEN promo baru diterbitkan dan Customer mengaktifkan notifikasi Berita Promo, THE Email_Service SHALL mengirim email notifikasi promo ke alamat email Customer.
6. IF pengiriman email gagal, THEN THE Email_Service SHALL mencatat kegagalan di log server dan tidak mengganggu alur utama aplikasi.
7. THE Email_Service SHALL menggunakan Resend sebagai provider pengiriman email.

---

### Requirement 9: Keamanan dan Otorisasi Data Profil

**User Story:** Sebagai pelanggan, saya ingin data profil saya aman, agar hanya saya yang dapat melihat dan mengubah informasi pribadi saya.

#### Acceptance Criteria

1. WHEN permintaan ke endpoint profil diterima tanpa token autentikasi yang valid, THE API_Server SHALL mengembalikan respons HTTP 401.
2. WHEN Customer mencoba mengakses atau mengubah data profil Customer lain, THE API_Server SHALL mengembalikan respons HTTP 403.
3. THE API_Server SHALL memvalidasi bahwa semua operasi CRUD pada alamat hanya dapat dilakukan oleh Customer pemilik alamat tersebut.
4. WHEN Customer mengunggah foto profil, THE API_Server SHALL memvalidasi tipe MIME file dan menolak file yang bukan gambar dengan respons HTTP 415.
