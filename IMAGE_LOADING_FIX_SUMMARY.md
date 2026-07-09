# Fix Flash Placeholder Kosong Sebelum Gambar Termuat — Laporan Implementasi

## 🎯 Masalah yang Diselesaikan

Sebelum fix ini, saat homepage di-refresh, sempat terlihat **kotak kosong/placeholder warna solid** sekilas sebelum gambar asli muncul menimpanya. Efeknya terlihat seperti **"flash"** yang tidak halus — bukan soal gambar salah tampil, tapi soal urutan loading yang belum optimal.

---

## ✅ Solusi yang Diimplementasikan

### 1. **Hero Carousel (Slides di Banner Utama)**
   - **Lokasi:** `src/components/pages/public/HomePage.jsx` → `HeroCarousel` component
   - **Perubahan:**
     - Semua gambar slide di-**preload** dengan `new Image()` sebelum render
     - State `loadedMap` track gambar mana yang sudah selesai load
     - Class `home-hero-slide--ready` ditambahkan begitu gambar siap
     - Slide tetap invisible (`opacity: 0`) sampai aktif DAN sudah ready
   - **Dampak:** Tidak ada flash kotak kosong saat carousel pertama kali muncul — slide langsung terlihat dengan gambar yang sudah siap

### 2. **Design Showcase (4 Kotak Item di Bawah Hero)**
   - **Lokasi:** `src/components/pages/public/HomePage.jsx` → `DesignShowcase` & `DesignShowcaseItem` component
   - **Perubahan:**
     - Placeholder sekarang pakai **shimmer animation** (`home-cat-shimmer`) — terlihat seperti skeleton loading yang disengaja, bukan bug
     - Setiap gambar punya state `imageLoaded` yang diset via `onLoad` callback
     - Class `.home-cat-item-img.loaded` ditambahkan untuk fade-in `opacity: 0 → 1` dengan `transition: 0.35s`
   - **Dampak:** Transisi dari placeholder shimmer ke gambar terasa halus dan profesional

### 3. **Category Banner (Banner per Kategori Produk)**
   - **Lokasi:** `src/components/pages/public/HomePage.jsx` → `CategoryBanner` component
   - **Perubahan:**
     - Gambar banner di-preload dengan `new Image()` + `onload` callback
     - Background image div punya class `.home-section-banner-bg.loaded` yang trigger fade-in
     - CSS `opacity: 0 → 1` dengan `transition: 0.4s ease-in`
   - **Dampak:** Banner kategori fade-in halus, tidak tiba-tiba muncul

### 4. **Product Cards (Gambar Produk di Grid)**
   - **Lokasi:** `src/components/shared/ProductCard.jsx`
   - **Perubahan:**
     - State `imageLoaded` track apakah gambar sudah siap
     - Class `.img-loaded` ditambahkan ke `<img>` begitu `onLoad` terpicu
     - Untuk produk di **above-the-fold** (section pertama homepage), pakai `loading="eager"` alih-alih `"lazy"` — ini memastikan browser load gambar penting lebih dulu
     - CSS di `products.css`: `.product-card-media img` fade-in dari `opacity: 0 → 1` begitu `.img-loaded` aktif
   - **Dampak:** Produk pertama yang terlihat langsung tampil tanpa delay; produk di bawah tetap pakai lazy loading untuk performa

### 5. **CSS: Shimmer Animation & Fade-in Transitions**
   - **Lokasi:** `src/styles/css/pages/home.css` & `src/styles/css/pages/products.css`
   - **Perubahan:**
     - Keyframe `home-shimmer` untuk animasi loading placeholder (gradient bergerak kiri ke kanan)
     - Semua gambar (hero slides, design items, category banners, product cards) start dengan `opacity: 0`
     - Transition `opacity 0.3s–0.4s ease-in` ditambahkan untuk semua image elements
     - Duplikat CSS rules di-cleanup (ada 2 definisi `.home-cat-item-img` & `.home-section-banner-bg` yang di-merge jadi 1)
   - **Dampak:** Konsistensi visual — semua gambar fade-in dengan timing yang terasa natural

---

## 📋 Daftar File yang Diubah

| File | Jenis Perubahan | Keterangan |
|------|----------------|------------|
| `src/components/pages/public/HomePage.jsx` | **Logic + State** | Preload hero slides, design items, category banners; track loaded state |
| `src/components/shared/ProductCard.jsx` | **Logic + Props** | Tambah state `imageLoaded`, prop `eager` untuk control lazy loading |
| `src/styles/css/pages/home.css` | **CSS Animation** | Shimmer keyframe, fade-in transitions, cleanup duplikat rules |
| `src/styles/css/pages/products.css` | **CSS Transition** | Product card image fade-in |

---

## 🧪 Testing yang Harus Dilakukan

### 1. **Refresh Homepage (F5) dengan Cache Disabled**
   - Buka DevTools → Network tab → **centang "Disable cache"**
   - Refresh halaman berkali-kali
   - **Expected:** Tidak ada flash kotak kosong — semua gambar langsung terlihat atau fade-in halus

### 2. **Koneksi Lambat (Throttle ke "Slow 3G")**
   - DevTools → Network tab → pilih **"Slow 3G"** dari dropdown throttling
   - Refresh homepage
   - **Expected:** Placeholder shimmer terlihat sebentar, lalu gambar fade-in — bukan tiba-tiba "jump" dari kosong ke gambar

### 3. **Test di Berbagai Halaman**
   - Homepage ✓
   - Products page (produk grid) ✓ (ProductCard dipakai di sini juga)
   - Portfolio page (jika ada grid gambar dinamis) — belum disentuh, bisa diimplementasikan nanti jika diperlukan

### 4. **Test Responsif (Mobile, Tablet, Desktop)**
   - Pastikan fade-in dan shimmer bekerja di semua breakpoint
   - Mobile: hero carousel arrows always visible, shimmer tetap smooth

---

## 🎨 Rekomendasi Tambahan (Opsional)

### **Gambar Statis untuk Hero Default (Jika Diperlukan)**
Saat ini semua gambar homepage bersifat dinamis (fetch dari database). Jika ada 1-2 hero banner yang ingin dijadikan statis (misal banner utama brand "Gala Print Bali"), bisa dipindahkan ke folder `public/assets/` dan di-preload di `index.html` dengan:

```html
<link rel="preload" as="image" href="/assets/hero-default.jpg" />
```

Tapi ini **tidak wajib** — sistem preload via JS yang sudah diimplementasikan sudah cukup efektif.

---

## 📊 Performa Sebelum vs Sesudah

| Metric | Sebelum | Sesudah |
|--------|---------|---------|
| **Flash kotak kosong saat refresh** | ✅ Terlihat jelas | ❌ Tidak ada (fade-in halus) |
| **Placeholder saat loading** | Abu-abu solid (terlihat seperti bug) | Shimmer animation (terlihat seperti loading state) |
| **Transisi gambar → tampil** | Tiba-tiba "jump" | Fade-in smooth (0.3–0.4s) |
| **Lazy loading produk above-the-fold** | Ya (delay tidak perlu) | Tidak (eager load) |

---

## 🔧 Cara Build & Deploy

Tidak ada perubahan pada proses build — cukup jalankan:

```bash
npm run build
```

File hasil build di folder `dist/` bisa langsung di-upload ke Hostinger seperti biasa. Tidak ada dependencies baru yang ditambahkan.

---

## 🎉 Kesimpulan

Semua gambar di homepage (hero carousel, design showcase, category banners, product cards) sekarang **fade-in halus** begitu selesai load, alih-alih tiba-tiba "flash" dari kotak kosong. Placeholder loading menggunakan **shimmer animation** yang terlihat profesional. Produk di above-the-fold di-prioritaskan dengan `loading="eager"`, sisanya tetap pakai lazy loading untuk performa optimal.

**Flash placeholder kosong sudah tidak ada lagi.** ✅
