# 14 — PERTANYAAN TERBUKA

Dokumen ini berisi hal-hal yang **belum terverifikasi** dari kode saat ini dan perlu konfirmasi pemilik proyek/engineer yang berwenang.

## Keamanan & Otorisasi

| # | Pertanyaan | Alasan | Cara Verifikasi |
|---|---|---|---|
| Q1 | Apakah `GET /api/orders/:id` boleh diakses customer lain? | Saat ini hanya `authenticate` | Keputusan bisnis; jika tidak, wajib perbaiki |
| Q2 | Apakah tracking publik boleh enumerasi? | Nomor order prediktif | Setuju batasi atau tambahkan verifikasi? |
| Q3 | Apakah `/diag` dan `/diag/log` memang diperlukan di produksi? | Saat ini terbuka | Bisa dihapus/dilindungi? |
| Q4 | Apakah file di `/uploads` boleh publik? | Bukti bayar/desain bisa diunduh | Perlu signed URL atau auth? |
| Q5 | Siapa yang boleh mengakses `/api/orders/:orderId/invoice`? | Route menggunakan `getInvoiceByOrder` tanpa cek kepemilikan eksplisit terlihat | Periksa `invoice.controller.js` |
| Q6 | Apakah promoted admin wajib tunduk `checkFeature` untuk semua fitur? | Hanya 2 route saat ini | Ingin perluas ke semua atau sebagian? |

## Siklus Order & Bisnis

| # | Pertanyaan | Alasan | Cara Verifikasi |
|---|---|---|---|
| Q7 | Bolehkah CS menghapus order custom yang sudah `Finished`/`In Delivery`? | Aturan saat ini salah (status usang) | Kebijakan bisnis saat ini? |
| Q8 | Apakah QC boleh melakukan reject (`Quality Checking → On Progress`)? | Diblokir `assertNotLocked` | Apakah fitur ini digunakan? |
| Q9 | Bolehkah admin mengedit order yang sudah `Finished`/`In Delivery`? | Belum diverifikasi | Periksa UI + kebijakan |
| Q10 | Apa tujuan kolom `refund_amount`? | Ada di skema, tidak terlihat pemakaiannya | Digunakan saat cancel/refund? |
| Q11 | Apakah invoice otomatis harus selalu dibuat? | Fire-and-forget, bisa gagal | Perlu retry/job? |
| Q12 | Apakah order offline wajib punya bukti bayar? | Ada pengecekan | Berlaku untuk semua kasus offline? |
| Q13 | Apa arti `customer_type` broker vs customer? | Ada di order dan produk | Harga broker dipakai di mana? |

## Autentikasi & Permission

| # | Pertanyaan | Alasan | Cara Verifikasi |
|---|---|---|---|
| Q14 | Mana yang otoritatif: `user_permissions` atau `admin_permissions`? | Dua tabel berbeda | Sudah ada migrasi konsolidasi? |
| Q15 | Bolehkah access token dipakai setelah akun di-soft-delete? | Hanya dicek `must_change_password`, bukan `deleted_at` | Ingin invalidate segera? |
| Q16 | Apakah `must_change_password` harus fail-closed atau fail-open? | Saat ini fail-open | Kebijakan keamanan |
| Q17 | Apakah owner selalu punya semua permission? | Perlu dicek | Di kode terlihat `requireRole('owner')` dipakai terpisah |
| Q18 | Apakah promoted admin bisa dibuat oleh siapa? | Ada di `adminAccounts` | Hanya owner? |

## Database & Migrasi

| # | Pertanyaan | Alasan | Cara Verifikasi |
|---|---|---|---|
| Q19 | Mengapa migrasi `060` tidak ada? | Lompat 059 → 061 | Kesalahan nomor atau sengaja dihapus? |
| Q20 | Apakah `combined_schema.sql` masih dipakai? | Sangat usang vs migrasi saat ini | Untuk dokumentasi atau setup baru? |
| Q21 | Apakah aman menghapus semua FK user? | Sudah diterapkan | Ada rencana menambah kembali? |
| Q22 | Apakah data lama di `users` benar-benar tidak dipakai? | Migrasi 055 menghapus tabel | Backup sudah ada? |
| Q23 | Apakah tabel `analytics_visits`/`product_views` direset saat owner reset revenue? | `resetAllRevenueData` ada | Konfirmasi scope reset |

## Frontend & Deploy

| # | Pertanyaan | Alasan | Cara Verifikasi |
|---|---|---|---|
| Q24 | Mengapa `dist/` di-commit? | 171 file tracked | Deploy manual atau CI? |
| Q25 | Apakah CI harus tetap support Node 18/20/22 atau cukup 24? | Engine butuh >=24 | Hostinger support Node 24? |
| Q26 | Apakah `VITE_USE_BACKEND=false` masih dipakai? | Ada fallback localStorage | Masih ada skenario mock? |
| Q27 | Apakah 3 bahasa (`id`,`en`,`bal`) semuanya aktif digunakan? | Semua lengkap | Ada kebutuhan pemeliharaan semua? |
| Q28 | Apakah halaman dashboard perlu dipecah lebih jauh? | Sangat besar | Prioritas refactor? |

## Testing & Operasional

| # | Pertanyaan | Alasan | Cara Verifikasi |
|---|---|---|---|
| Q29 | Apakah test backend wajib dijalankan di CI? | Saat ini tidak | Ingin gate wajib? |
| Q30 | Apakah ada environment staging? | Tidak terlihat | Untuk uji migrasi/fitur? |
| Q31 | Bagaimana backup DB dilakukan? | Tidak ada script terlihat | Manual atau otomatis? |
| Q32 | Apakah `UPLOAD_DIR` di produksi sudah di luar project dir? | Penting di Hostinger | Sesuai rekomendasi storage.js? |
| Q33 | Apakah rate limit sudah cukup untuk produksi? | Ada di beberapa route | Perlu global limit? |

## Konfirmasi Cepat untuk Audit Ini

| Pertanyaan | Tujuan |
|---|---|
| Benarkah `GET /api/orders/:id` harus bisa diakses customer lain? | Validasi temuan S1 |
| Bolehkah `/diag` dihapus? | Validasi S3 |
| Apakah ada rencana menegakkan `checkFeature` ke lebih banyak route? | Validasi S5 |
| Apakah aturan hapus CS perlu diperbaiki? | Validasi S7 |
| Apakah QC reject perlu diizinkan? | Validasi S8 |

## Catatan

Semua pertanyaan di atas adalah **bukan temuan bug**, melainkan **hal yang perlu klarifikasi**. Beberapa bisa jadi memang dirancang sengaja (mis. tracking publik untuk kemudahan pelanggan), tetapi perlu dievaluasi ulang dari sisi keamanan.

**Rekomendasi audit lanjutan:** Setelah klarifikasi, buat rencana perbaikan berbasis prioritas P0–P2 dengan regresi test.

**AKHIR DOKUMEN** — Semua 15 file (00–14) telah dibuat di `docs/audit/`.
