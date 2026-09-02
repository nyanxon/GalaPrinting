export const APP = {
  name: "Gala Printing",
  locale: "id-ID",
  currency: "IDR",
  apiBase: "/api",
};

// Nomor WhatsApp toko (format internasional tanpa "+"). Dipakai sebagai
// fallback pemesanan ketika stok produk kosong/tidak cukup.
export const WHATSAPP_NUMBER = "6285156234813";

/** Bangun URL wa.me dengan pesan prefilled. */
export function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message || "")}`;
}
