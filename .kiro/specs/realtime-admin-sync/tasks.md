# Implementation Plan: realtime-admin-sync

## Overview

Migrasi arsitektur socket dari pola `getSocket()` per-komponen ke `SocketContext` terpusat. Implementasi dilakukan secara inkremental: mulai dari modifikasi minimal di `httpClient.js`, pembuatan `SocketContext.jsx`, integrasi ke `App.jsx`, kemudian migrasi komponen satu per satu sesuai urutan dependency.

## Tasks

- [ ] 1. Modifikasi `httpClient.js` — emit `gala:token-refreshed`
  - [ ] 1.1 Tambahkan `dispatchEvent` di dalam `performRefresh()` setelah `setAccessToken(newToken)` berhasil
    - Emit `new CustomEvent('gala:token-refreshed', { detail: { token: newAccessToken } })` ke `window`
    - Pastikan emit hanya terjadi jika `newToken` tidak null/undefined
    - Tidak ada perubahan lain pada file ini
    - _Requirements: 4.4_
  - [ ]* 1.2 Tulis property test untuk Property 7
    - **Property 7: httpClient selalu emit gala:token-refreshed setelah refresh berhasil**
    - **Validates: Requirements 4.4**
    - Mock endpoint `/api/auth/refresh` dengan berbagai `accessToken` valid
    - Verifikasi event `gala:token-refreshed` selalu diemit dengan `detail.token` yang sama

- [ ] 2. Buat `src/components/context/SocketContext.jsx`
  - [ ] 2.1 Buat file baru dengan `SocketProvider` dan hook `useSocket`
    - Import `AuthContext` dari `./AuthContext.jsx`
    - Import `initSocket`, `disconnectSocket`, `getSocket` dari `../../core/socket.js`
    - `useState(() => getSocket())` untuk hydrate dari singleton yang sudah ada
    - Efek 1: reaksi terhadap perubahan `user` dan `loading` dari AuthContext — panggil `initSocket(token)` saat user ada, `disconnectSocket()` saat user null
    - Gunakan `import { getAccessToken } from '../../core/httpClient.js'` (bukan require) untuk mengambil token
    - Efek 2: daftarkan listener `gala:token-refreshed` dan `gala:session-expired` di `window`
    - Context value adalah `socket | null` (bukan objek wrapper)
    - `useSocket()` melempar error jika dipanggil di luar `SocketProvider`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_
  - [ ]* 2.2 Tulis property test untuk Property 1
    - **Property 1: Token refresh event selalu memicu reconnect**
    - **Validates: Requirements 4.1, 4.2**
    - Simulasikan dispatch event `gala:token-refreshed` dengan berbagai token string valid
    - Verifikasi `initSocket` dipanggil dengan token tersebut dan state socket diperbarui
  - [ ]* 2.3 Tulis property test untuk Property 2
    - **Property 2: Auth state null selalu memicu disconnect**
    - **Validates: Requirements 1.4, 4.3**
    - Simulasikan transisi `user` dari nilai tidak-null ke `null` (dengan `loading === false`)
    - Verifikasi `disconnectSocket()` selalu dipanggil dan socket state menjadi null
  - [ ]* 2.4 Tulis property test untuk Property 3
    - **Property 3: Tidak lebih dari satu koneksi socket aktif**
    - **Validates: Requirements 1.7**
    - Simulasikan sequence: login → token refresh → logout → login ulang
    - Verifikasi jumlah active socket instance tidak pernah melebihi satu
  - [ ]* 2.5 Tulis property test untuk Property 5
    - **Property 5: useSocket() selalu sinkron dengan SocketContext**
    - **Validates: Requirements 2.1**
    - Verifikasi nilai yang dikembalikan `useSocket()` identik dengan state di SocketContext untuk setiap perubahan state

- [ ] 3. Modifikasi `src/App.jsx` — tambah `SocketProvider` ke provider tree
  - [ ] 3.1 Import `SocketProvider` dan bungkus `CartProvider` di dalamnya
    - `SocketProvider` berada di dalam `AuthProvider` dan di luar `CartProvider`
    - Urutan wajib: `AuthProvider → SocketProvider → CartProvider → BrowserRouter → Routes`
    - Tidak ada perubahan lain pada file ini
    - _Requirements: 1.6_

- [ ] 4. Checkpoint — verifikasi SocketContext berfungsi
  - Pastikan semua tests pass, khususnya bahwa `SocketProvider` terpasang di tree tanpa error.
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan ke migrasi komponen.

- [ ] 5. Migrasi komponen layout — ganti `getSocket()` dengan `useSocket()`
  - [ ] 5.1 Migrasi `AdminDashboardPage.jsx`
    - Hapus `import { getSocket }` dari core/socket
    - Tambah `import { useSocket }` dari SocketContext
    - Panggil `const socket = useSocket()` di level komponen
    - Di `ActivitySidebar` (komponen lokal): ganti `getSocket()` dengan `useSocket()`, tambah `socket` ke dependency array `useEffect`
    - Untuk `useAdminSound`: teruskan `socket` sebagai argumen/prop (sesuai Requirement 9.3)
    - Tambah guard `if (socket)` sebelum `socket.on(...)` dan `socket.off(...)` di ActivitySidebar
    - _Requirements: 3.4, 7.1, 7.3, 7.4, 7.5, 9.3_
  - [ ] 5.2 Migrasi `OwnerDashboardPage.jsx`
    - Hapus `import { getSocket }` dari core/socket
    - Tambah `import { useSocket }` dari SocketContext
    - Di `ActivitySidebar` (komponen lokal): ganti `getSocket()` dengan `useSocket()`, tambah `socket` ke dependency array
    - Tambah guard `if (socket)` sebelum `socket.on(...)` dan `socket.off(...)`
    - _Requirements: 3.5, 7.2, 7.3, 7.4, 7.5_
  - [ ] 5.3 Migrasi `SubAdminLayout.jsx`
    - Hapus `import { getSocket }` dari core/socket
    - Tambah `import { useSocket }` dari SocketContext
    - Panggil `const socket = useSocket()` di level komponen
    - Teruskan `socket` ke `useAdminSound` sebagai argumen/prop
    - _Requirements: 3.6, 9.3_

- [ ] 6. Migrasi section komponen — ganti `getSocket()` dengan `useSocket()`
  - [ ] 6.1 Migrasi `OrdersSection.jsx`
    - Hapus `import { getSocket }` dari core/socket
    - Tambah `import { useSocket }` dari SocketContext
    - Ganti `const socket = getSocket()` di dalam `useEffect` menjadi `const socket = useSocket()` di level komponen
    - Tambah `socket` ke dependency array semua `useEffect` yang mendaftarkan listener
    - Pastikan guard `if (!socket) return;` ada di setiap `useEffect` listener
    - _Requirements: 3.1, 8.1, 8.2, 8.3, 9.1_
  - [ ]* 6.2 Tulis property test untuk Property 4 (OrdersSection)
    - **Property 4: Listener selalu di-cleanup saat socket berubah**
    - **Validates: Requirements 1.8, 8.1, 8.2**
    - Simulasikan perubahan socket instance dan verifikasi listener lama di-off sebelum listener baru didaftarkan
  - [ ] 6.3 Migrasi `SubAdminOrdersSection.jsx`
    - Hapus `import { getSocket }` dari core/socket
    - Tambah `import { useSocket }` dari SocketContext
    - Ganti pemanggilan `getSocket()` di dalam `useEffect` menjadi `useSocket()` di level komponen
    - Tambah `socket` ke dependency array dan pastikan guard null ada
    - _Requirements: 3.2, 8.1, 8.2, 8.3_
  - [ ] 6.4 Migrasi `CashierOrdersSection.jsx`
    - Hapus `import { getSocket }` dari core/socket
    - Tambah `import { useSocket }` dari SocketContext
    - Ganti pemanggilan `getSocket()` di dalam `useEffect` menjadi `useSocket()` di level komponen
    - Tambah `socket` ke dependency array dan pastikan guard null ada
    - _Requirements: 3.3, 8.1, 8.2, 8.3_
  - [ ]* 6.5 Tulis property test untuk Property 9
    - **Property 9: Socket listener terdaftar ulang otomatis saat socket berubah**
    - **Validates: Requirements 7.3, 8.2, 9.2**
    - Simulasikan siklus socket null → instance aktif → instance aktif baru
    - Verifikasi listener otomatis terdaftar tanpa perlu re-mount komponen

- [ ] 7. Tambah listener baru di `ChatsSection.jsx` dan `DMSection.jsx`
  - [ ] 7.1 Tambah listener socket di `ChatsSection.jsx`
    - Tambah `import { useSocket }` dari SocketContext
    - Panggil `const socket = useSocket()` di level komponen
    - Tambah `useEffect` baru (terpisah dari DOM event listeners yang sudah ada):
      - Daftarkan `socket.on('chat:message', handleChatMessage)` dan `socket.on('chat:new_conversation', handleNewConversation)`
      - Setiap handler memanggil `loadConversations()`
      - Return cleanup yang memanggil `socket.off` untuk kedua event
      - Dependency array: `[socket, loadConversations]`
    - Guard `if (!socket) return;` wajib ada di awal efek
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.3_
  - [ ] 7.2 Tambah listener socket di `DMSection.jsx`
    - Tambah `import { useSocket }` dari SocketContext
    - Panggil `const socket = useSocket()` di level komponen
    - Tambah `useEffect` baru:
      - Daftarkan `socket.on('dm:message', handleDMMessage)`
      - Handler memanggil `loadDMConversations()` dan `loadMessages()`
      - Return cleanup yang memanggil `socket.off('dm:message', handleDMMessage)`
      - Dependency array: `[socket, loadDMConversations, loadMessages]`
    - Guard `if (!socket) return;` wajib ada
    - _Requirements: 6.1, 6.2, 6.3, 8.1, 8.3_
  - [ ]* 7.3 Tulis property test untuk Property 8
    - **Property 8: Listener chat dan DM merespons terhadap semua socket events**
    - **Validates: Requirements 5.2, 5.4, 6.2**
    - Simulasikan emisi event `chat:message`, `chat:new_conversation`, `dm:message`
    - Verifikasi `loadConversations` dan `loadDMConversations` selalu dipanggil
  - [ ]* 7.4 Tulis property test untuk Property 6
    - **Property 6: Komponen tidak error saat socket null**
    - **Validates: Requirements 3.7, 9.1**
    - Render komponen-komponen admin dengan `useSocket()` yang mengembalikan null
    - Verifikasi tidak ada exception yang dilempar dan konten tetap terender

- [ ] 8. Checkpoint final — verifikasi semua migrasi selesai
  - Pastikan semua tests pass dan tidak ada `getSocket()` yang tersisa di komponen React.
  - Tanyakan kepada user jika ada pertanyaan sebelum menyelesaikan task.

## Notes

- Tasks bertanda `*` bersifat opsional dan bisa dilewati untuk MVP yang lebih cepat
- Setiap task merujuk ke requirement spesifik untuk traceabilitas
- Jangan hapus `getSocket()` dari `src/core/socket.js` — fungsi itu masih dipakai oleh `SocketContext.jsx` sendiri untuk hydrate saat mount pertama kali
- Pola wajib untuk setiap komponen migrasi: `useSocket()` di level komponen → guard `if (!socket) return;` di dalam `useEffect` → `socket` di dependency array
- DOM event listeners yang sudah ada di `ChatsSection` tidak dihapus — `useSocket()` ditambahkan sebagai lapisan baru yang paralel
- `useAdminSound` perlu dimodifikasi agar menerima `socket` sebagai parameter eksternal (bukan memanggil `getSocket()` secara internal) sesuai Requirement 9.3

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.1"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["6.1", "6.3", "6.4"] },
    { "id": 5, "tasks": ["6.2", "6.5", "7.1", "7.2"] },
    { "id": 6, "tasks": ["7.3", "7.4"] }
  ]
}
```
