# Update Guide untuk Multi-Language

Implementasi i18n telah selesai 80%. Berikut status dan langkah lanjutan:

## ✅ Sudah Selesai

1. **Instalasi Packages**
   - ✅ i18next, react-i18next, i18next-browser-languagedetector

2. **Struktur Folder & Konfigurasi**
   - ✅ src/i18n/index.js
   - ✅ src/i18n/locales/id/translation.json
   - ✅ src/i18n/locales/en/translation.json

3. **Inisialisasi**
   - ✅ Import i18n di main.jsx
   - ✅ Update App.jsx dengan SEO (dynamic html lang)

4. **Komponen LanguageSwitcher**
   - ✅ Component dibuat dengan styling terintegrasi ke Navbar
   - ✅ Styling CSS ditambahkan ke navbar.css

5. **Navbar**
   - ✅ Semua teks hardcoded sudah diganti dengan t()
   - ✅ LanguageSwitcher ditambahkan (desktop & mobile)
   - ✅ Kategori, Search, Cart, Profile, Login popup sudah translated
   - ✅ Secondary nav sudah translated
   - ✅ Mobile sidebar sudah translated

6. **Footer**
   - ✅ Semua teks sudah diganti dengan t()
   - ✅ Links, tagline, social media title sudah translated

## 🔄 Perlu Update (Halaman Public Pages)

Untuk menyelesaikan implementasi, update komponen berikut dengan pattern yang sama:

### HomePage.jsx
Ganti teks hardcoded dengan `t()`:
- "LANDING PAGE", "4+ PAGE" → t('home.heroLabel'), t('home.heroSub')
- "Hallo, Mau Pesan apa?" → t('home.greeting'), t('home.whatToPrint')
- "Cari semua produk disini..." → t('home.searchPlaceholder')
- "Custom Order" → t('home.customOrder')
- "Belum ada produk" → t('home.noProducts')
- dll.

### TentangKamiPage.jsx
- "Tentang Kami" → t('about.title')
- "Gala Printing" → t('about.companyName')
- "Lihat Produk" → t('about.viewProducts')
- dll.

### CaraOrderPage.jsx
- "Cara Order" → t('howToOrder.title')
- "Pilih produk" → t('howToOrder.step1')
- "Mulai Belanja" → t('howToOrder.startShopping')
- dll.

### PortfolioPage.jsx
- "Portofolio" → t('portfolio.title')
- "Stiker", "Brosur", dll → t('portfolio.sticker'), t('portfolio.brochure')
- dll.

### ProductsPage.jsx
- "Katalog Produk" → t('products.title')
- "Cari produk..." → t('products.searchPlaceholder')
- "Reset" → t('products.reset')
- dll.

### StatusOrderPage.jsx
- "Status Order" → t('orderStatus.title')
- "Nomor Transaksi" → t('orderStatus.orderNumber')
- "Cek Status Order" → t('orderStatus.checkButton')
- dll.

## Pattern Update

```jsx
// 1. Import useTranslation
import { useTranslation } from 'react-i18next';

// 2. Destructure t() di dalam component
function MyPage() {
  const { t } = useTranslation();
  
  // 3. Ganti hardcoded text dengan t()
  return (
    <h1>{t('about.title')}</h1>
    <p>{t('about.description')}</p>
  );
}
```

## Testing Checklist

Setelah semua update selesai:

1. ✅ Install packages berhasil
2. ⏳ Build production (`npm run build`) → perlu dicek setelah update komponen
3. ⏳ Ganti bahasa berjalan tanpa reload
4. ⏳ Pilihan bahasa tersimpan setelah refresh (localStorage)
5. ⏳ Tidak ada teks hardcoded yang tersisa
6. ⏳ Layout tidak rusak saat teks EN lebih panjang/pendek

## File JSON Translation

Semua key sudah tersedia di:
- `src/i18n/locales/id/translation.json` (Bahasa Indonesia)
- `src/i18n/locales/en/translation.json` (English)

Key sudah di-namespace per section untuk kemudahan:
- `nav.*` → Navigasi
- `auth.*` → Authentication
- `cart.*` → Keranjang
- `home.*` → Homepage
- `about.*` → Tentang Kami
- `howToOrder.*` → Cara Order
- `portfolio.*` → Portfolio
- `products.*` → Products
- `orderStatus.*` → Status Order
- `footer.*` → Footer

## Next Steps

Untuk menyelesaikan implementasi:

1. Update setiap halaman public dengan pattern di atas
2. Test setiap halaman setelah update
3. Run build production
4. Test keseluruhan flow

Estimasi: 1-2 jam untuk update semua halaman public yang tersisa.
