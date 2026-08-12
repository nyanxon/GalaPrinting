/**
 * features.js — Registry master semua fitur/menu yang ada di sistem SAAT INI.
 *
 * Dipakai oleh (ke depan): sistem permission dinamis — Owner mengatur fitur
 * apa saja yang boleh diakses sebuah akun via dashboard.
 *
 * Tahap ini (Step 2) murni deklarasi: TIDAK ada import ke route/controller
 * manapun. Satu-satunya consumer saat ini adalah seed script
 * (src/db/seedFeatures.js) yang mengisi tabel `features`.
 *
 * Struktur:
 *   FEATURE_CATEGORIES[KEY] = {
 *     category: 'Nama Kategori',      // pengelompokan di UI Owner
 *     features: [
 *       { key, label, description? },  // key = feature_key tersimpan di DB
 *     ]
 *   }
 */

export const FEATURE_CATEGORIES = {
  DASHBOARD: {
    category: 'Dashboard',
    features: [
      { key: 'dashboard.view', label: 'Lihat Dashboard', description: 'Melihat halaman utama dashboard beserta aktivitas terbaru.' },
    ],
  },

  ORDERS: {
    category: 'Orders',
    features: [
      { key: 'orders.view', label: 'Lihat Pesanan', description: 'Melihat daftar dan detail semua pesanan.' },
      { key: 'orders.create', label: 'Buat Pesanan', description: 'Membuat pesanan baru (online / custom customer).' },
      { key: 'orders.custom', label: 'Custom Order', description: 'Membuat custom order untuk customer terdaftar.' },
      { key: 'orders.offline', label: 'Order Offline', description: 'Membuat pesanan offline di toko.' },
      { key: 'orders.update_status', label: 'Update Status Pesanan', description: 'Mengubah status pesanan (misal ke Quality Checking / In Delivery).' },
      { key: 'orders.update_note', label: 'Catatan Admin', description: 'Menambah/mengubah catatan admin pada pesanan.' },
      { key: 'orders.update_tracking', label: 'Update No. Resi', description: 'Mengisi nomor resi pengiriman pada pesanan.' },
      { key: 'orders.update_delivery', label: 'Atur Metode Pengiriman', description: 'Mengatur metode pengiriman (ambil sendiri / kurir).' },
      { key: 'orders.update_pickup', label: 'Atur Info Pickup', description: 'Mengatur informasi pickup pesanan.' },
      { key: 'orders.delete', label: 'Hapus Pesanan', description: 'Menghapus pesanan yang tidak valid.' },
      { key: 'orders.upload_design', label: 'Upload Desain', description: 'Mengupload file desain untuk pesanan.' },
      { key: 'orders.upload_payment', label: 'Upload Bukti Bayar', description: 'Mengupload bukti pembayaran pesanan.' },
    ],
  },

  INVOICES: {
    category: 'Invoices',
    features: [
      { key: 'invoices.view', label: 'Lihat Invoice', description: 'Melihat daftar dan detail invoice.' },
      { key: 'invoices.manage', label: 'Kelola Invoice', description: 'Membuat, mengubah, dan mengatur status pembayaran invoice.' },
      { key: 'invoices.pdf', label: 'Unduh PDF Invoice', description: 'Mengunduh invoice dalam bentuk PDF.' },
    ],
  },

  CUSTOMERS: {
    category: 'Customers',
    features: [
      { key: 'customers.view', label: 'Lihat Customer', description: 'Melihat daftar customer terdaftar.' },
    ],
  },

  PRODUCTS: {
    category: 'Products',
    features: [
      { key: 'products.view', label: 'Lihat Produk', description: 'Melihat daftar dan detail produk.' },
      { key: 'products.manage', label: 'Kelola Produk', description: 'Membuat, mengubah, dan menghapus produk.' },
      { key: 'products.upload_image', label: 'Upload Gambar Produk', description: 'Mengupload gambar untuk produk.' },
    ],
  },

  CATEGORIES: {
    category: 'Categories',
    features: [
      { key: 'categories.view', label: 'Lihat Kategori', description: 'Melihat daftar kategori produk.' },
      { key: 'categories.manage', label: 'Kelola Kategori', description: 'Membuat, mengubah, dan menghapus kategori.' },
    ],
  },

  REVIEWS: {
    category: 'Reviews',
    features: [
      { key: 'reviews.view', label: 'Lihat Review', description: 'Melihat daftar review produk.' },
      { key: 'reviews.delete', label: 'Hapus Review', description: 'Menghapus review dari customer.' },
    ],
  },

  CHATS: {
    category: 'Chats',
    features: [
      { key: 'chats.view', label: 'Chat Customer', description: 'Melihat dan membalas percakapan dengan customer.' },
      { key: 'chats.manage', label: 'Kelola Chat', description: 'Menyembunyikan / mengelola percakapan chat.' },
    ],
  },

  DM: {
    category: 'DM',
    features: [
      { key: 'dm.view', label: 'Pesan Staff', description: 'Melihat dan mengirim pesan antar staff (DM).' },
    ],
  },

  PROMO: {
    category: 'Promo',
    features: [
      { key: 'promo.view', label: 'Lihat Promo', description: 'Melihat daftar kode promo beserta statistiknya.' },
      { key: 'promo.manage', label: 'Kelola Promo', description: 'Membuat, mengubah, dan menghapus kode promo.' },
    ],
  },

  HOMEPAGE: {
    category: 'Homepage',
    features: [
      { key: 'homepage.manage', label: 'Kelola Homepage', description: 'Mengubah konten homepage: hero banner & item desain.' },
    ],
  },

  ACCOUNTS: {
    category: 'Accounts',
    features: [
      { key: 'accounts.view', label: 'Lihat Akun', description: 'Melihat daftar semua akun dan detail permission-nya.' },
      { key: 'accounts.manage', label: 'Kelola Akun & Permission', description: 'Mengubah role & permission akun staff.' },
    ],
  },

  REVENUE: {
    category: 'Revenue',
    features: [
      { key: 'revenue.view', label: 'Lihat Revenue', description: 'Melihat rekap harian dan data revenue.' },
      { key: 'revenue.daily_recap', label: 'Rekap Harian', description: 'Melihat rekap pendapatan harian (kasir).' },
      { key: 'revenue.manage', label: 'Transaksi Manual', description: 'Membuat/mengubah/menghapus transaksi manual.' },
      { key: 'revenue.export', label: 'Export Revenue', description: 'Mengunduh data revenue (CSV/Excel/PDF).' },
      { key: 'revenue.reset', label: 'Reset Data Revenue', description: 'Menghapus seluruh data revenue (hanya Owner).' },
    ],
  },

  REPORTS: {
    category: 'Reports',
    features: [
      { key: 'reports.view', label: 'Lihat Laporan', description: 'Melihat laporan bulanan, statistik, dan mengunduh laporan.' },
    ],
  },

  ANALYTICS: {
    category: 'Analytics',
    features: [
      { key: 'analytics.view', label: 'Lihat Analytics', description: 'Melihat statistik kunjungan, produk dilihat, dan best seller.' },
      { key: 'analytics.reset', label: 'Reset Data Analytics', description: 'Menghapus data analytics (hanya Owner).' },
    ],
  },

  EXPORT: {
    category: 'Export',
    features: [
      { key: 'export.database', label: 'Export Database', description: 'Mengunduh snapshot seluruh database (JSON).' },
      { key: 'export.uploads', label: 'Export File Upload', description: 'Mengunduh semua file upload (ZIP).' },
      { key: 'export.all', label: 'Export Semua Data', description: 'Mengunduh satu paket lengkap database + file upload.' },
    ],
  },

  OFFLINE: {
    category: 'Offline',
    features: [
      { key: 'offline.new_order', label: 'Buat Pesanan Baru', description: 'Membuat pesanan baru dari dashboard offline.' },
      { key: 'offline.order_list', label: 'Daftar Pesanan', description: 'Melihat daftar pesanan dari dashboard offline.' },
    ],
  },
};

/**
 * Daftar flat semua fitur untuk kebutuhan seed & iterasi UI.
 * @type {Array<{ key: string, label: string, category: string, description?: string }>}
 */
export const ALL_FEATURES = Object.values(FEATURE_CATEGORIES).flatMap(
  (group) =>
    group.features.map((f) => ({
      key: f.key,
      label: f.label,
      category: group.category,
      description: f.description ?? null,
    }))
);
