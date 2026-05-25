# Requirements Document

## Introduction

This feature replaces the broken blob-URL image flow in the admin product management interface with a real upload pipeline. When an admin selects product images in the `ProductModal`, each file is immediately uploaded to a dedicated backend endpoint (`POST /api/upload/product`), which persists the file to disk via `StorageService` and returns a permanent server URL. The modal stores those real URLs so that when the product form is submitted, only valid, resolvable paths are saved to the database.

Beyond the core upload fix, the feature improves the admin image card UI (styled upload zone, per-image progress, reordering, "Foto 1" badge), adds a thumbnail column to the admin product table, replaces the static gallery placeholder on the public product detail page with a real interactive image gallery, and verifies that `ProductCard` already handles the normalized image correctly.

## Glossary

- **Upload_Endpoint**: The `POST /api/upload/product` HTTP endpoint that accepts a single product image file and returns a permanent server URL.
- **StorageService**: The backend utility (`server/src/utils/storage.js`) responsible for moving uploaded temp files to the appropriate subdirectory and returning the resulting URL.
- **ProductModal**: The admin React component used to create and edit products, containing the image upload UI.
- **ProductsSection**: The admin React component that renders the product management table.
- **CatalogProductPage**: The public-facing React page that displays a single product's details, including its image gallery.
- **ProductCard**: The shared React component that renders a product thumbnail in listing pages.
- **normalizeProduct**: The frontend utility function in `productService.js` that transforms a raw API product response into a consistent shape with `image` (first URL or null) and `images` (full URL array).
- **Image_Entry**: An object in the `ProductModal` images state with shape `{ url: string, status: 'uploading' | 'done' | 'error', error?: string, file?: File }`.
- **Blob_URL**: A temporary browser-local URL created by `URL.createObjectURL()`, starting with `blob:`, which is not a valid persistent server URL.
- **Server_URL**: A permanent URL returned by the Upload_Endpoint, starting with `/uploads/products/`.
- **Placeholder_Image**: A static fallback image displayed when no product image is available or when an image fails to load.
- **Active_Index**: The integer index of the currently displayed image in the CatalogProductPage gallery.

---

## Requirements

### Requirement 1: Backend Upload Endpoint

**User Story:** As an admin, I want to upload product images to the server, so that permanent URLs are stored instead of temporary blob URLs.

#### Acceptance Criteria

1. WHEN a request is made to `POST /api/upload/product` with a valid image file in the `image` field, THE Upload_Endpoint SHALL return HTTP 200 with body `{ ok: true, url: "/uploads/products/<filename>" }`.
2. WHEN a request is made to `POST /api/upload/product` without a file, THE Upload_Endpoint SHALL return HTTP 400 with body `{ ok: false, message: "File gambar wajib diunggah." }`.
3. WHEN a request is made to `POST /api/upload/product` with a file exceeding 10 MB, THE Upload_Endpoint SHALL return HTTP 413 with body `{ ok: false, message: "File terlalu besar. Maksimal 10MB." }`.
4. WHEN a request is made to `POST /api/upload/product` with a file whose MIME type is not `image/jpeg`, `image/png`, or `image/webp`, THE Upload_Endpoint SHALL return HTTP 415 with body `{ ok: false, message: "Tipe file '...' tidak didukung untuk upload product." }`.
5. WHEN a request is made to `POST /api/upload/product` without a valid JWT token, THE Upload_Endpoint SHALL return HTTP 401.
6. WHEN a request is made to `POST /api/upload/product` with a valid JWT token whose role is not `admin` or `owner`, THE Upload_Endpoint SHALL return HTTP 403.
7. WHEN a valid file is accepted by the Upload_Endpoint, THE StorageService SHALL store the file exclusively under the `uploads/products/` directory.
8. WHEN a valid file is accepted by the Upload_Endpoint, THE StorageService SHALL generate a unique filename using the format `${Date.now()}-${randomUUID()}${ext}`.

---

### Requirement 2: Multer Upload Middleware for Products

**User Story:** As a backend developer, I want a dedicated multer configuration for product images, so that file validation is consistent and reusable.

#### Acceptance Criteria

1. THE `uploadProduct` multer instance SHALL accept only files with MIME type `image/jpeg`, `image/png`, or `image/webp`.
2. THE `uploadProduct` multer instance SHALL reject files larger than 10 MB.
3. THE `uploadProduct` multer instance SHALL store temporary files in the OS temp directory before they are moved by StorageService.
4. THE `uploadProduct` multer instance SHALL be exported from `server/src/middleware/upload.js` alongside the existing `uploadAvatar` export.

---

### Requirement 3: Frontend Upload Service Function

**User Story:** As a frontend developer, I want a service function that uploads a single product image file, so that the ProductModal can obtain a server URL for each selected file.

#### Acceptance Criteria

1. WHEN `uploadProductImage(file)` is called with a valid `File` object, THE productService SHALL POST the file as `multipart/form-data` to `/api/upload/product` and return the `url` string from the response.
2. WHEN the server returns a response where `ok` is `false`, THE productService SHALL throw an `Error` with the server's `message` field.
3. WHEN a network error occurs during the POST request, THE productService SHALL throw an `Error`.
4. THE `uploadProductImage` function SHALL be exported from `src/services/productService.js`.

---

### Requirement 4: ProductModal Upload-on-Select Behavior

**User Story:** As an admin, I want images to upload immediately when I select them, so that I can see upload progress and the form submission only contains successfully uploaded images.

#### Acceptance Criteria

1. WHEN an admin selects one or more files via the image input, THE ProductModal SHALL immediately create an Image_Entry for each file with `status: 'uploading'` and a Blob_URL as a preview.
2. WHEN an admin selects files that would cause the total image count to exceed 8, THE ProductModal SHALL reject the entire selection and display the error message "Maksimal 8 foto diperbolehkan." without creating any new Image_Entry objects.
3. WHEN an upload completes successfully, THE ProductModal SHALL update the corresponding Image_Entry to `{ url: <Server_URL>, status: 'done' }` and revoke the Blob_URL.
4. WHEN an upload fails, THE ProductModal SHALL update the corresponding Image_Entry to `{ status: 'error', error: <message> }`.
5. WHILE any Image_Entry has `status: 'uploading'`, THE ProductModal SHALL prevent form submission and display the message "Tunggu hingga semua foto selesai diunggah."
6. WHEN the admin submits the form and no Image_Entry has `status: 'done'`, THE ProductModal SHALL prevent form submission and display the message "Minimal 1 gambar produk wajib diunggah."
7. WHEN the admin submits the form, THE ProductModal SHALL include only Image_Entry objects with `status: 'done'` in the submitted image array, serialized as `JSON.stringify(urls)`.
8. THE ProductModal SHALL display a "Foto 1" badge on the first Image_Entry in the images list.
9. WHEN the admin clicks the move-left or move-right button on an Image_Entry, THE ProductModal SHALL reorder the images array accordingly.
10. WHEN the admin clicks the remove button on an Image_Entry, THE ProductModal SHALL remove that entry from the images array without making any server-side deletion request.
11. THE ProductModal SHALL display a spinner overlay on each Image_Entry whose `status` is `'uploading'`.
12. THE ProductModal SHALL display a count badge showing the number of successfully uploaded images out of the total (e.g. "3/8").

---

### Requirement 5: No Blob URLs in Submitted Product Data

**User Story:** As a system, I want product save requests to contain only permanent server URLs, so that stored image paths remain accessible after the browser session ends.

#### Acceptance Criteria

1. WHEN a product is created or updated via `POST /api/products` or `PUT /api/products/:id`, THE ProductModal SHALL ensure that every URL in the `image` JSON array starts with `/uploads/products/` and not with `blob:`.
2. THE ProductModal SHALL never include an Image_Entry with `status: 'error'` or `status: 'uploading'` in the submitted image array.

---

### Requirement 6: Admin Product Table Thumbnail Column

**User Story:** As an admin, I want to see a thumbnail of each product's first image in the product table, so that I can visually identify products at a glance.

#### Acceptance Criteria

1. THE ProductsSection table SHALL include a "Foto" column that displays a 40×40 px thumbnail of the first image for each product row.
2. WHEN a product has at least one image, THE ProductsSection SHALL display `product.images[0]` as the thumbnail source.
3. WHEN a product has no images or the thumbnail image fails to load, THE ProductsSection SHALL display the Placeholder_Image instead.
4. THE ProductsSection thumbnail images SHALL use `loading="lazy"` to defer off-screen image loading.

---

### Requirement 7: Public Product Detail Image Gallery

**User Story:** As a customer, I want to view all product images in an interactive gallery on the product detail page, so that I can examine the product from multiple angles before purchasing.

#### Acceptance Criteria

1. WHEN a user navigates to a product detail page, THE CatalogProductPage SHALL display `product.images[activeIndex]` as the main gallery image, where `activeIndex` defaults to 0.
2. WHEN `product.images` is empty, THE CatalogProductPage SHALL display the Placeholder_Image as the main image and SHALL NOT render navigation buttons or a thumbnail strip.
3. WHEN a user clicks the "Berikutnya" (next) button, THE CatalogProductPage SHALL set `activeIndex` to `(activeIndex + 1) % product.images.length`.
4. WHEN a user clicks the "Sebelumnya" (previous) button, THE CatalogProductPage SHALL set `activeIndex` to `(activeIndex - 1 + product.images.length) % product.images.length`.
5. WHEN a user clicks a thumbnail in the thumbnail strip, THE CatalogProductPage SHALL set `activeIndex` to the index of that thumbnail.
6. THE CatalogProductPage SHALL render a thumbnail strip containing one button per image in `product.images`, with the button at `activeIndex` styled as active.
7. WHEN a gallery image fails to load, THE CatalogProductPage SHALL replace the broken image source with the Placeholder_Image via an `onError` handler.

---

### Requirement 8: normalizeProduct Consistent Output

**User Story:** As a frontend developer, I want `normalizeProduct` to always produce a consistent shape regardless of how `image_path` is stored, so that all components can rely on `product.image` and `product.images` being defined.

#### Acceptance Criteria

1. WHEN `normalizeProduct` is called with a raw product whose `image_path` is a valid JSON array string, THE normalizeProduct function SHALL return an object where `images` is the parsed array and `image` is `images[0]` or `null` if the array is empty.
2. WHEN `normalizeProduct` is called with a raw product whose `image_path` is `null` or `undefined`, THE normalizeProduct function SHALL return an object where `images` is `[]` and `image` is `null`.
3. WHEN `normalizeProduct` is called with a raw product whose `image_path` is a single URL string (not a JSON array), THE normalizeProduct function SHALL return an object where `images` is `[image_path]` and `image` is `image_path`.
4. THE normalizeProduct function SHALL be idempotent: calling it twice on the same input SHALL produce a result that deep-equals calling it once.

---

### Requirement 9: ProductCard Thumbnail (Verification)

**User Story:** As a developer, I want to confirm that `ProductCard` already correctly displays the first product image, so that no changes are needed to support the new image URL format.

#### Acceptance Criteria

1. WHEN `ProductCard` receives a product where `product.image` is a non-empty string, THE ProductCard SHALL render an `<img>` element with `src` set to `product.image`.
2. WHEN `ProductCard` receives a product where `product.image` is `null` or `undefined`, THE ProductCard SHALL render an `<img>` element with `src` set to the Placeholder_Image.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Upload response URL format

For any valid image file (MIME type in `[image/jpeg, image/png, image/webp]`, size ≤ 10 MB) submitted to the Upload_Endpoint, the returned `url` SHALL match the pattern `/^\/uploads\/products\/.+\.(jpg|jpeg|png|webp)$/i`.

**Validates: Requirements 1.1, 1.7**

---

### Property 2: Unsupported MIME types are rejected

For any file whose MIME type is not `image/jpeg`, `image/png`, or `image/webp`, the Upload_Endpoint SHALL return HTTP 415.

**Validates: Requirements 1.4, 2.1**

---

### Property 3: No blob URLs in submitted product data

For any combination of successful and failed uploads in the ProductModal, the image array passed to the product save API SHALL contain only strings starting with `/uploads/products/` and no strings starting with `blob:`.

**Validates: Requirements 5.1, 5.2, 4.7**

---

### Property 4: Image count invariant

For any sequence of file selections in the ProductModal, `images.length` SHALL never exceed 8 at any point in time.

**Validates: Requirements 4.2**

---

### Property 5: Upload state transitions are correct

For any file selected in the ProductModal, the corresponding Image_Entry SHALL transition from `status: 'uploading'` to either `status: 'done'` (with a Server_URL) or `status: 'error'` (with an error message), and SHALL never remain in `status: 'uploading'` after the upload settles.

**Validates: Requirements 4.3, 4.4**

---

### Property 6: Gallery index bounds

For any `product.images` array with length > 0 and any sequence of prev/next navigation actions, `activeIndex` SHALL always be in the range `[0, product.images.length - 1]`.

**Validates: Requirements 7.3, 7.4**

---

### Property 7: normalizeProduct idempotency

For any raw product object, `normalizeProduct(normalizeProduct(raw))` SHALL deep-equal `normalizeProduct(raw)`.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

---

### Property 8: Image reordering preserves all entries

For any images array and any sequence of move-left / move-right operations, the resulting array SHALL contain the same Image_Entry objects as the original array (same length, same elements, different order).

**Validates: Requirements 4.9**

---

### Property 9: StorageService subdir isolation

For any file uploaded via the Upload_Endpoint, the stored file path SHALL be under `uploads/products/` and SHALL NOT overlap with `uploads/avatars/`, `uploads/designs/`, or any other subdirectory.

**Validates: Requirements 1.7**

---

### Property 10: StorageService filename uniqueness

For any two distinct upload operations, the filenames generated by StorageService SHALL be different.

**Validates: Requirements 1.8**
