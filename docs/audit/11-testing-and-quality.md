# 11 — PENGUJIAN & KUALITAS

## Ringkasan

Proyek memiliki **investasi testing yang signifikan**: 37 test file di backend, 24 di frontend (termasuk setup). Mayoritas berbasis **property-based testing** dengan `fast-check`. Terdapat juga unit test dan beberapa integration-style test.

Namun ada ketidaksesuaian konfigurasi CI dengan lingkungan pengembangan saat ini.

## Test Backend (`server/src/tests/`)

37 file. Banyak berukuran besar (beberapa >10–33 KB).

| Kategori | File contoh | Fokus |
|---|---|---|
| Auth & session | `auth.property.test.js`, `sessionExpiry.property.test.js`, `profileAuth.property.test.js`, `socketAuth.property.test.js` | login/logout, refresh, expiry, profil |
| Order | `orderEnhancements.property.test.js` (32KB), `orderTransition.property.test.js`, `orderDeletion.property.test.js`, `orderNumberUniqueness.property.test.js`, `orderSubtotalIntegrity.property.test.js`, `statusUpdateKeyConsistency.property.test.js`, `statusCompleteness.property.test.js` | transisi, approval, hapus, nomor unik, subtotal, konsistensi status |
| Post-audit | `postAuditPreservation.property.test.js` (33KB), `postAuditBugCondition.property.test.js` (31KB) | regresi & kondisi bug pasca-audit |
| Chat | `chatSystemBugCondition.property.test.js` (22KB), `chatSystemPreservation.property.test.js` (24KB), `enhancedChatSystem.property.test.js` (23KB) | conversation, DM, pesan, unread |
| Cart | `cartIsolation.property.test.js`, `cartSyncPayload.property.test.js`, `cartValidation.property.test.js` | isolasi per user, sync, validasi |
| Permission/feature | `checkFeature.unit.test.js`, `roleGuard.property.test.js`, `exportDatabase.checkFeature.test.js`, `promoList.checkFeature.test.js` | permission dinamis & role |
| Upload & avatar | `avatarUpload.property.test.js`, `fileUpload.property.test.js` | upload |
| Lainnya | `asyncResolution.property.test.js`, `emailNotification.property.test.js`, `notificationPrefs.property.test.js`, `pagination.property.test.js`, `phase4b.property.test.js`, `profileUpdate.property.test.js`, `profileValidation.property.test.js`, `ratingValidation.property.test.js`, `revenueRecap.property.test.js` | berbagai domain |

Konfigurasi: `server/vitest.config.js` — `environment: 'node'`, `globals: false`.

## Test Frontend (`src/test/`)

24 file (termasuk `setup.js`).

| File | Fokus |
|---|---|
| `setup.js` | setup jsdom |
| `routing.test.jsx`, `navbar.test.jsx` | routing & navigasi |
| `authContext.test.jsx`, `cartContext.test.jsx` | konteks |
| `adminLogin.test.jsx`, `logoutRedirect.test.jsx` | auth UI |
| `roleGuard.test.jsx` | guard |
| `modal.test.jsx`, `toast.test.jsx`, `chart.test.jsx` | UI komponen |
| `accountsSection.test.jsx`, `adminManagement.test.jsx` | admin/owner |
| `addressList.property.test.jsx`, `addressSelector.property.test.jsx` | alamat |
| `profileAccess.property.test.jsx` | profil |
| `permissions.filter.test.js` | filter permission frontend |
| `designUpload.config.test.js`, `offlinePerM2Billing.test.jsx` | konfigurasi & billing |
| `adminCustomerBugCondition.property.test.jsx`, `adminCustomerPreservation.property.test.jsx`, `adminProductBugCondition.property.test.jsx`, `adminProductPreservation.property.test.jsx` | regresi admin/customer/product |

## CI/CD

`.github/workflows/node.js.yml`:
```yaml
on: push/pr to main
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]
steps:
  - checkout
  - setup-node + cache npm
  - npm ci
  - npm run build --if-present
  - npm test
```

### Ketidaksesuaian

| Item | Fakta | Dampak |
|---|---|---|
| Versi Node | Root `package.json` `engines.node >=24.0.0`; CI memakai 18/20/22; lokal `v24.18.0` | Bisa ada perbedaan API/behavior; `npm ci` bisa berhasil tapi runtime berbeda |
| Test server | `npm test` root menjalankan `vitest --run` (frontend), **tidak** menjalankan `server/` test | Test backend 37 file **tidak diuji** di CI |
| Build | `npm run build` menjalankan `vite build && cd server && npm install --omit=dev` | CI menginstal deps server saat build, butuh koneksi DB/env `[TIDAK TERVERIFIKASI]` |
| Caching | hanya root `package.json-lock` | Lockfile server terpisah tidak dicache secara efektif |
| Lint | tidak ada langkah `npm run lint` | Pelanggaran lint bisa lolos |

## Linting & Formatting

- **ESLint**: `eslint.config.js` flat config, plugins `react-hooks`, `react-refresh`, `eslint-config-prettier`
- **Prettier**: `.prettierrc` — `semi: true`, `singleQuote: true`, `printWidth: 100`, `endOfLine: lf`
- **Script**: `npm run lint`, `npm run format`, `npm run format:check`

Aturan khusus:
- `react-hooks/set-state-in-effect` dinonaktifkan
- `no-unused-vars` mengizinkan prefix `_`
- Context files mengecualikan `react-refresh/only-export-components`

## Type Checking

Tidak ada `tsconfig.json`, tidak ada `check-types`, dan tidak ada script typecheck. Proyek sepenuhnya JavaScript/JSX.

## Kualitas Kode

### Kekuatan
- Banyak property test untuk invariant kritis (transisi order, approval, permission, chat)
- Pemisahan test backend/frontend
- Setup jsdom untuk frontend
- Menghindari false positive dengan ignore unused prefix
- Validasi route server dengan express-validator

### Kelemahan
- CI tidak menjamin kualitas backend
- Node version mismatch
- Tidak ada coverage threshold/report
- Property test besar sulit dibaca/debug
- Beberapa test mungkin bergantung pada struktur DB/migrasi `[TIDAK TERVERIFIKASI]`
- Tidak ada E2E test (Playwright/Cypress)
- `dist/` di-commit mengaburkan apa yang benar-benar dibangun
- Tidak ada pre-commit hook

## Jalankan Test Lokal

```bash
# frontend + root
npm test

# backend
cd server
npm test

# lint
npm run lint

# format check
npm run format:check
```

## Rekomendasi

### P0
1. Perbaiki CI: naikkan ke Node 24, jalankan test backend (`cd server && npm test`), tambahkan `npm run lint`.
2. Tambahkan coverage minimal untuk service kritis (orders, auth).
3. Pisahkan test yang butuh DB dari test unit murni.

### P1
4. Tambahkan `typecheck` jika ingin migrasi bertahap atau minimal `checkJs`.
5. Tambahkan pre-commit (lint-staged) atau GitHub branch protection.
6. Pindahkan `dist/` ke `.gitignore`, bangun di pipeline.

### P2
7. Kurangi ukuran property test monolit atau pecah per skenario.
8. Tambahkan E2E untuk alur kritis (checkout, approve order, DP).
9. Tambahkan security test (IDOR, auth bypass) — penting mengingat temuan.

## Kesimpulan

Kualitas testing **di atas rata-rata** untuk proyek serupa. Namun **efektivitas CI** rendah karena tidak menguji backend dan memakai versi Node yang salah. Fokus perbaikan ada pada **CI alignment** dan **peningkatan coverage untuk celah keamanan** yang teridentifikasi.

BERSAMBUNG ke `12-security-review.md`
