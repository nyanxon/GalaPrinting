# 12 — TINJAUAN KEAMANAN

## Metodologi

Review berbasis kode (static): autentikasi, otorisasi, input, file upload, session, logging, konfigurasi, dan exposure. Tidak ada penetration test atau scanning otomatis.

## Temuan Utama

### S1 — IDOR pada Detail Order (KRITIS)

| Item | Detail |
|---|---|
| Lokasi | `server/src/routes/orders.routes.js:74` — `router.get('/:id', authenticate, ctrl.getOrder)` |
| Deskripsi | Hanya `authenticate`, **tanpa** `requireRole` dan **tanpa** pengecekan kepemilikan. Customer login mana pun dapat memanggil `GET /api/orders/:id` dengan UUID order milik orang lain. |
| Dampak | Kebocoran data pelanggan: nama, telepon, alamat, email, item, harga, desain, bukti bayar, invoice. |
| Bukti | `orders.controller.js` `getOrder` → `orders.service.js` `getOrderById` hanya mengambil order berdasarkan ID tanpa filter user/role. |
| Perbaikan | Cek: owner order (`customer_id` cocok) ATAU staff role; atau tambahkan validasi di service. |

### S2 — Enumerasi Tracking Publik (TINGGI)

| Item | Detail |
|---|---|
| Lokasi | `server/src/routes/orders.routes.js:52` — `router.get('/track', ctrl.trackOrder)` |
| Deskripsi | Publik, hanya butuh `orderNumber`. `phone` bersifat opsional. Nomor order bersifat prediktif/berurutan. |
| Dampak | Dapat menebak nomor order lain dan melihat status + info order. |
| Bukti | `findOrder({ orderNumber, phone })` |
| Perbaikan | Wajibkan verifikasi (phone/email), tambahkan rate limit ketat, kembalikan pesan generik, atau tambahkan CAPTCHA. |

### S3 — Endpoint Diagnostik Terbuka (TINGGI)

| Item | Detail |
|---|---|
| Lokasi | `server/src/app.js:104–138` — `GET /diag`, `GET /diag/log` |
| Deskripsi | Tanpa autentikasi, sebelum helmet/CORS. Menampilkan Node version, env, port, cwd, uptime, dan isi `startup-diag.log`. |
| Dampak | Reconnaissance, kebocoran path/config startup. |
| Perbaikan | Hapus atau lindungi dengan IP allowlist/token admin. |

### S4 — File Upload Publik (SEDANG–TINGGI)

| Item | Detail |
|---|---|
| Lokasi | `server/src/app.js:290–292` — `app.use('/uploads', express.static(uploadsAbsPath))` |
| Deskripsi | Semua file di `/uploads` dapat diakses siapa pun tanpa auth. |
| Dampak | Bukti pembayaran, desain customer, avatar bisa diunduh jika URL diketahui. |
| Bukti | `StorageService` menyimpan path publik `/uploads/...` |
| Perbaikan | Auth-gated static serving atau signed URL; batasi akses per resource. |

### S5 — Permission Dinamis Tidak Ditegakkan (TINGGI)

| Item | Detail |
|---|---|
| Lokasi | `server/src/middleware/checkFeature.js` |
| Deskripsi | Hanya dipasang di `GET /api/export/database` dan `GET /api/promo`. Hampir semua route memakai `requireRole` hardcoded. |
| Dampak | Promoted admin bisa mengakses fitur lain meski “tidak diizinkan” di UI. |
| Perbaikan | Terapkan ke seluruh route fitur atau jadikan policy terpusat. |

### S6 — Hilangnya Integritas Referensial User (SEDANG)

| Item | Detail |
|---|---|
| Lokasi | Migrasi `054_drop_users_fk_constraints.sql`, `055_drop_legacy_users_table.sql` |
| Deskripsi | Semua FK ke tabel user dicabut; relasi kini tanpa constraint. |
| Dampak | Orphan data, kesulitan integritas & cleanup. |
| Perbaikan | Validasi aplikasi ketat + job pembersihan berkala; pertimbangkan soft-delete konsisten. |

### S7 — Duplikasi Aturan Hapus Order (SEDANG)

| Item | Detail |
|---|---|
| Lokasi | `server/src/services/orders.service.js` `getOrderDeletePermission` |
| Deskripsi | CS memblokir status usang (`Ready to Ship`, `Shipped`, `Completed`) dan **tidak** memblokir `Design Accepted`, `Quality Checking`, `In Delivery`, `Finished`. |
| Dampak | Order custom yang sudah diproses/selesai bisa dihapus oleh CS. |
| Perbaikan | Gunakan sumber status yang sama dengan `TRANSITIONS`; evaluasi ulang kebijakan. |

### S8 — Approval Lock Memblokir Rework (SEDANG–TINGGI Fungsional)

| Item | Detail |
|---|---|
| Lokasi | `server/src/services/orderApprovals.service.js` `assertNotLocked` |
| Deskripsi | Blokir transisi ke **stage apa pun yang pernah di-approve**. `Quality Checking → On Progress` (QC reject) dilarang meski diizinkan matriks. |
| Dampak | Order macet, bypass manual. |
| Perbaikan | Lock hanya untuk forward ke tahap yang sama atau tambahkan exception untuk reject path. |

### S9 — Session & Auth (SEDANG)

| Temuan | Detail |
|---|---|
| Access token tidak dicek `deleted_at` | `authenticate` hanya cek `must_change_password`; token bisa dipakai hingga expired |
| `must_change_password` fail-open | bila query gagal, request diteruskan |
| Failed login map in-memory | hilang saat restart, tidak terpusat, bisa membengkak |
| Cookie `sameSite: strict` di prod | aman untuk same-origin, bisa issue jika ada subdomain `[ASUMSI]` |
| Refresh reuse → hapus family | baik, dengan grace 10 detik |

### S10 — Upload (SEDANG)

| Temuan | Detail |
|---|---|
| Validasi MIME hanya dari header klien | mudah dipalsukan |
| Batas 100 MB besar | risiko DoS disk |
| Tidak ada scan antivirus | — |
| File disimpan dengan nama acak + ekstensi asli | mencegah path traversal, tapi perlu validasi konten |
| `multer` ke `os.tmpdir` lalu copy | aman |

### S11 — Konfigurasi & Expose (SEDANG)

| Temuan | Detail |
|---|---|
| `dist/` di-commit | bisa menampilkan artefak lama |
| `dasdasd` di root | sampah |
| Log startup menulis ke file | bisa diakses via `/diag/log` |
| `testConnection()` warning only | server tetap up |
| Error handler stack hanya dev | baik |
| Helmet aktif | baik |
| CORS allowlist | baik |
| Rate limit auth/analytics | baik |

## Matriks Risiko

| ID | Risiko | Severity | Likelihood | Prioritas |
|---|---|---|---|---|
| S1 | IDOR order detail | **Kritis** | Tinggi | P0 |
| S2 | Tracking enumerasi | **Tinggi** | Tinggi | P0 |
| S3 | /diag terbuka | **Tinggi** | Tinggi | P0 |
| S5 | Permission tidak ditegakkan | **Tinggi** | Tinggi | P0 |
| S4 | Upload publik | **Sedang–Tinggi** | Tinggi | P1 |
| S8 | Approval lock bug | **Sedang–Tinggi** | Sedang | P1 |
| S7 | Hapus order CS salah | **Sedang** | Sedang | P1 |
| S6 | Tanpa FK user | **Sedang** | Rendah–Sedang | P2 |
| S9 | Sesi/leak kecil | **Sedang** | Rendah | P2 |
| S10 | Upload validation | **Sedang** | Rendah | P2 |

## Checklist Perbaikan Cepat

### Segera
- [ ] Tambahkan ownership/role check ke `GET /api/orders/:id`
- [ ] Perketat `GET /api/orders/track` (rate limit + validasi)
- [ ] Nonaktifkan atau lindungi `/diag` dan `/diag/log`
- [ ] Audit `GET /api/orders/:orderId/invoice` dan endpoint lain dengan `:id`

### Minggu Depan
- [ ] Terapkan `checkFeature` ke route penting
- [ ] Perbaiki `getOrderDeletePermission`
- [ ] Perbaiki `assertNotLocked` untuk jalur QC reject
- [ ] Batasi akses `/uploads` (auth/signed URL)
- [tag] Tambahkan pengujian IDOR

### Jangka Panjang
- [ ] Evaluasi kembali split user + FK
- [ ] Tambahkan WAF/rate limit global
- [ ] Implement magic bytes validation
- [ ] Central policy engine
- [ ] Logging terstruktur & SIEM

## Catatan Positif

- Password hash dengan bcrypt
- Refresh token rotation + reuse detection
- Access token in-memory
- JWT verifikasi kuat
- Helmet + CORS
- Rate limit pada auth
- Parameterized query
- `escapeHtml` tersedia
- Role matrix jelas
- Fail-safe pada upload MIME

## Kesimpulan

Tiga temuan **P0** yang paling mendesak adalah **IDOR order detail**, **enumerasi tracking publik**, dan **endpoint diagnostik terbuka**. Selain itu, **penegakan permission dinamis** perlu segera diperbaiki. Sistem ini secara umum memiliki pondasi keamanan yang baik, tetapi **otorisasi per-record** masih lemah di beberapa tempat.

BERSAMBUNG ke `13-technical-debt-and-risks.md`
