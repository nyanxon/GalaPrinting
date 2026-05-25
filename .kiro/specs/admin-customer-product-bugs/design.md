# Admin Customer & Product Bugs — Bugfix Design

## Overview

Dua bug ditemukan pada halaman admin/owner yang perlu diperbaiki:

**Bug 1 — Tanggal Bergabung Customer (Invalid Date):**
Frontend mengakses `u.createdAt` (camelCase) namun API backend mengembalikan field `created_at` (snake_case). Akibatnya `u.createdAt` bernilai `undefined`, dan `new Date(undefined)` menghasilkan `"Invalid Date"` pada kolom "Bergabung" di tabel customer.

**Bug 2 — Input Gambar Produk (Missing Image Input):**
Form tambah/edit produk (`ProductModal`) tidak memiliki field input untuk gambar sama sekali. Saat menyimpan, kode hardcode `image: product?.image || '/assets/img/placeholder.svg'` — artinya produk baru selalu disimpan dengan placeholder, dan produk yang diedit tidak bisa diubah gambarnya. Rencana perbaikan: mendukung 1–8 foto per produk dengan validasi minimal 1 foto wajib.

Strategi perbaikan bersifat minimal dan targeted: hanya mengubah baris yang menyebabkan bug tanpa menyentuh logika lain.

---

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu bug — input data yang mengekspos perilaku salah
- **Property (P)**: Perilaku yang diharapkan ketika bug condition terpenuhi
- **Preservation**: Perilaku yang harus tetap tidak berubah setelah perbaikan
- **`CustomersSection`**: Komponen React di `src/components/pages/admin/sections/CustomersSection.jsx` yang menampilkan daftar customer
- **`ProductModal`**: Komponen React di `src/components/pages/admin/sections/ProductsSection.jsx` yang menangani form tambah/edit produk
- **`created_at`**: Field snake_case yang dikembalikan oleh API backend (MySQL/Node.js)
- **`createdAt`**: Field camelCase yang salah diakses oleh frontend (seharusnya `created_at`)
- **`image_path`**: Kolom di tabel `products` yang menyimpan path/URL gambar produk
- **`images`**: Array URL gambar produk (1–8 item) yang akan dikelola di frontend

---

## Bug Details

### Bug 1 — Tanggal Bergabung Customer

#### Bug Condition

Bug muncul ketika komponen `CustomersSection` merender baris tabel customer dan mengakses `u.createdAt` pada objek yang dikembalikan API. API mengembalikan `created_at` (snake_case), sehingga `u.createdAt` selalu `undefined`.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug1(customerObject)
  INPUT: customerObject — objek user dari API response
  OUTPUT: boolean

  RETURN customerObject.createdAt === undefined
         AND customerObject.created_at !== undefined
         AND new Date(customerObject.createdAt).toString() === "Invalid Date"
END FUNCTION
```

#### Contoh

- **Input**: `{ id: "abc", name: "Budi", email: "budi@mail.com", created_at: "2025-05-07T10:00:00.000Z" }`
  - **Actual**: `new Date(undefined)` → `"Invalid Date"`
  - **Expected**: `new Date("2025-05-07T10:00:00.000Z").toLocaleDateString('id-ID')` → `"7 Mei 2025"`
- **Input**: `{ id: "xyz", name: "Sari", email: "sari@mail.com", created_at: "2024-01-15T08:30:00.000Z" }`
  - **Actual**: `"Invalid Date"`
  - **Expected**: `"15 Januari 2024"`
- **Edge case**: Customer dengan `created_at: null` → harus menampilkan `"—"` bukan crash

---

### Bug 2 — Input Gambar Produk

#### Bug Condition

Bug muncul ketika admin membuka form tambah/edit produk. `ProductModal` tidak memiliki field input gambar. Saat submit, `image` di-hardcode dari `product?.image || '/assets/img/placeholder.svg'`, sehingga produk baru tidak bisa memiliki gambar nyata.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug2(formState)
  INPUT: formState — state form ProductModal saat submit
  OUTPUT: boolean

  RETURN formState.images === undefined OR formState.images.length === 0
         AND formState.submittedImage === '/assets/img/placeholder.svg'
         AND noImageInputRenderedInForm()
END FUNCTION
```

#### Contoh

- **Tambah produk baru**: Admin mengisi nama, kategori, harga — tidak ada field gambar → produk tersimpan dengan `image_path = '/assets/img/placeholder.svg'`
- **Edit produk**: Admin membuka form edit — gambar existing tidak ditampilkan, tidak ada cara mengubah gambar
- **Validasi**: Admin mencoba simpan tanpa gambar → seharusnya muncul error "Minimal 1 gambar wajib diunggah"
- **Batas maksimal**: Admin mencoba upload foto ke-9 → seharusnya ditolak dengan pesan "Maksimal 8 foto"

---

## Expected Behavior

### Preservation Requirements

**Perilaku yang harus tetap tidak berubah:**
- Kolom Nama, Email, dan Telepon pada tabel customer harus tetap ditampilkan dengan benar
- Fitur pencarian customer berdasarkan nama, email, telepon harus tetap berfungsi
- Paginasi daftar customer harus tetap berfungsi
- Semua field form produk lainnya (Nama, Kategori, Harga, Deskripsi, Warna, Ukuran, Bahan, Harga Varian, Wajib Upload Desain) harus tetap berfungsi
- Operasi simpan produk (create/update) untuk semua field non-gambar harus tetap berfungsi
- Operasi hapus produk harus tetap berfungsi
- Tampilan produk di halaman katalog publik harus tetap menampilkan gambar dengan benar

**Scope:**
- Bug 1: Hanya baris `new Date(u.createdAt)` yang diubah menjadi `new Date(u.created_at)`
- Bug 2: Penambahan state `images` dan UI input gambar di `ProductModal`, tanpa mengubah logika field lain

---

## Hypothesized Root Cause

### Bug 1 — Tanggal Bergabung Customer

1. **Field Name Mismatch (snake_case vs camelCase)**: Backend MySQL mengembalikan kolom `created_at` (snake_case). Frontend mengakses `u.createdAt` (camelCase). Tidak ada transformasi/normalisasi field name di `listCustomers()` pada `authService.js` — berbeda dengan `productService.js` yang memiliki fungsi `normalizeProduct()` yang secara eksplisit memetakan `raw.image_path` → `image`, dll.
   - `authService.js` hanya melakukan `return res.data.items ?? res.data.data ?? []` tanpa normalisasi
   - `CustomersSection.jsx` langsung mengakses `u.createdAt` tanpa fallback ke `u.created_at`

2. **Tidak Ada Normalisasi di Service Layer**: Berbeda dengan `productService.js` yang punya `normalizeProduct()`, `authService.js` tidak memiliki fungsi normalisasi untuk data customer.

### Bug 2 — Input Gambar Produk

1. **Field Gambar Tidak Diimplementasikan di Form**: `ProductModal` tidak memiliki state untuk gambar dan tidak merender input file/URL untuk gambar. Ini adalah fitur yang belum diimplementasikan, bukan regresi.

2. **Hardcoded Placeholder di Submit Handler**: Di `handleSubmit`, baris `image: product?.image || product?.image_path || '/assets/img/placeholder.svg'` menggunakan gambar existing atau placeholder — tidak pernah mengambil input dari user.

3. **Backend Sudah Siap**: `products.service.js` sudah mendukung `imagePath` di `createProduct` dan `updateProduct`. Upload middleware (`upload.js`) sudah ada untuk avatar/design. Yang kurang hanya UI input dan logika upload di frontend.

4. **Struktur Data Gambar**: Kolom `image_path` di database menyimpan satu path. Untuk mendukung 1–8 foto, perlu diputuskan apakah menyimpan sebagai JSON array di `image_path` atau menambah kolom baru. Pendekatan paling minimal: simpan array URL sebagai JSON string di `image_path`, gunakan foto pertama sebagai gambar utama.

---

## Correctness Properties

Property 1: Bug Condition — Tanggal Bergabung Ditampilkan Valid

_For any_ objek customer dari API response di mana `created_at` berisi timestamp ISO yang valid, komponen `CustomersSection` yang sudah diperbaiki SHALL menampilkan tanggal yang terformat dengan benar (misal: "7 Mei 2025") menggunakan `toLocaleDateString('id-ID')`, bukan "Invalid Date".

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Kolom Customer Lain Tidak Berubah

_For any_ objek customer dari API response di mana bug condition Bug 1 TIDAK berlaku (yaitu field `name`, `email`, `phone` diakses), komponen `CustomersSection` yang sudah diperbaiki SHALL menampilkan nilai kolom Nama, Email, dan Telepon identik dengan sebelum perbaikan.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 3: Bug Condition — Input Gambar Tersedia di Form Produk

_For any_ state form `ProductModal` (baik mode tambah maupun edit), komponen yang sudah diperbaiki SHALL merender field input gambar yang memungkinkan upload 1–8 foto, dan SHALL menolak submit jika tidak ada gambar dengan menampilkan pesan validasi.

**Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.7**

Property 4: Preservation — Field Produk Lain Tidak Berubah

_For any_ submit form produk di mana field non-gambar (nama, kategori, harga, deskripsi, varian, dll.) diisi dengan valid, komponen `ProductModal` yang sudah diperbaiki SHALL menyimpan semua field tersebut identik dengan perilaku sebelum perbaikan.

**Validates: Requirements 3.4, 3.5, 3.6, 3.7**

---

## Fix Implementation

### Bug 1 — Tanggal Bergabung Customer

**File**: `src/components/pages/admin/sections/CustomersSection.jsx`

**Perubahan Spesifik**:

1. **Ganti akses field**: Ubah `u.createdAt` menjadi `u.created_at` pada baris render tabel:
   ```jsx
   // BEFORE (buggy):
   {new Date(u.createdAt).toLocaleDateString('id-ID')}

   // AFTER (fixed):
   {u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
   ```

2. **Tambah guard untuk null/undefined**: Wrap dengan kondisi untuk menghindari "Invalid Date" jika `created_at` null.

**Alternatif (opsional)**: Tambahkan normalisasi di `authService.js` `listCustomers()` untuk memetakan `created_at` → `createdAt` agar konsisten dengan konvensi camelCase frontend. Namun pendekatan minimal adalah memperbaiki langsung di komponen.

---

### Bug 2 — Input Gambar Produk

**File**: `src/components/pages/admin/sections/ProductsSection.jsx`

**Perubahan Spesifik**:

1. **Tambah state `images` di `ProductModal`**:
   ```js
   // Parse existing images dari product (bisa berupa JSON array atau string tunggal)
   function parseImages(product) {
     if (!product) return [];
     const raw = product.image || product.image_path;
     if (!raw) return [];
     try {
       const parsed = JSON.parse(raw);
       if (Array.isArray(parsed)) return parsed;
     } catch {}
     if (raw !== '/assets/img/placeholder.svg') return [raw];
     return [];
   }

   const [images, setImages] = useState(parseImages(product));
   const [imageError, setImageError] = useState('');
   ```

2. **Tambah handler upload gambar**:
   ```js
   async function handleImageUpload(e) {
     const files = Array.from(e.target.files || []);
     if (images.length + files.length > 8) {
       setImageError('Maksimal 8 foto diperbolehkan.');
       return;
     }
     // Upload setiap file ke endpoint yang ada (misal /api/upload/avatar atau endpoint baru)
     // Untuk MVP: gunakan URL.createObjectURL untuk preview lokal,
     // upload ke server saat submit
     const newUrls = files.map(f => URL.createObjectURL(f));
     setImages(prev => [...prev, ...newUrls]);
     setImageError('');
   }

   function handleRemoveImage(idx) {
     setImages(prev => prev.filter((_, i) => i !== idx));
   }
   ```

3. **Tambah validasi gambar di `handleSubmit`**:
   ```js
   if (images.length === 0) {
     setFormError('Minimal 1 gambar produk wajib diunggah.');
     return;
   }
   ```

4. **Sertakan gambar dalam data submit**:
   ```js
   const data = {
     // ... field lain tetap sama ...
     image: JSON.stringify(images),  // simpan sebagai JSON array
   };
   ```

5. **Render UI input gambar di form** (sebelum field `requiresDesign`):
   ```jsx
   <div className="adm-field">
     <label className="adm-label">
       Foto Produk * <span className="adm-hint">(minimal 1, maksimal 8)</span>
     </label>
     {/* Preview gambar yang sudah ada */}
     {images.length > 0 && (
       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
         {images.map((url, idx) => (
           <div key={idx} style={{ position: 'relative' }}>
             <img src={url} alt={`Foto ${idx + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb' }} />
             <button type="button" onClick={() => handleRemoveImage(idx)}
               style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12 }}
               aria-label={`Hapus foto ${idx + 1}`}>✕</button>
           </div>
         ))}
       </div>
     )}
     {images.length < 8 && (
       <input
         type="file"
         accept="image/jpeg,image/png,image/webp"
         multiple
         onChange={handleImageUpload}
         className="adm-input"
         aria-label="Upload foto produk"
       />
     )}
     {imageError && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '4px' }}>{imageError}</p>}
   </div>
   ```

**Catatan Backend**: Untuk MVP, gambar disimpan sebagai JSON array string di kolom `image_path`. Komponen publik (`ProductCard`, `CatalogProductPage`) perlu membaca foto pertama dari array jika `image_path` berupa JSON. Fungsi `normalizeProduct` di `productService.js` perlu diupdate untuk meng-handle format ini.

---

## Testing Strategy

### Validation Approach

Strategi pengujian mengikuti dua fase: pertama, konfirmasi bug pada kode yang belum diperbaiki (exploratory), kemudian verifikasi perbaikan dan pastikan tidak ada regresi (fix + preservation checking).

---

### Exploratory Bug Condition Checking

**Goal**: Konfirmasi bug pada kode yang belum diperbaiki sebelum mengimplementasikan fix.

**Test Plan**: Tulis unit test yang mensimulasikan data API dan merender komponen, lalu assert bahwa output yang salah muncul pada kode unfixed.

**Test Cases**:

1. **Bug 1 — Invalid Date Test**: Render `CustomersSection` dengan mock data `{ created_at: "2025-05-07T10:00:00.000Z" }` → assert bahwa teks "Invalid Date" muncul di DOM (akan pass pada kode unfixed, fail setelah fix)
2. **Bug 1 — Search Result Test**: Render dengan hasil pencarian → assert "Invalid Date" muncul untuk semua baris
3. **Bug 2 — No Image Input Test**: Render `ProductModal` (mode tambah) → assert bahwa tidak ada `<input type="file">` di DOM (akan pass pada kode unfixed)
4. **Bug 2 — Placeholder Hardcode Test**: Submit form tanpa gambar → assert bahwa `image` yang dikirim ke API adalah `/assets/img/placeholder.svg`

**Expected Counterexamples**:
- `new Date(undefined).toLocaleDateString('id-ID')` menghasilkan `"Invalid Date"` bukan tanggal valid
- Form submit mengirim `image: '/assets/img/placeholder.svg'` meskipun tidak ada input gambar dari user

---

### Fix Checking

**Goal**: Verifikasi bahwa untuk semua input di mana bug condition berlaku, fungsi yang sudah diperbaiki menghasilkan perilaku yang benar.

**Pseudocode:**
```
-- Bug 1
FOR ALL customerObject WHERE isBugCondition_Bug1(customerObject) DO
  renderedDate := renderCustomerRow(customerObject).dateCell
  ASSERT renderedDate !== "Invalid Date"
  ASSERT renderedDate MATCHES format "D MMMM YYYY" (id-ID locale)
END FOR

-- Bug 2
FOR ALL formState WHERE isBugCondition_Bug2(formState) DO
  ASSERT imageInputExists(ProductModal)
  ASSERT submitWithNoImages() SHOWS validationError
  ASSERT submitWithImages(urls) SENDS images IN payload
END FOR
```

---

### Preservation Checking

**Goal**: Verifikasi bahwa untuk semua input di mana bug condition TIDAK berlaku, perilaku tetap identik dengan sebelum perbaikan.

**Pseudocode:**
```
-- Bug 1 Preservation
FOR ALL customerObject WHERE NOT isBugCondition_Bug1(customerObject) DO
  ASSERT renderCustomerRow_original(customerObject).nameCell
       = renderCustomerRow_fixed(customerObject).nameCell
  ASSERT renderCustomerRow_original(customerObject).emailCell
       = renderCustomerRow_fixed(customerObject).emailCell
END FOR

-- Bug 2 Preservation
FOR ALL formSubmit WHERE NOT isBugCondition_Bug2(formSubmit) DO
  ASSERT submitProduct_original(formSubmit).nonImageFields
       = submitProduct_fixed(formSubmit).nonImageFields
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Menghasilkan banyak test case otomatis dari domain input
- Menangkap edge case yang mungkin terlewat oleh unit test manual
- Memberikan jaminan kuat bahwa perilaku tidak berubah untuk semua input non-buggy

**Test Cases**:
1. **Customer Column Preservation**: Verifikasi kolom Nama, Email, Telepon tetap ditampilkan benar setelah fix Bug 1
2. **Search Preservation**: Verifikasi pencarian customer tetap memfilter dengan benar setelah fix Bug 1
3. **Product Field Preservation**: Verifikasi field Nama, Kategori, Harga, dll. tetap tersimpan benar setelah fix Bug 2
4. **Delete Preservation**: Verifikasi hapus produk tetap berfungsi setelah fix Bug 2

---

### Unit Tests

- Test render `CustomersSection` dengan `created_at` valid → tanggal terformat benar
- Test render `CustomersSection` dengan `created_at: null` → menampilkan "—"
- Test render `ProductModal` (mode tambah) → ada `<input type="file">`
- Test render `ProductModal` (mode edit dengan gambar) → gambar existing ditampilkan
- Test submit `ProductModal` tanpa gambar → muncul pesan validasi
- Test submit `ProductModal` dengan 9 gambar → ditolak dengan pesan batas maksimal
- Test submit `ProductModal` dengan 1–8 gambar → berhasil, payload berisi array gambar

### Property-Based Tests

- Generate random array customer objects dengan `created_at` valid → semua baris menampilkan tanggal valid (bukan "Invalid Date")
- Generate random customer objects → kolom Nama/Email/Telepon selalu ditampilkan identik sebelum dan sesudah fix
- Generate random product form data dengan 1–8 gambar → semua field non-gambar tersimpan identik
- Generate random product form data → validasi gambar konsisten (0 gambar = error, 1–8 gambar = ok, >8 gambar = error)

### Integration Tests

- Test full flow: load halaman Customer → tampilkan daftar → verifikasi kolom Bergabung menampilkan tanggal valid
- Test full flow: tambah produk baru dengan gambar → produk muncul di daftar dengan gambar benar
- Test full flow: edit produk → gambar existing ditampilkan → ganti gambar → simpan → gambar baru tampil di katalog publik
- Test full flow: cari customer → hasil pencarian menampilkan tanggal bergabung valid
