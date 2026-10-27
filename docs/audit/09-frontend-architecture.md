# 09 — ARSITEKTUR FRONTEND

## Ringkasan

Frontend adalah SPA React 19 dengan Vite 6, routing client-side, code-splitting, manajemen state berbasis Context, dan komunikasi API via Axios. Token access disimpan in-memory, refresh pakai cookie httpOnly dengan mekanisme mutex.

## Struktur

```
src/
├── App.jsx, main.jsx
├── components/
│   ├── charts/Chart.jsx
│   ├── context/{AuthContext,CartContext,SocketContext,ActivityTrackerProvider}.jsx
│   ├── guards/RoleGuard.jsx
│   ├── layout/PublicLayout.jsx
│   ├── modals/{CashierPaymentModal,EditOrderModal,OrderDetailModal,PaymentModal,StaffProfileModal,ThermalReceiptModal,ThermalSPKModal}.jsx
│   ├── pages/{public,admin,owner,staff,subadmin,offline,shared,NotFoundPage}.jsx
│   ├── shared/
│   ├── staff/
│   └── ui/{AddressSelector,ChatAvatar,ChatWidget,ConfirmDialog,DropZone,EmojiPickerButton,ExportDataCards,LanguageSwitcher,LoadingSpinner,Modal,PaginationBar,ProductCard,Toast}.jsx
├── config/{roles,permissions}.js
├── core/{httpClient,config,socket,storage}.js
├── hooks/{useAdminSound,useLogUnreadBadge,useOrderList}.js
├── i18n/{index.js, locales/{id,en,bal}/translation.json}
├── services/ (13 + api/*)
├── styles/ (base, components, layout, pages)
└── test/ (16 file)
```

## Provider Tree

`App.jsx`:

```jsx
<AuthProvider>
  <SocketProvider>
    <CartProvider>
      <CartWarningBanner />
      <Toast />
      <BrowserRouter>
        <AuthNavigationHandler />
        <ActivityTrackerProvider />
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>...</Routes>
        </Suspense>
      </BrowserRouter>
    </CartProvider>
  </SocketProvider>
</AuthProvider>
```

- `AuthProvider` menjalankan hydrate user saat mount.
- `SocketProvider` bisa memanfaatkan konteks auth untuk init socket.
- `ActivityTrackerProvider` melacak aktivitas (digunakan activity log).
- `AuthNavigationHandler` merespons event `gala:session-expired` dan `gala:must-change-password`.

## Routing

### Publik (`PublicLayout`)
Semua lewat `PublicLayout` (Navbar + Footer + ChatWidget).

| Path | Halaman |
|---|---|
| `/` | HomePage |
| `/products` | ProductsPage |
| `/products/:id` | CatalogProductPage |
| `/cart` | CartPage |
| `/checkout` | CheckoutPage |
| `/register` | RegisterPage |
| `/status` | StatusOrderPage |
| `/my-orders` | MyOrdersPage |
| `/cara-order` | CaraOrderPage |
| `/custom-order` | CustomOrderPage |
| `/portfolio` | PortfolioPage |
| `/tentang-kami` | TentangKamiPage |
| `/profile` | ProfilePage |
| `/verify-email` | VerifyEmailPage |
| `/forgot-password` | ForgotPasswordPage |
| `/reset-password` | ResetPasswordPage |
| `/change-password` | ChangePasswordPage |

### Staff (tanpa shell publik)

| Path | Guard | Halaman |
|---|---|---|
| `/admin/login` | — | AdminLoginPage |
| `/admin/forgot-password` | — | StaffForgotPasswordPage |
| `/admin/reset-password` | — | StaffResetPasswordPage |
| `/admin/change-password` | — | StaffChangePasswordPage |
| `/admin/superadmin` | RoleGuard(admin) | AdminDashboardPage |
| `/admin/owner` | RoleGuard(owner) | OwnerDashboardPage |
| `/admin/owner/admin-management` | RoleGuard(owner) | AdminManagementPage |
| `/admin/cashier` | RoleGuard(cashier) | CashierDashboardPage |
| `/admin/cs` | RoleGuard(cs) | CSDashboardPage |
| `/admin/operational` | RoleGuard(operational) | OperationalDashboardPage |
| `/admin/qc` | RoleGuard(qc) | QCDashboardPage |
| `/admin/offline` | RoleGuard(offline) | OfflineDashboardPage |

Semua halaman dashboard di-**lazy-load**. RoleGuard merender `NotFoundPage` bila tidak berhak (hanya UX).

## HTTP Client

`src/core/httpClient.js`:

### Konfigurasi
- `USE_BACKEND`: `VITE_USE_BACKEND === 'true'` jika diset, else `import.meta.env.PROD` → default `true` di produksi.
- `API_BASE`: `VITE_API_URL || ''` → same-origin default.
- Axios instance `api` dengan `withCredentials: true`.

### Token
- `_accessToken` in-memory via `setAccessToken/getAccessToken/clearSession`.
- Request interceptor menambahkan `Authorization: Bearer`.
- `clearSession()` dispatch `gala:session-expired`.

### Refresh dengan Mutex
Dua mekanisme ada bersamaan:
1. `performRefresh()` — single promise untuk mencegah race condition refresh.
2. Interceptor response 401 — queue pending request saat refresh.

Alur:
- Request 401 (bukan `/api/auth/refresh`) dengan token ada → masuk queue jika `isRefreshing`, else set `isRefreshing=true`, panggil `performRefresh()`.
- `performRefresh()` POST `/api/auth/refresh` dengan cookie, simpan token baru, dispatch `gala:token-refreshed`, return token.
- Flush queue dengan token baru atau reject semua bila gagal → `clearSession()`.
- Khusus 403 dengan `mustChangePassword: true` → dispatch `gala:must-change-password`.

Keunggulan: mencegah deteksi reuse saat multi-request bersamaan.

## Socket Client

`src/core/socket.js`:
- Singleton `_socket`.
- `initSocket(accessToken)`: disconnect socket lama, buat baru ke `API_BASE || origin`, auth `{ token: accessToken }`, transports websocket+polling, reconnection 5x.
- `getSocket()`, `disconnectSocket()`.
- Event log connect/disconnect/error.

## State Management

| Context | Fungsi |
|---|---|
| `AuthContext` | user, loading, updateUser; hydrate via `getCurrentUser()`; navigation handler untuk session-expired/must-change-password |
| `CartContext` | keranjang, warning banner, sinkronisasi |
| `SocketContext` | manajemen koneksi socket per user |
| `ActivityTrackerProvider` | pelacakan aktivitas untuk activity log |

## Service Layer

Terdapat 13 file di `src/services/`:

| Service | Fungsi |
|---|---|
| `accounts.js` | manajemen akun |
| `activityLog.js` | activity log |
| `addressService.js` | alamat |
| `adminManagement.js` | manajemen staff |
| `analyticsService.js` | analitik |
| `auth.js` | auth |
| `cartService.js` | keranjang |
| `categories.js` | kategori |
| `chatService.js` | chat |
| `orders.js` | order (40513 bytes — sangat besar) |
| `products.js` | produk |
| `profileService.js` | profil |
| `reviews.js` | review |

Ditambah `api/homepageService.js`, `api/invoiceService.js`.

**Masalah:** banyak komponen memanggil `api` langsung, bukan lewat service. Contoh yang teridentifikasi:
- `OrderDetailModal.jsx:33` (blob)
- `ExportDataCards.jsx` (upload/database/all)
- `CategoriesSection.jsx:32,149`
- `DMSection.jsx:288,313`
- `HomepageSection.jsx:37`
- `PromoSection.jsx:20..40`
- `CheckoutPage.jsx:192` (validasi promo)
- `CustomOrderPage.jsx:114,126` (upload desain, order custom)
- `StatusOrderPage.jsx:104`
- `DailyRevenueSection.jsx:82,111`

Akibatnya kontrak API tidak terpusat, duplikasi error handling, sulit mocking/test.

## Komponen UI

### UI Umum (`components/ui/`)
`AddressSelector`, `ChatAvatar`, `ChatWidget`, `ConfirmDialog`, `DropZone`, `EmojiPickerButton`, `ExportDataCards`, `LanguageSwitcher`, `LoadingSpinner`, `Modal`, `PaginationBar`, `ProductCard`, `Toast`.

### Modal Operasional (`components/modals/`)
`CashierPaymentModal` (DP/lunas), `EditOrderModal`, `OrderDetailModal` (besar), `PaymentModal`, `StaffProfileModal`, `ThermalReceiptModal`, `ThermalSPKModal`.

### Layout
`PublicLayout.jsx` membungkus halaman publik.

## Halaman per Role

| Area | Halaman/Section |
|---|---|
| Publik | Home, Products, Catalog, Cart, Checkout, Status, MyOrders, CaraOrder, CustomOrder, Portfolio, TentangKami, Profile, auth pages |
| Admin Superadmin | `AdminDashboardPage.jsx` |
| Owner | `OwnerDashboardPage`, `AdminManagementPage`, sections Accounts, AdminAccountsList, Analytics, FeaturePermission, Reports, Revenue |
| Cashier/CS/Operational/QC | `CashierDashboardPage`, `CSDashboardPage`, `OperationalDashboardPage`, `QCDashboardPage` |
| Offline | `OfflineDashboardPage` |
| Staff umum | `pages/staff/*` |
| Shared | `pages/shared/ActivityLogSection` |

Section terbesar: `OfflineOrderSection.jsx` (1345 baris), `HomepageSection.jsx` (840), `RevenueSection.jsx` (808), `ProductsSection.jsx` (793), `DMSection.jsx` (596).

## Styling

Struktur CSS:
```
src/styles/
├── main.css
├── base/{reset,typography,variables}.css
├── components/{buttons,cards,chatWidget,forms,modal,shared,toast}.css
├── layout/{footer,grid,navbar}.css
└── pages/*.css
```

File besar:
- `src/styles/css/pages/dashboard.css` — **4496 baris**
- `checkout.css` — 895
- `navbar.css` — 813
- `home.css` — 705
- `statusOrder.css` — 646
- `daily-revenue.css` — 420

Pendekatan: CSS global + per-page, variabel CSS di `variables.css`. Tidak ada CSS modules, Tailwind, atau styled-components.

## Internasionalisasi

- `src/i18n/index.js`: react-i18next + i18next-browser-languagedetector
- Bahasa: `id` (default), `en`, `bal` (Bali)
- `localStorage` key `galaprintLang`
- `supportedLngs: ['id','en','bal']`
- `fallbackLng: 'id'`
- `html lang` dimapping `{id:'id', en:'en', bal:'ban'}` di `App.jsx`
- Terjemahan: `id/en/bal` masing-masing ~12–12.6 KB JSON

## Konfigurasi Role & Permission Frontend

`src/config/roles.js` menduplikasi `STAFF_ROLES` backend. `src/config/permissions.js` mendefinisikan daftar permission dengan `roles[]` per permission, `PERM_TO_NAV` untuk mapping nav, dan `filterNavByPermissions()` dengan 3 state (null/undefined = semua, [] = kosong, array = filter).

Logika filtering:
- `null`/`undefined` → backward compatible, tampilkan semua
- `[]` → kosongkan
- array isi → hanya item yang permission-nya ada

Ini cocok dengan model “owner atur permission untuk promoted admin”, tetapi tidak menegakkan akses server.

## Build & Optimasi

`vite.config.js`:
- proxy `/api` ke `backendTarget = VITE_API_URL || http://localhost:3001`
- plugin compression
- code-splitting via dynamic import untuk halaman

`npm run build` root:
```json
"build": "vite build && cd server && npm install --omit=dev"
```

Hasil build masuk `dist/` dan **di-commit** (171 file). Frontend bisa langsung disajikan Express.

## Aset

- Chunk besar: `AdminDashboardPage`, `OwnerDashboardPage`, `OfflineDashboardPage`, `orders` service (40KB)
- Gambar/statik di `public/` dan `dist/assets/`
- Sound assets `[TIDAK TERVERIFIKASI]` via `generate-sounds.mjs`

## Temuan Frontend

| # | Temuan | Severity |
|---|---|---|
| F1 | Panggilan `api` langsung dari banyak komponen | **Sedang** |
| F2 | Service `orders.js` sangat besar (40KB) | **Sedang** |
| F3 | `dashboard.css` 4496 baris | **Sedang** |
| F4 | RoleGuard single-role, render 404 (UX only) | **Rendah–Sedang** |
| F5 | `USE_BACKEND` default ke true di prod tapi bisa membingungkan dev | **Rendah** |
| F6 | Token in-memory + refresh mutex — baik, tetapi reload tab butuh refresh | **Rendah** |
| F7 | Duplikasi role/permission frontend–backend | **Sedang** |
| F8 | `dist/` tracked di git | **Sedang** |
| F9 | Komponen besar monolit | **Sedang** |

## Rekomendasi

- Pindahkan semua panggilan API ke layer service.
- Pecah `orders.js` service dan `dashboard.css`.
- Jadikan RoleGuard mendukung multi-role atau hierarki.
- Pertimbangkan CSS modules/Tailwind untuk mengurangi spesifisitas.
- Hapus `dist/` dari tracking.
- Tambahkan error boundary.
- Gunakan React Query/SWR untuk caching `[REKOMENDASI, bukan ada sekarang]`.

BERSAMBUNG ke `10-realtime-chat-notifications.md`
