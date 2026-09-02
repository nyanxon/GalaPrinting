// Parity: konstanta upload desain frontend harus mirror dengan batas server
// (server/src/middleware/upload.js → ALLOWED_MIME.design & MAX_SIZE.design).
// Guard: jika batas server dirubah, konstanta di src/utils/designUpload.js
// (dan test ini) wajib ikut disesuaikan agar validasi client-server konsisten.
import { describe, it, expect } from 'vitest';
import { DESIGN_ACCEPT, DESIGN_MAX_SIZE, DESIGN_HINT } from '../utils/designUpload.js';

describe('designUpload config parity', () => {
  it('mengekspos daftar MIME yang cocok dengan upload.js design', () => {
    const types = DESIGN_ACCEPT.split(',').map((s) => s.trim());
    expect(types).toEqual([
      'image/jpeg',
      'image/png',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
    ]);
  });

  it('mengekspos batas 100 MB yang cocok dengan MAX_SIZE.design', () => {
    expect(DESIGN_MAX_SIZE).toBe(100 * 1024 * 1024);
  });

  it('mengekspos hint yang memuat tipe & ukuran', () => {
    expect(DESIGN_HINT).toContain('100 MB');
    expect(DESIGN_HINT.toLowerCase()).toContain('jpg');
    expect(DESIGN_HINT.toLowerCase()).toContain('png');
    expect(DESIGN_HINT.toLowerCase()).toContain('pdf');
  });
});