# 10 — REALTIME, CHAT & NOTIFIKASI

## Socket.IO (Server)

### Inisialisasi

`server/src/socket/index.js`:
- `new Server(httpServer, { cors: { origin: config.clientOrigin, credentials: true } })`
- Auth middleware: ambil `socket.handshake.auth.token`, verifikasi via `verifyAccessToken`, set `socket.user = { id, role, name, email }`, else `authentication_error`.
- `initSocket(httpServer)` dipanggil dari `server.js`.

### Room Strategy

| Pengguna | Room yang di-join |
|---|---|
| Customer | `customer:{userId}`, `conversation:{conversationId}` (bila ada) |
| Staff | `staff`, `staff:{userId}`, semua `conversation:{id}` untuk `conversation_type='customer_chat'`, semua DM room tempat user jadi peserta |

Customer dapat join room conversation secara manual via event `join:conversation`.

DM room di-join lewat `joinDMRooms()` yang query `conversations` dengan `dm_participant_a` atau `dm_participant_b`.

### Event yang Diterima (Client → Server)
- `join:conversation` (customer) — `{ conversationId }`

### Event yang Dikirim (Server → Client)

| Event | Tujuan | Penerima |
|---|---|---|
| `order:new` | order baru dibuat | `staff` |
| `order:status_changed` | status order berubah | `customer:{customer_id}` (jika ada), `staff` |
| `order:payment_proof` | bukti bayar diupload | `staff` |
| `message:new` | pesan baru (customer chat atau DM) | `conversation:{id}`, `staff` |
| `conversation:new` | conversation customer baru | `staff` |
| `dm:new` | DM baru dibuat | `staff:{participantA}`, `staff:{participantB}` |
| `conversation:read` | pesan dibaca | `conversation:{id}` |

Emiter ada di `orders.controller.js` dan `chat.controller.js` menggunakan `getIO()`.

### Keterbatasan
- Tidak ada validasi event payload.
- Tidak ada rate limit socket.
- Tidak ada namespace terpisah.
- Token access hanya dicek saat koneksi; tidak ada re-auth saat refresh.
- Client perlu reconnect manual setelah token refresh (`httpClient` dispatch `gala:token-refreshed` — `SocketContext` perlu menangkapnya `[TIDAK TERVERIFIKASI]`).

## Chat System

### Tipe Conversation
- `customer_chat` — customer ↔ staff, `customer_id` wajib, `dm_participant_a/b` null.
- `staff_dm` — staff ↔ staff, `customer_id` null, `dm_participant_a/b` terisi.

`conversations` memiliki `assigned_admin_id`, `last_at`, `hidden_by_admin`.

### Alur
1. Customer membuka chat → `POST /api/conversations` → `getOrCreateConversation` (buat atau ambil).
2. Staff mengirim balasan → emit `message:new` ke room conversation dan `staff`.
3. Customer membuka widget → `POST /api/conversations/mark-read`.
4. Staff membaca pesan → `PATCH /api/conversations/:id/read`.
5. Staff DM: `GET/POST /api/conversations/dm` → `getOrCreateDMConversation`.

### File Upload di Chat
`POST /api/conversations/:id/messages/file` dengan `uploadChat.single('file')`. Disimpan via `StorageService`, pesan bertipe `file` dengan `file_path`, `file_name`, `file_size`, `mime_type`.

### Unread
- Customer: `GET /api/conversations/unread-count` menghitung pesan dari admin yang belum dibaca.
- Staff: `GET /api/activity-log/unread-count` untuk activity log; unread chat dihitung secara terpisah `[TIDAK TERVERIFIKASI]`.

### Hide/Delete
- Hide: `PATCH /:id/hide` hanya admin — menghilangkan dari list tapi history tetap ada.
- Delete: `DELETE /:id` hanya admin — menghapus conversation.

## Activity Log

### Tujuan
Merekam snapshot aksi user untuk audit.

### Tabel
`activity_logs` (tanpa FK):
- `actor_type` ENUM('customer','admin')
- `actor_id`, `actor_name`, `actor_role` — **snapshot**
- `action_label`, `page_path`, `target_type`, `target_id`, `metadata JSON`, `ip_address`, `created_at`

`activity_log_reads` — per-reader read state.
`app_settings` — `setting_key='activity_log_retention_months'` (default 0 = OFF).

### API
- `POST /api/activity-log/batch` — `optionalAuth`, max 100 event, `batchLimiter`, selalu derive actor dari JWT (tidak dipercaya dari body).
- `GET /` — list dengan filter actorType/from/to/actorId/search, pagination, menghitung unread per reader.
- `GET /unread-count`, `POST /read-all`, `POST /:id/read`
- `GET /pdf` — untuk ekspor PDF
- `GET /retention`, `PUT /retention`, `DELETE /older-than`

### Retensi Otomatis
`jobs/activityLogPurge.js`:
- pertama jalan 1 menit setelah boot;
- interval setiap 1 jam;
- `purgeOldLogs()` menghapus berdasarkan cutoff;
- best-effort, tidak crash server;
- dikendalikan setting di DB.

### Catatan
- DDL dijalankan ganda: migrasi 057–059 dan `ensureActivityLogTables.js`.
- Batch endpoint mengembalikan 200 meski error (agar tidak mengganggu UX).
- IP diambil dari `req.ip`.

## Notifikasi Email

Service: `server/src/services/email.service.js` (±687 baris), provider **Resend**.

### Fungsi Tersedia
| Fungsi | Penggunaan |
|---|---|
| `sendEmail` | core |
| `sendVerificationEmail` | registrasi/verifikasi |
| `sendPasswordResetEmail` | forgot password customer |
| `sendOrderNotification` | update status (Design Accepted, In Delivery, Finished, Cancelled) |
| `sendNewOrderAdminAlert` | order baru ke admin email |
| `sendInvoiceEmail` | invoice PDF saat Payment Accepted |
| `sendPromoNotification` | promo |
| `sendOrderReceivedEmail` | order diterima |
| `sendMockupAcceptedEmail` | desain disetujui (alternatif) |
| `sendLoginNewDeviceEmail` | login dari device baru |
| `sendLoginFailedAlertEmail` | alert login gagal ≥5x |

### Konfigurasi
`config/env.js`:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (default `noreply@galaprintofficialbali.co.id`)
- `ADMIN_EMAIL`
- `FRONTEND_URL`

Bila `RESEND_API_KEY` kosong, pengiriman bisa gagal — perilaku `[TIDAK TERVERIFIKASI]`.

### Preferensi Notifikasi Customer

`notification_preferences` (8 flag):
- `order_received`
- `payment_accepted`
- `mockup_accepted` (Design Accepted)
- `order_shipped` (In Delivery)
- `order_finished`
- `order_cancelled`
- `login_new_device`
- `login_failed_alert`

Default semua true kecuali — lihat `notifications.service.js`. `forgot_password` dan `email_verification` **tidak** terpengaruh preferensi (core).

Flow pengecekan: `updateOrderStatus` memanggil `getPreferences(customerId)` sebelum kirim email status/invoice.

## Frontend Realtime

- `SocketProvider` mengelola koneksi.
- `core/socket.js` init dengan access token.
- Setelah token refresh, perlu reconnect socket `[TIDAK TERVERIFIKASI]` (ada event `gala:token-refreshed`).
- Komponen chat/dashboard mendengarkan event socket untuk update UI.

## Keamanan Realtime

| Risiko | Catatan |
|---|---|
| Socket auth hanya saat connect | token lama tetap dipakai socket sampai disconnect |
| Tidak ada event validation | client bisa kirim payload sembarangan |
| Room join tidak ketat | perlu pastikan user hanya join room yang boleh diakses |
| CORS socket pakai `CLIENT_ORIGIN` | sama dengan HTTP |
| `message:new` dikirim ke `staff` room | semua staff dapat notifikasi |

## Rekomendasi

1. Tambahkan re-auth/reconnect socket saat `gala:token-refreshed`.
2. Validasi event payload (zod/joi).
3. Rate limit per socket event.
4. Pastikan authorization per room (customer tidak boleh join room orang lain).
5. Pertimbangkan `ack` untuk pesan penting.
6. Batasi info di event `order:status_changed`.
7. Tangani koneksi terputus dengan UI yang jelas.

BERSAMBUNG ke `11-testing-and-quality.md`
