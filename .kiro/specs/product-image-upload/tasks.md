# Implementation Plan: Product Image Upload

## Overview

Replace the broken blob-URL image flow with a real upload pipeline. The implementation proceeds in six phases: backend infrastructure (storage + multer + controller + route), frontend service function, ProductModal refactor (image state shape, upload-on-select, improved UI), admin table thumbnail column, public product gallery, and a final verification pass on ProductCard.

## Tasks

- [x] 1. Backend: extend StorageService and upload middleware
  - [x] 1.1 Add `'products'` to `SUBDIRS` in `server/src/utils/storage.js`
    - Append `'products'` to the `SUBDIRS` array so `ensureUploadDirs()` creates `uploads/products/` at startup
    - No other changes to `storage.js` are needed — `StorageService.save` already accepts any subdir string
    - _Requirements: 1.7, 1.8_

  - [ ]* 1.2 Write property test for StorageService subdir isolation and filename uniqueness
    - **Property 9: StorageService subdir isolation** — stored path is under `uploads/products/` and does not overlap with other subdirs
    - **Property 10: StorageService filename uniqueness** — two distinct save calls produce different filenames
    - **Validates: Requirements 1.7, 1.8**
    - Add test file `server/src/tests/productImageStorage.property.test.js`

  - [x] 1.3 Add `product` type to `server/src/middleware/upload.js`
    - Add `product: ['image/jpeg', 'image/png', 'image/webp']` to `ALLOWED_MIME`
    - Add `product: 10 * 1024 * 1024` to `MAX_SIZE`
    - Export `uploadProduct = buildUpload('product')` alongside existing exports
    - The existing `buildUpload` factory already handles 413 (size) and 415 (MIME) — no new logic needed
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.4 Write property test for uploadProduct MIME rejection
    - **Property 2: Unsupported MIME types are rejected** — any MIME not in the allowed list triggers a 415 error from the fileFilter
    - **Validates: Requirements 1.4, 2.1**
    - Add test to `server/src/tests/productImageUpload.property.test.js`

- [x] 2. Backend: upload controller handler and route
  - [x] 2.1 Add `uploadProductImage` handler to `server/src/controllers/products.controller.js`
    - Import `StorageService` from `'../utils/storage.js'`
    - Implement handler: guard `req.file` absent → 400 `{ ok: false, message: 'File gambar wajib diunggah.' }`; call `StorageService.save(req.file, 'products')`; return `{ ok: true, url: saved.url }`
    - _Requirements: 1.1, 1.2, 1.7_

  - [x] 2.2 Add `POST /upload-image` route to `server/src/routes/products.routes.js`
    - Import `uploadProduct` from `'../middleware/upload.js'`
    - Add route before the existing product CRUD routes:
      ```
      router.post('/upload-image', authenticate, requireRole('admin','owner'), uploadProduct.single('image'), ctrl.uploadProductImage)
      ```
    - This mounts at `POST /api/products/upload-image` (matches the design's `POST /api/upload/product` intent — the frontend service will call this path)
    - _Requirements: 1.1, 1.5, 1.6_

  - [ ]* 2.3 Write property test for upload response URL format
    - **Property 1: Upload response URL format** — for any valid image file the returned `url` matches `/^\/uploads\/products\/.+\.(jpg|jpeg|png|webp)$/i`
    - **Validates: Requirements 1.1, 1.7**
    - Add test to `server/src/tests/productImageUpload.property.test.js`

- [x] 3. Checkpoint — backend wired up
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend: `uploadProductImage` service function
  - [x] 4.1 Add `uploadProductImage(file)` to `src/services/productService.js`
    - Build `FormData`, append file as `'image'` field
    - POST to `/api/products/upload-image` using the existing `api` axios instance with `Content-Type: multipart/form-data`
    - If `res.data.ok` is false, throw `new Error(res.data.message)`
    - On network error, let the error propagate
    - Return `res.data.url` (the server URL string)
    - Export the function
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.2 Write property test for `normalizeProduct` idempotency
    - **Property 7: normalizeProduct idempotency** — `normalizeProduct(normalizeProduct(raw))` deep-equals `normalizeProduct(raw)` for any raw product shape
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - Add test to `server/src/tests/normalizeProduct.property.test.js` (frontend logic tested via fast-check in the server test suite)

- [x] 5. Frontend: ProductModal — image state shape and upload-on-select
  - [x] 5.1 Migrate `images` state from `string[]` to `Image_Entry[]` in `ProductModal`
    - Change `parseImages(product)` to return `Image_Entry[]`: map each existing URL to `{ url, status: 'done' }`
    - Update `handleRemoveImage` to work with the new shape (filter by index)
    - Update `handleSubmit` to read `images.filter(i => i.status === 'done').map(i => i.url)` for the `image` field
    - Add submit guard: if any entry has `status: 'uploading'`, set `formError` to `'Tunggu hingga semua foto selesai diunggah.'` and return
    - Update the existing "no images" guard to check `doneImages.length === 0` with message `'Minimal 1 gambar produk wajib diunggah.'`
    - _Requirements: 4.1, 4.5, 4.6, 4.7, 5.1, 5.2_

  - [ ]* 5.2 Write property test for no blob URLs in submitted product data
    - **Property 3: No blob URLs in submitted product data** — for any mix of done/error/uploading entries, the array passed to the save API contains only `/uploads/products/` strings
    - **Validates: Requirements 5.1, 5.2, 4.7**
    - Add test to `server/src/tests/productModalSubmit.property.test.js`

  - [x] 5.3 Implement upload-on-select in `handleImageUpload`
    - Replace the current `URL.createObjectURL` + push logic with the new flow:
      1. Reject entire selection if `images.length + files.length > 8` (set `imageError`, return)
      2. Record `startIdx = images.length`
      3. Create placeholder entries `{ url: URL.createObjectURL(f), status: 'uploading', file: f }` and append to state
      4. Call `Promise.allSettled(files.map(async (file, i) => { ... }))` — for each file call `uploadProductImage(file)`, on success update entry at `startIdx + i` to `{ url: serverUrl, status: 'done' }` and call `URL.revokeObjectURL(placeholder.url)`, on failure update to `{ ...entry, status: 'error', error: err.message }`
    - Import `uploadProductImage` from `productService.js`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 5.4 Write property test for image count invariant
    - **Property 4: Image count invariant** — for any sequence of file selections, `images.length` never exceeds 8
    - **Validates: Requirements 4.2**
    - Add test to `server/src/tests/productModalSubmit.property.test.js`

  - [ ]* 5.5 Write property test for upload state transitions
    - **Property 5: Upload state transitions are correct** — each Image_Entry transitions from `'uploading'` to `'done'` or `'error'` and never stays `'uploading'` after the upload settles
    - **Validates: Requirements 4.3, 4.4**
    - Add test to `server/src/tests/productModalSubmit.property.test.js`

- [x] 6. Frontend: ProductModal — improved image card UI
  - [x] 6.1 Add reorder (move-left / move-right) buttons to each image card
    - For each image entry render two arrow buttons: move-left (disabled when `idx === 0`) and move-right (disabled when `idx === images.length - 1`)
    - `handleMoveImage(idx, direction)`: swap entry at `idx` with `idx - 1` (left) or `idx + 1` (right) using array spread
    - _Requirements: 4.9_

  - [ ]* 6.2 Write property test for image reordering preserves all entries
    - **Property 8: Image reordering preserves all entries** — any sequence of move-left/move-right operations produces an array with the same entries (same length, same elements)
    - **Validates: Requirements 4.9**
    - Add test to `server/src/tests/productModalSubmit.property.test.js`

  - [x] 6.3 Add per-image UI indicators: spinner overlay, error state, "Foto 1" badge, count badge
    - Spinner overlay: when `entry.status === 'uploading'`, render a centered spinner `<div>` absolutely positioned over the image thumbnail
    - Error state: when `entry.status === 'error'`, render a red overlay with the error message and a retry hint
    - "Foto 1" badge: render a small `<span>` badge on the first entry (`idx === 0`) with text `"Foto 1"`
    - Count badge: render `"{doneCount}/{images.length}"` above the image grid (e.g. `"3/8"`)
    - _Requirements: 4.8, 4.11, 4.12_

- [x] 7. Checkpoint — ProductModal fully refactored
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Frontend: ProductsSection — thumbnail column
  - [ ] 8.1 Add "Foto" column to the admin product table in `ProductsSection`
    - In `<thead>`, add `<th>Foto</th>` as the first column (before "Nama")
    - In each `<tr>`, add a `<td>` as the first cell containing:
      ```jsx
      <img
        src={p.images?.[0] || placeholderImg}
        alt={p.name}
        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
        onError={e => { e.currentTarget.src = placeholderImg; }}
        loading="lazy"
      />
      ```
    - Import `placeholderImg` from `'../../../../assets/placeholder.svg'`
    - Update `colSpan` on the empty-state row from `4` to `5`
    - `p.images` is already populated by `normalizeProduct` in `productService.js` — no service changes needed
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 9. Frontend: CatalogProductPage — real image gallery
  - [ ] 9.1 Add `activeIndex` state and wire gallery to `product.images`
    - Add `const [activeIndex, setActiveIndex] = useState(0)` to the component
    - In the `load()` effect, reset `setActiveIndex(0)` when a new product loads
    - Derive `const images = product.images || []` and `const hasImages = images.length > 0`
    - Replace the static `<img src={product.image || placeholderImg}>` in `.gallery-main` with `<img src={hasImages ? images[activeIndex] : placeholderImg} onError={...}>`
    - _Requirements: 7.1, 7.2_

  - [ ] 9.2 Implement prev/next navigation buttons
    - Wire the existing "Sebelumnya" button: `onClick={() => setActiveIndex(i => (i - 1 + images.length) % images.length)}`
    - Wire the existing "Berikutnya" button: `onClick={() => setActiveIndex(i => (i + 1) % images.length)}`
    - Conditionally render the entire `.gallery-thumbs-row` only when `hasImages` is true
    - _Requirements: 7.3, 7.4_

  - [ ]* 9.3 Write property test for gallery index bounds
    - **Property 6: Gallery index bounds** — for any `images.length > 0` and any sequence of prev/next actions, `activeIndex` is always in `[0, images.length - 1]`
    - **Validates: Requirements 7.3, 7.4**
    - Add test to `server/src/tests/catalogGallery.property.test.js`

  - [ ] 9.4 Implement thumbnail strip
    - Replace the three static `<div className="gallery-thumb">` placeholders with a dynamic map over `images`:
      ```jsx
      {images.map((url, i) => (
        <button
          key={i}
          type="button"
          className={`gallery-thumb${i === activeIndex ? ' active' : ''}`}
          onClick={() => setActiveIndex(i)}
          aria-label={`Foto ${i + 1}`}
        >
          <img src={url} alt={`Foto ${i + 1}`} onError={e => { e.currentTarget.src = placeholderImg; }} />
        </button>
      ))}
      ```
    - _Requirements: 7.5, 7.6, 7.7_

- [ ] 10. Verification: ProductCard
  - [ ] 10.1 Verify `ProductCard` handles `product.image` correctly — no code changes needed
    - Read `src/components/shared/ProductCard.jsx` and confirm:
      - It renders `<img src={product?.image || placeholderImg}>` ✓
      - It has an `onError` handler that falls back to `placeholderImg` ✓
      - `normalizeProduct` in `productService.js` already sets `image = images[0] || null` ✓
    - If any of the above is missing, add the missing piece; otherwise leave the file unchanged
    - _Requirements: 9.1, 9.2_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The upload route mounts at `POST /api/products/upload-image` (under the existing `productRouter` at `/api/products`)
- `normalizeProduct` in `productService.js` already produces `image` and `images` — no changes needed there
- Blob URLs created during upload must be revoked via `URL.revokeObjectURL` once the server URL is received (memory hygiene)
- Property tests use `fast-check`, which is already present in the project's test suite
- `ProductCard` requires no code changes — task 10.1 is a read-and-confirm step only
