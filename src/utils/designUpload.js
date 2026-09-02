/**
 * designUpload.js — Batas upload file desain, mirror dari
 * server/src/middleware/upload.js (ALLOWED_MIME.design & MAX_SIZE.design).
 *
 * SUMBER KEBENARAN: server/src/middleware/upload.js. Jika batas server diubah,
 * nilai di bawah WAJIB ikut disesuaikan — lihat juga test parity
 * src/test/designUpload.config.test.js.
 */

export const DESIGN_ACCEPT =
  'image/jpeg,image/png,application/pdf,application/zip,application/x-zip-compressed';

export const DESIGN_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export const DESIGN_HINT = 'JPG, PNG, PDF · Maks. 100 MB';