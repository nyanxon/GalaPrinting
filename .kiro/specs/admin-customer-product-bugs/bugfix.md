# Bugfix Requirements Document

## Introduction

Dua bug ditemukan pada halaman admin/owner:

1. **Bug Tanggal Bergabung Customer**: Di menu Customer, kolom "Bergabung" menampilkan "Invalid Date" karena ketidakcocokan nama field antara respons API (`created_at`, snake_case) dan kode frontend yang mengakses `u.createdAt` (camelCase).

2. **Bug Input Gambar Produk**: Di menu Product, form tambah/edit produk tidak memiliki input untuk gambar sama sekali. Rencana: produk dapat memiliki hingga 8 foto, dengan minimal 1 foto wajib diisi.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — Tanggal Bergabung Customer:**

1.1 WHEN admin/owner membuka halaman Customer dan data customer dimuat dari backend THEN sistem menampilkan "Invalid Date" pada kolom "Bergabung" karena `u.createdAt` bernilai `undefined` (API mengembalikan `created_at`)

1.2 WHEN admin/owner mencari customer dan hasil pencarian ditampilkan THEN sistem tetap menampilkan "Invalid Date" pada kolom "Bergabung" untuk semua hasil

**Bug 2 — Input Gambar Produk:**

1.3 WHEN admin/owner membuka form tambah produk THEN sistem tidak menampilkan field input untuk gambar produk

1.4 WHEN admin/owner membuka form edit produk THEN sistem tidak menampilkan field input untuk gambar produk yang sudah ada maupun untuk menambah/mengubah gambar

1.5 WHEN admin/owner menyimpan produk baru THEN sistem menyimpan produk tanpa gambar (menggunakan placeholder hardcoded `/assets/img/placeholder.svg`)

---

### Expected Behavior (Correct)

**Bug 1 — Tanggal Bergabung Customer:**

2.1 WHEN admin/owner membuka halaman Customer dan data customer dimuat dari backend THEN sistem SHALL menampilkan tanggal bergabung yang valid dan terformat (misal: "7 Mei 2025") pada kolom "Bergabung"

2.2 WHEN admin/owner mencari customer dan hasil pencarian ditampilkan THEN sistem SHALL menampilkan tanggal bergabung yang valid untuk semua hasil pencarian

**Bug 2 — Input Gambar Produk:**

2.3 WHEN admin/owner membuka form tambah produk THEN sistem SHALL menampilkan input untuk mengunggah minimal 1 dan maksimal 8 foto produk

2.4 WHEN admin/owner membuka form edit produk THEN sistem SHALL menampilkan gambar produk yang sudah ada dan menyediakan input untuk menambah atau mengganti gambar (minimal 1, maksimal 8 foto)

2.5 WHEN admin/owner mencoba menyimpan produk tanpa gambar THEN sistem SHALL menampilkan pesan validasi bahwa minimal 1 gambar wajib diunggah

2.6 WHEN admin/owner mengunggah lebih dari 8 foto THEN sistem SHALL menolak penambahan foto ke-9 dan menampilkan pesan bahwa maksimal 8 foto diperbolehkan

2.7 WHEN admin/owner menyimpan produk dengan gambar THEN sistem SHALL menyimpan URL gambar dan menampilkan gambar tersebut di halaman produk publik

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN admin/owner membuka halaman Customer THEN sistem SHALL CONTINUE TO menampilkan daftar customer dengan kolom Nama, Email, Telepon, dan Bergabung

3.2 WHEN admin/owner menggunakan fitur pencarian customer THEN sistem SHALL CONTINUE TO memfilter customer berdasarkan nama, email, atau telepon

3.3 WHEN admin/owner menggunakan paginasi pada daftar customer THEN sistem SHALL CONTINUE TO menampilkan halaman yang benar

3.4 WHEN admin/owner membuka form tambah/edit produk THEN sistem SHALL CONTINUE TO menampilkan field Nama, Kategori, Harga, Deskripsi, Warna, Ukuran, Bahan, Harga Varian, dan Wajib Upload Desain

3.5 WHEN admin/owner menyimpan produk dengan data valid THEN sistem SHALL CONTINUE TO menyimpan semua field produk (nama, kategori, harga, deskripsi, varian, dll.) dengan benar

3.6 WHEN admin/owner menghapus produk THEN sistem SHALL CONTINUE TO menghapus produk dari daftar

3.7 WHEN customer membuka halaman katalog produk publik THEN sistem SHALL CONTINUE TO menampilkan produk dengan gambar yang benar
