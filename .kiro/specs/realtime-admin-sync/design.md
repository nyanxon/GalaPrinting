# Design Document: realtime-admin-sync

## Overview

Fitur ini memperkenalkan `SocketContext` — sebuah React Context terpusat yang mengambil alih seluruh tanggung jawab lifecycle koneksi Socket.io dari masing-masing komponen. Komponen-komponen admin tidak lagi memanggil `getSocket()` secara langsung; sebaliknya, mereka mengonsumsi `useSocket()` yang selalu mengembalikan instance yang dikelola oleh `SocketProvider`.

Arsitektur ini menghilangkan race condition timing (socket belum siap saat komponen mount), mencegah koneksi duplikat, dan menjamin cleanup listener yang konsisten.

---

## Arsitektur

### Provider Tree (setelah migrasi)

```
AuthProvider
  └── SocketProvider          ← BARU: mengelola lifecycle socket
        └── CartProvider
              └── BrowserRouter
                    └── Routes
                          └── ... halaman admin
```

`SocketProvider` berada di **dalam** `AuthProvider` (sehingga bisa membaca `user` dan `loading`) dan di **luar** `CartProvider` (sehingga semua halaman, termasuk yang membutuhkan cart, bisa mengakses socket).

### Alur Lifecycle Socket

```
AuthContext.user != null && loading == false
  → SocketProvider memanggil initSocket(accessToken)
  → Menyimpan instance ke state [socket, setSocket]
  → Semua komponen yang useSocket() langsung dapat instance baru

AuthContext.user == null && loading == false
  → SocketProvider memanggil disconnectSocket()
  → setSocket(null)

window event "gala:token-refreshed" { detail: { token } }
  → SocketProvider memanggil initSocket(newToken)
  → setSocket(newSocket)

window event "gala:session-expired"
  → SocketProvider memanggil disconnectSocket()
  → setSocket(null)
```

---

## Komponen dan File

### 1. `src/components/context/SocketContext.jsx` (File Baru)

Satu-satunya file yang berinteraksi dengan `initSocket` / `disconnectSocket` dari `src/core/socket.js`. Semua komponen lain hanya mengonsumsi melalui `useSocket()`.

```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useContext as useAuthCtx } from 'react';
import { AuthContext } from './AuthContext.jsx';
import { initSocket, disconnectSocket, getSocket } from '../../core/socket.js';

const SocketContext = createContext(undefined);

export function SocketProvider({ children }) {
  const { user, loading } = useContext(AuthContext);
  const [socket, setSocket] = useState(() => getSocket()); // Hydrate dari singleton jika sudah ada

  // Efek 1: Reaksi terhadap perubahan auth state
  useEffect(() => {
    if (loading) return; // Tunggu AuthContext selesai hydrate

    if (user) {
      // Ambil accessToken dari modul httpClient (in-memory)
      const { getAccessToken } = require('../../core/httpClient.js');
      const token = getAccessToken();
      if (token) {
        const newSocket = initSocket(token);
        setSocket(newSocket);
      }
    } else {
      disconnectSocket();
      setSocket(null);
    }
  }, [user, loading]);

  // Efek 2: Reconnect setelah token refresh
  useEffect(() => {
    function handleTokenRefreshed(e) {
      const newToken = e.detail?.token;
      if (!newToken) return;
      const newSocket = initSocket(newToken);
      setSocket(newSocket);
    }

    function handleSessionExpired() {
      disconnectSocket();
      setSocket(null);
    }

    window.addEventListener('gala:token-refreshed', handleTokenRefreshed);
    window.addEventListener('gala:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('gala:token-refreshed', handleTokenRefreshed);
      window.removeEventListener('gala:session-expired', handleSessionExpired);
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (ctx === undefined) {
    throw new Error('useSocket() harus digunakan di dalam <SocketProvider>');
  }
  return ctx; // null jika belum terkoneksi, Socket instance jika sudah
}
```

**Catatan implementasi:**
- `getSocket()` dipakai saat inisialisasi state untuk mendukung kasus di mana `initSocket()` sudah dipanggil sebelum `SocketProvider` mount (misalnya selama proses hydrate cepat).
- `getAccessToken()` diimpor dari `httpClient.js` — tidak disimpan di AuthContext untuk menghindari circular dependency.
- Context value adalah `socket | null`, bukan objek wrapper, sehingga consumers tidak perlu destructuring.

---

### 2. `src/core/httpClient.js` (Modifikasi)

Menambahkan satu baris `dispatchEvent` setelah refresh token berhasil di dalam fungsi `performRefresh()`:

```js
export function performRefresh() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = axios
    .post('/api/auth/refresh', {}, { withCredentials: true })
    .then((res) => {
      const newToken = res.data.accessToken;
      if (!newToken) throw new Error('No token in refresh response');
      setAccessToken(newToken);

      // ← TAMBAHAN: beritahu SocketProvider untuk reconnect dengan token baru
      window.dispatchEvent(new CustomEvent('gala:token-refreshed', { detail: { token: newToken } }));

      return newToken;
    })
    // ... sisa kode tidak berubah
}
```

---

### 3. `src/App.jsx` (Modifikasi)

Import `SocketProvider` dan tambahkan ke provider tree:

```jsx
import { SocketProvider } from './components/context/SocketContext.jsx';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>          {/* ← TAMBAHAN */}
        <CartProvider>
          {/* ... sisa tidak berubah */}
        </CartProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
```

---

### 4. Pola Migrasi Komponen (Requirement 3)

Setiap komponen yang sebelumnya memanggil `getSocket()` dimigrasi menggunakan pola berikut:

**Sebelum (pola lama):**
```jsx
import { getSocket } from '../../../../core/socket.js';

useEffect(() => {
  const socket = getSocket();   // ← bisa null, tidak reaktif
  if (!socket) return;
  socket.on('order:new', handler);
  return () => socket.off('order:new', handler);
}, [fetchOrders]); // ← socket tidak ada di dependency array!
```

**Sesudah (pola baru):**
```jsx
import { useSocket } from '../../../context/SocketContext.jsx';

const socket = useSocket();  // ← reaktif, dari SocketContext

useEffect(() => {
  if (!socket) return;       // ← guard null tetap diperlukan
  socket.on('order:new', handler);
  return () => socket.off('order:new', handler);
}, [socket, handler]);       // ← socket ada di dependency array
```

Pola ini menjamin:
1. Listener terdaftar ulang otomatis saat socket berubah (mis. setelah token refresh).
2. Listener dibersihkan dari instance **lama** sebelum mendaftar ke instance **baru**.
3. Rendering tidak error meski socket masih null.

---

### 5. File-file yang Dimigrasi

| File | Perubahan |
|------|-----------|
| `AdminDashboardPage.jsx` | `getSocket()` → `useSocket()` untuk `useAdminSound` dan `ActivitySidebar` |
| `OwnerDashboardPage.jsx` | `getSocket()` → `useSocket()` untuk `ActivitySidebar` |
| `SubAdminLayout.jsx` | `getSocket()` → `useSocket()` untuk `useAdminSound` |
| `OrdersSection.jsx` | `getSocket()` → `useSocket()` di dalam komponen |
| `SubAdminOrdersSection.jsx` | `getSocket()` → `useSocket()` di dalam komponen |
| `CashierOrdersSection.jsx` | `getSocket()` → `useSocket()` di dalam komponen |
| `ChatsSection.jsx` | Tambah listener `chat:message` dan `chat:new_conversation` via `useSocket()` |
| `DMSection.jsx` | Tambah listener `dm:message` via `useSocket()` |

---

### 6. `ChatsSection.jsx` — Tambahan Listener Socket (Requirement 5)

Menambahkan `useEffect` baru di `ChatsSection` untuk mendengarkan socket events secara langsung:

```jsx
import { useSocket } from '../../../context/SocketContext.jsx';

export default function ChatsSection() {
  // ...existing state...
  const socket = useSocket();

  // Existing: DOM event listeners (tetap ada untuk backward compatibility)
  useEffect(() => {
    // ...existing window event listeners...
  }, [loadConversations, loadMessages]);

  // TAMBAHAN: Socket.io listeners via SocketContext
  useEffect(() => {
    if (!socket) return;

    function handleChatMessage() {
      loadConversations();
    }

    function handleNewConversation() {
      loadConversations();
    }

    socket.on('chat:message', handleChatMessage);
    socket.on('chat:new_conversation', handleNewConversation);

    return () => {
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:new_conversation', handleNewConversation);
    };
  }, [socket, loadConversations]);

  // ...rest of component
}
```

---

### 7. `DMSection.jsx` — Tambahan Listener Socket (Requirement 6)

```jsx
import { useSocket } from '../../../context/SocketContext.jsx';

export default function DMSection() {
  // ...existing state...
  const socket = useSocket();

  // TAMBAHAN: Socket.io listener dm:message
  useEffect(() => {
    if (!socket) return;

    function handleDMMessage() {
      loadDMConversations();
      loadMessages();
    }

    socket.on('dm:message', handleDMMessage);

    return () => {
      socket.off('dm:message', handleDMMessage);
    };
  }, [socket, loadDMConversations, loadMessages]);

  // ...rest of component
}
```

---

### 8. `ActivitySidebar` — Migrasi Socket (Requirement 7)

`ActivitySidebar` adalah komponen lokal di dalam `AdminDashboardPage.jsx` dan `OwnerDashboardPage.jsx`. Keduanya perlu menerima `socket` sebagai prop, atau `ActivitySidebar` menggunakan `useSocket()` langsung.

Karena `ActivitySidebar` adalah komponen lokal (defined di file yang sama), ia dapat menggunakan `useSocket()` secara langsung:

```jsx
function ActivitySidebar({ onGoToOrders, onGoToChats }) {
  const socket = useSocket();  // ← BARU: bukan getSocket()

  // ...existing state dan loadActivity...

  useEffect(() => {
    loadActivity();

    function handleOrdersUpdate() { loadActivity(); }
    // ...existing DOM event listeners...

    // Socket listeners — reaktif terhadap perubahan socket instance
    if (socket) {
      socket.on('order:new', handleOrdersUpdate);
      socket.on('order:status_changed', handleOrdersUpdate);
    }

    return () => {
      // ...cleanup DOM listeners...
      if (socket) {
        socket.off('order:new', handleOrdersUpdate);
        socket.off('order:status_changed', handleOrdersUpdate);
      }
    };
  }, [socket]); // ← socket di dependency array

  // ...rest of component
}
```

---

## Model Data

Tidak ada model data baru. Fitur ini adalah refactor arsitektur, bukan penambahan data.

**State yang dikelola SocketProvider:**
```typescript
// Tipe value yang tersimpan di SocketContext
type SocketContextValue = import('socket.io-client').Socket | null;
```

**Custom DOM Events:**
```typescript
// Diemit oleh httpClient.js setelah refresh berhasil
interface TokenRefreshedEvent extends CustomEvent {
  detail: { token: string };
}

// Sudah ada — diemit oleh httpClient.js saat session habis
interface SessionExpiredEvent extends CustomEvent {
  // tidak ada detail
}
```

---

## Interface Antar Komponen

### `SocketContext.jsx` → semua komponen consumer

```
SocketProvider
  ├─ membaca: AuthContext { user, loading }
  ├─ membaca: getAccessToken() dari httpClient
  ├─ memanggil: initSocket(token) dari core/socket.js
  ├─ memanggil: disconnectSocket() dari core/socket.js
  └─ menyediakan via context: socket instance | null

useSocket()
  └─ mengembalikan: Socket | null
```

### `httpClient.js` → `SocketProvider`

```
performRefresh() berhasil
  → dispatchEvent("gala:token-refreshed", { token })
  → SocketProvider mendengar → initSocket(newToken)

clearSession()
  → dispatchEvent("gala:session-expired")
  → SocketProvider mendengar → disconnectSocket() + setSocket(null)
```

---

## Penanganan Error dan Fallback

### Socket null saat render

Semua komponen yang menggunakan `useSocket()` harus memiliki guard `if (!socket) return;` di dalam `useEffect` listener. Komponen tetap merender dan memuat data via REST API tanpa error.

```jsx
const socket = useSocket(); // bisa null

useEffect(() => {
  if (!socket) return; // ← guard wajib ada
  socket.on('order:new', handler);
  return () => socket.off('order:new', handler);
}, [socket, handler]);
```

### Token tidak tersedia saat user login

Jika `getAccessToken()` mengembalikan null saat `user` tidak null (edge case saat race condition), `SocketProvider` tidak memanggil `initSocket`. Socket akan dibuat saat event `gala:token-refreshed` tiba.

### `useSocket()` di luar SocketProvider

Melempar `Error('useSocket() harus digunakan di dalam <SocketProvider>')`. Ini adalah fail-fast behavior yang membantu debugging selama development.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token refresh event selalu memicu reconnect

*Untuk setiap* custom DOM event `gala:token-refreshed` yang diemit dengan detail `{ token: string }`, `SocketProvider` harus memanggil `initSocket` dengan token tersebut dan memperbarui socket state.

**Validates: Requirements 4.1, 4.2**

---

### Property 2: Auth state null selalu memicu disconnect

*Untuk setiap* transisi `user` dari nilai tidak-null ke `null` di dalam `AuthContext` (dengan `loading === false`), `SocketProvider` harus memanggil `disconnectSocket()` dan socket state menjadi `null`.

**Validates: Requirements 1.4, 4.3**

---

### Property 3: Tidak lebih dari satu koneksi socket aktif

*Untuk setiap* sequence perubahan auth state (login → token refresh → logout → login ulang), jumlah socket instance yang aktif secara bersamaan tidak boleh melebihi satu. Setiap panggilan `initSocket` harus mendisconnect socket sebelumnya sebelum membuat yang baru.

**Validates: Requirements 1.7**

---

### Property 4: Listener selalu di-cleanup saat socket berubah

*Untuk setiap* pasangan (komponen, socket instance), ketika socket instance berubah (baik menjadi null maupun instance baru), semua listener yang didaftarkan komponen tersebut pada instance lama harus di-`off` sebelum listener baru didaftarkan pada instance baru.

**Validates: Requirements 1.8, 8.1, 8.2**

---

### Property 5: useSocket() selalu sinkron dengan SocketContext

*Untuk setiap* state SocketContext (null atau socket aktif), nilai yang dikembalikan `useSocket()` dalam komponen mana pun di dalam provider tree harus identik dengan nilai yang disimpan di dalam context — tidak pernah stale atau berbeda.

**Validates: Requirements 2.1**

---

### Property 6: Komponen tidak error saat socket null

*Untuk setiap* komponen admin yang menggunakan `useSocket()`, ketika hook mengembalikan `null`, komponen harus berhasil merender dan memuat data via REST API tanpa melempar exception atau menampilkan error state kepada pengguna.

**Validates: Requirements 3.7, 9.1**

---

### Property 7: httpClient selalu emit gala:token-refreshed setelah refresh berhasil

*Untuk setiap* respons sukses dari endpoint `/api/auth/refresh` yang mengandung `accessToken`, fungsi `performRefresh()` harus mengemit DOM event `gala:token-refreshed` dengan `detail.token` yang sama dengan `accessToken` yang diterima.

**Validates: Requirements 4.4**

---

### Property 8: Listener chat dan DM merespons terhadap semua socket events

*Untuk setiap* socket event `chat:message` atau `chat:new_conversation` yang diterima saat `ChatsSection` ter-mount, fungsi `loadConversations` harus dipanggil. Demikian pula, *untuk setiap* socket event `dm:message` yang diterima saat `DMSection` ter-mount, fungsi `loadDMConversations` harus dipanggil.

**Validates: Requirements 5.2, 5.4, 6.2**

---

### Property 9: Socket listener terdaftar ulang otomatis saat socket berubah

*Untuk setiap* komponen dengan socket listener dan *untuk setiap* perubahan socket dari `null` ke instance aktif, listener harus terdaftar secara otomatis tanpa intervensi manual (tanpa perlu re-mount komponen atau navigasi ulang).

**Validates: Requirements 7.3, 8.2, 9.2**
