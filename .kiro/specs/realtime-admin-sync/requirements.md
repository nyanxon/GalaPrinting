# Requirements Document

## Introduction

Fitur ini menggantikan pola `getSocket()` yang dipanggil langsung di masing-masing komponen dengan sebuah **SocketContext terpusat** berbasis React Context API. SocketContext mengelola lifecycle koneksi Socket.io secara seragam: koneksi dibuka saat login/hydrate, ditutup saat logout, dan diperbarui otomatis setelah token refresh. Semua halaman admin (Admin, Owner, Cashier, CS, Operational, QC) kemudian mengakses socket melalui hook `useSocket()`, dan listener event yang belum ada di halaman-halaman tersebut ditambahkan sehingga seluruh tampilan admin bersinkron secara real-time.

---

## Glossary

- **SocketContext**: React Context yang menyimpan instance socket aktif dan state koneksi, dibuat khusus untuk fitur ini.
- **useSocket**: Custom React hook yang mengonsumsi SocketContext dan mengembalikan socket instance.
- **Socket**: Instance `socket.io-client` aktif yang terkoneksi ke server backend.
- **initSocket(token)**: Fungsi dari `src/core/socket.js` yang membuat koneksi Socket.io baru menggunakan JWT access token.
- **disconnectSocket()**: Fungsi dari `src/core/socket.js` yang menutup dan menghapus koneksi socket aktif.
- **getSocket()**: Fungsi lama dari `src/core/socket.js` yang diakses langsung per komponen — akan digantikan oleh `useSocket()`.
- **AuthContext**: React Context yang sudah ada, menyediakan state `user`, `loading`, dan fungsi `updateUser`.
- **SocketProvider**: Komponen React yang membungkus seluruh app tree dan mengelola lifecycle socket.
- **Halaman Admin**: AdminDashboardPage, OwnerDashboardPage, CashierDashboardPage, CSDashboardPage, OperationalDashboardPage, QCDashboardPage.
- **Section**: Komponen child yang di-render di dalam halaman admin (misal OrdersSection, CashierOrdersSection, SubAdminOrdersSection, ChatsSection, DMSection).
- **SubAdminLayout**: Komponen layout bersama untuk role Cashier, CS, Operational, QC.
- **ActivitySidebar**: Komponen sidebar di AdminDashboardPage dan OwnerDashboardPage yang menampilkan order dan chat terbaru.
- **gala:session-expired**: DOM event yang diemit oleh httpClient saat session habis — memicu logout dan disconnect socket.
- **order:new**: Socket event yang dikirim server saat order baru dibuat.
- **order:status_changed**: Socket event yang dikirim server saat status order berubah.
- **chat:message**: Socket event yang dikirim server saat pesan chat baru masuk.
- **chat:new_conversation**: Socket event yang dikirim server saat conversation baru dibuat.

---

## Requirements

### Requirement 1: SocketProvider — Pengelolaan Lifecycle Terpusat

**User Story:** Sebagai developer, saya ingin satu tempat terpusat yang mengelola koneksi socket agar tidak ada race condition timing dan socket selalu terikat dengan status autentikasi pengguna.

#### Acceptance Criteria

1. THE SocketProvider SHALL membuat file `src/components/context/SocketContext.jsx` yang mengekspor `SocketProvider` dan hook `useSocket`.

2. THE SocketProvider SHALL menyimpan socket instance aktif dalam React state sehingga perubahan socket me-trigger re-render komponen yang bergantung padanya.

3. WHEN AuthContext mengembalikan `user` yang tidak null dan `loading` bernilai false, THE SocketProvider SHALL memanggil `initSocket(accessToken)` dan menyimpan hasilnya ke dalam state.

4. WHEN AuthContext mengembalikan `user` bernilai null dan `loading` bernilai false, THE SocketProvider SHALL memanggil `disconnectSocket()` dan mengatur state socket menjadi null.

5. WHEN event DOM `gala:session-expired` diterima, THE SocketProvider SHALL memanggil `disconnectSocket()` dan mengatur state socket menjadi null.

6. THE SocketProvider SHALL membungkus seluruh app tree di `App.jsx` sebagai child dari `AuthProvider` dan parent dari `CartProvider`.

7. WHILE socket sedang terkoneksi, THE SocketProvider SHALL mempertahankan satu instance socket aktif — tidak membuat koneksi duplikat.

8. WHEN komponen yang menggunakan `useSocket()` di-unmount, THE SocketProvider SHALL memastikan listener event yang didaftarkan komponen tersebut dihapus melalui cleanup function `useEffect`.

---

### Requirement 2: Hook useSocket

**User Story:** Sebagai developer, saya ingin hook sederhana `useSocket()` agar setiap komponen bisa mendapatkan socket instance tanpa perlu mengetahui detail implementasi SocketContext.

#### Acceptance Criteria

1. THE `useSocket` hook SHALL mengembalikan socket instance aktif dari SocketContext, atau `null` jika belum terkoneksi.

2. WHEN `useSocket()` dipanggil di luar SocketProvider tree, THE `useSocket` hook SHALL melempar error dengan pesan yang informatif.

3. THE `useSocket` hook SHALL dapat digunakan di semua komponen admin tanpa prop drilling.

---

### Requirement 3: Migrasi getSocket() ke useSocket()

**User Story:** Sebagai developer, saya ingin mengganti semua pemanggilan `getSocket()` di komponen React dengan `useSocket()` agar timing dijamin oleh React lifecycle.

#### Acceptance Criteria

1. THE `OrdersSection` (admin) SHALL mengganti `import { getSocket }` dan panggilan `getSocket()` dengan `useSocket()` dari SocketContext.

2. THE `SubAdminOrdersSection` SHALL mengganti `import { getSocket }` dan panggilan `getSocket()` dengan `useSocket()` dari SocketContext.

3. THE `CashierOrdersSection` SHALL mengganti `import { getSocket }` dan panggilan `getSocket()` dengan `useSocket()` dari SocketContext.

4. THE `AdminDashboardPage` (ActivitySidebar dan inisialisasi `useAdminSound`) SHALL mengganti `import { getSocket }` dan panggilan `getSocket()` dengan `useSocket()` dari SocketContext.

5. THE `OwnerDashboardPage` (ActivitySidebar) SHALL mengganti `import { getSocket }` dan panggilan `getSocket()` dengan `useSocket()` dari SocketContext.

6. THE `SubAdminLayout` (inisialisasi `useAdminSound`) SHALL mengganti `import { getSocket }` dan panggilan `getSocket()` dengan `useSocket()` dari SocketContext.

7. WHEN `useSocket()` mengembalikan `null`, THE komponen yang memiliki socket listener SHALL melewati pendaftaran listener tanpa error.

---

### Requirement 4: Reconnect Setelah Token Refresh

**User Story:** Sebagai staff admin yang sedang bekerja, saya ingin socket tetap terkoneksi setelah access token di-refresh otomatis agar saya tidak kehilangan update real-time.

#### Acceptance Criteria

1. WHEN `httpClient` berhasil melakukan token refresh dan mendapatkan access token baru, THE SocketProvider SHALL mendeteksi token baru dan memanggil `initSocket(newToken)` untuk membuat koneksi ulang dengan token terbaru.

2. THE SocketProvider SHALL mendengarkan custom DOM event `gala:token-refreshed` yang diemit oleh `httpClient` setelah refresh berhasil, kemudian memanggil `initSocket` dengan token baru tersebut.

3. IF `httpClient` gagal refresh token dan mengemit `gala:session-expired`, THEN THE SocketProvider SHALL memanggil `disconnectSocket()` dan mengatur state socket menjadi null.

4. THE `httpClient` (src/core/httpClient.js) SHALL mengemit custom DOM event `gala:token-refreshed` dengan detail `{ token: newAccessToken }` setelah setiap refresh token berhasil.

---

### Requirement 5: Listener Real-time di ChatsSection

**User Story:** Sebagai admin atau CS, saya ingin daftar percakapan di halaman Chats ter-update secara real-time tanpa perlu refresh manual saat ada pesan baru atau conversation baru.

#### Acceptance Criteria

1. THE `ChatsSection` SHALL mendaftarkan listener untuk event `chat:message` menggunakan `useSocket()`.

2. WHEN event `chat:message` diterima, THE `ChatsSection` SHALL memanggil ulang fungsi fetch conversations untuk memperbarui daftar.

3. THE `ChatsSection` SHALL mendaftarkan listener untuk event `chat:new_conversation` menggunakan `useSocket()`.

4. WHEN event `chat:new_conversation` diterima, THE `ChatsSection` SHALL memanggil ulang fungsi fetch conversations.

5. WHEN komponen `ChatsSection` di-unmount, THE `ChatsSection` SHALL menghapus semua socket listener yang didaftarkannya via cleanup function `useEffect`.

---

### Requirement 6: Listener Real-time di DMSection

**User Story:** Sebagai staff, saya ingin daftar DM (pesan antar staff) ter-update secara real-time saat ada pesan DM baru.

#### Acceptance Criteria

1. THE `DMSection` SHALL mendaftarkan listener untuk event `dm:message` menggunakan `useSocket()`.

2. WHEN event `dm:message` diterima, THE `DMSection` SHALL memanggil ulang fungsi fetch DM conversations untuk memperbarui daftar.

3. WHEN komponen `DMSection` di-unmount, THE `DMSection` SHALL menghapus semua socket listener yang didaftarkannya via cleanup function `useEffect`.

---

### Requirement 7: Listener Real-time di ActivitySidebar

**User Story:** Sebagai admin atau owner, saya ingin sidebar Activity di dashboard ter-update secara real-time saat ada order baru atau perubahan status, tanpa risiko listener terdaftar sebelum socket siap.

#### Acceptance Criteria

1. THE `ActivitySidebar` di `AdminDashboardPage` SHALL menggunakan `useSocket()` untuk mengakses socket, menggantikan `getSocket()`.

2. THE `ActivitySidebar` di `OwnerDashboardPage` SHALL menggunakan `useSocket()` untuk mengakses socket, menggantikan `getSocket()`.

3. WHEN socket instance berubah (dari null ke aktif atau aktif ke null), THE `ActivitySidebar` SHALL mendaftarkan ulang atau menghapus listener secara otomatis melalui dependency array `useEffect`.

4. WHEN event `order:new` diterima, THE `ActivitySidebar` SHALL memanggil fungsi `loadActivity()` untuk memperbarui tampilan.

5. WHEN event `order:status_changed` diterima, THE `ActivitySidebar` SHALL memanggil fungsi `loadActivity()` untuk memperbarui tampilan.

---

### Requirement 8: Konsistensi Cleanup Listener di Semua Section

**User Story:** Sebagai developer, saya ingin semua komponen yang mendaftarkan socket listener selalu membersihkan listener saat unmount agar tidak terjadi memory leak atau event handler yang menumpuk.

#### Acceptance Criteria

1. THE setiap komponen yang mendaftarkan socket listener SHALL mengembalikan cleanup function dari `useEffect` yang memanggil `socket.off(eventName, handler)` untuk setiap listener yang didaftarkan.

2. WHEN socket instance dalam SocketContext berubah, THE komponen dengan socket listener SHALL secara otomatis menghapus listener dari instance lama dan mendaftarkan ulang pada instance baru.

3. THE `useEffect` yang mendaftarkan socket listener SHALL menyertakan `socket` sebagai dependency sehingga React dapat menjalankan cleanup dan re-register secara tepat.

---

### Requirement 9: Fallback Saat Socket Belum Tersedia

**User Story:** Sebagai pengguna yang baru membuka halaman, saya ingin halaman tetap berfungsi dan menampilkan data dari REST API meskipun koneksi socket belum terbentuk.

#### Acceptance Criteria

1. IF `useSocket()` mengembalikan `null`, THEN THE komponen admin SHALL tetap merender konten dan memuat data via REST API tanpa menampilkan error.

2. WHEN socket menjadi tersedia setelah komponen sudah render (misalnya koneksi lambat), THE komponen SHALL mendaftarkan listener secara otomatis melalui `useEffect` dengan `socket` sebagai dependency.

3. THE `useAdminSound` hook SHALL menerima socket instance dari parameter (bukan memanggil `getSocket()` internal), sehingga bisa menerima nilai `null` tanpa error.
