# Tasks: Customer Profile Page

## Task List

- [x] 1. Database Migrations
  - [x] 1.1 Create migration 023: add `avatar_url` column to `users` table
  - [x] 1.2 Create migration 024: create `addresses` table with FK to users
  - [x] 1.3 Create migration 025: create `notification_preferences` table with FK to users
  - [x] 1.4 Add `avatars` subdirectory to `StorageService.ensureUploadDirs()` and `SUBDIRS` list in `storage.js`

- [x] 2. Backend — Profile Endpoints
  - [x] 2.1 Create `server/src/services/profile.service.js` with `getProfile(userId)` and `updateProfile(userId, data)` functions
  - [x] 2.2 Create `server/src/controllers/profile.controller.js` with `getProfile` and `updateProfile` handlers
  - [x] 2.3 Add avatar upload multer config (`uploadAvatar`) to `server/src/middleware/upload.js` (JPEG/PNG/WebP/GIF, max 5 MB, dest `uploads/avatars/`)
  - [x] 2.4 Add `uploadAvatar(userId, file)` function to `profile.service.js` using `StorageService.save('avatars')`, delete old avatar file if exists, update `users.avatar_url`
  - [x] 2.5 Add `uploadAvatar` handler to `profile.controller.js`
  - [x] 2.6 Create `server/src/routes/profile.routes.js` with `GET /api/profile`, `PUT /api/profile`, `POST /api/profile/avatar` — all protected by `authenticate`
  - [x] 2.7 Register profile routes in `server/src/app.js` as `app.use('/api/profile', profileRoutes)`
  - [x] 2.8 Update `GET /api/auth/me` response to include `avatar_url` field

- [x] 3. Backend — Address Endpoints
  - [x] 3.1 Create `server/src/services/addresses.service.js` with `listAddresses(userId)`, `createAddress(userId, data)`, `updateAddress(userId, addressId, data)`, `deleteAddress(userId, addressId)` — enforce ownership and 10-address limit
  - [x] 3.2 Create `server/src/controllers/addresses.controller.js` with handlers for list, create, update, delete
  - [x] 3.3 Create `server/src/routes/addresses.routes.js` with `GET /api/addresses`, `POST /api/addresses`, `PUT /api/addresses/:id`, `DELETE /api/addresses/:id` — all protected by `authenticate`
  - [x] 3.4 Register address routes in `server/src/app.js` as `app.use('/api/addresses', addressRoutes)`

- [x] 4. Backend — Notification Preferences Endpoints
  - [x] 4.1 Create `server/src/services/notifications.service.js` with `getPreferences(userId)` (returns defaults if row doesn't exist) and `updatePreferences(userId, prefs)`
  - [x] 4.2 Create `server/src/controllers/notifications.controller.js` with `getPreferences` and `updatePreferences` handlers
  - [x] 4.3 Add notification preference routes to `server/src/routes/profile.routes.js`: `GET /api/profile/notifications` and `PUT /api/profile/notifications`

- [x] 5. Backend — Email Service
  - [x] 5.1 Add `resend` package to `server/package.json` dependencies
  - [x] 5.2 Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to `server/src/config/env.js` (optional — skip email if not set, log warning)
  - [x] 5.3 Create `server/src/services/email.service.js` with `sendOrderNotification(order, notifType)` function using Resend SDK, wrapped in try-catch (fire-and-forget)
  - [x] 5.4 Add `sendPromoNotification(promoData)` function to `email.service.js` for promo announcements
  - [x] 5.5 Integrate `email.service.js` into `orders.service.updateOrderStatus()`: after successful status update, check customer's notification preferences and call `sendOrderNotification` if preference is enabled

- [x] 6. Frontend — Profile Service & Address Service
  - [x] 6.1 Create `src/services/profileService.js` with `getProfile()`, `updateProfile(data)`, `uploadAvatar(formData)`, `getNotificationPreferences()`, `updateNotificationPreferences(prefs)`
  - [x] 6.2 Create `src/services/addressService.js` with `getAddresses()`, `createAddress(data)`, `updateAddress(id, data)`, `deleteAddress(id)`

- [x] 7. Frontend — ProfilePage and ProfileForm
  - [x] 7.1 Create `src/components/profile/ProfileForm.jsx` — displays name, dob, gender, email (read-only), phone in view mode; switches to edit mode on button click; validates name (non-empty) and phone (8–15 digits); calls `profileService.updateProfile()` on save; shows success toast on success
  - [x] 7.2 Create `src/components/pages/public/ProfilePage.jsx` — route guard (redirect to `/register` if not logged in or role !== 'customer'); renders three sections: Biodata Diri (ProfileForm), Daftar Alamat (AddressList), Notifikasi (NotificationSettings)
  - [x] 7.3 Add `/profile` route to `src/App.jsx` inside the `PublicLayout` route group

- [x] 8. Frontend — ImageCropper
  - [x] 8.1 Add `react-easy-crop` to frontend `package.json` dependencies
  - [x] 8.2 Create `src/components/profile/ImageCropper.jsx` — modal that opens on avatar click; accepts file input (JPEG/PNG/WebP/GIF, max 5 MB); shows preview with zoom/pan controls using `react-easy-crop`; on confirm, generates cropped canvas blob and calls `profileService.uploadAvatar()`; updates `AuthContext` user with new `avatar_url` on success
  - [x] 8.3 Integrate `ImageCropper` into `ProfileForm` — clicking avatar area or "Ganti Foto" button opens the cropper

- [x] 9. Frontend — AddressList and AddressForm
  - [x] 9.1 Create `src/components/profile/AddressForm.jsx` — modal form with fields: judul, nama, nomor telepon, alamat lengkap; validates all required fields; calls `addressService.createAddress()` or `addressService.updateAddress()` depending on mode
  - [x] 9.2 Create `src/components/profile/AddressList.jsx` — renders list of addresses; "Tambah Alamat" button (disabled + message when 10 addresses reached); edit button opens AddressForm in edit mode; delete button shows confirmation dialog, then calls `addressService.deleteAddress()`

- [x] 10. Frontend — NotificationSettings
  - [x] 10.1 Create `src/components/profile/NotificationSettings.jsx` — renders five checkboxes (Pembayaran Diterima, Pesanan Dikirim, Pesanan Selesai, Pesanan Dibatalkan, Berita Promo); loads preferences from `profileService.getNotificationPreferences()` on mount; "Simpan" button calls `profileService.updateNotificationPreferences()`; shows success toast on success

- [x] 11. Frontend — Navbar Avatar Integration
  - [x] 11.1 Update `src/components/shared/Navbar.jsx` — for logged-in customers: show `avatar_url` as circular `<img>` if set, otherwise show default SVG icon; clicking the avatar/icon navigates to `/profile`; add "Profil Saya" link in the customer nav section

- [x] 12. Frontend — Checkout AddressSelector
  - [x] 12.1 Create `src/components/shared/AddressSelector.jsx` — dropdown or modal that fetches saved addresses from `addressService.getAddresses()`; on selection, populates parent form fields (name, phone, address) via callback prop; only rendered when customer has at least one saved address
  - [x] 12.2 Integrate `AddressSelector` into `src/components/pages/public/CheckoutPage.jsx` — show AddressSelector above the manual form fields when customer is logged in and has saved addresses; pre-fill form fields on selection; manual editing remains possible after selection

- [x] 13. Property-Based Tests
  - [x] 13.1 Write property test for Property 1 (non-customer role redirect) in `src/test/profileAccess.property.test.js`
  - [x] 13.2 Write property test for Property 2 (profile update round-trip) in `server/src/tests/profileUpdate.property.test.js`
  - [x] 13.3 Write property test for Property 3 (phone validation rejects invalid inputs) in `server/src/tests/profileValidation.property.test.js`
  - [x] 13.4 Write property test for Property 4 (non-image MIME type rejection) in `server/src/tests/avatarUpload.property.test.js`
  - [x] 13.5 Write property test for Property 5 (avatar upload persists URL) in `server/src/tests/avatarUpload.property.test.js`
  - [x] 13.6 Write property test for Property 6 (address list renders all saved addresses) in `src/test/addressList.property.test.js`
  - [x] 13.7 Write property test for Property 7 (address creation round-trip) in `server/src/tests/addresses.property.test.js`
  - [x] 13.8 Write property test for Property 8 (address deletion removes entry) in `server/src/tests/addresses.property.test.js`
  - [x] 13.9 Write property test for Property 9 (address selector populates form fields) in `src/test/addressSelector.property.test.js`
  - [x] 13.10 Write property test for Property 10 (notification preferences round-trip) in `server/src/tests/notificationPrefs.property.test.js`
  - [x] 13.11 Write property test for Property 11 (email sent iff preference enabled) in `server/src/tests/emailNotification.property.test.js`
  - [x] 13.12 Write property test for Property 12 (unauthenticated requests return 401) in `server/src/tests/profileAuth.property.test.js`
  - [x] 13.13 Write property test for Property 13 (cross-customer access returns 403) in `server/src/tests/profileAuth.property.test.js`
