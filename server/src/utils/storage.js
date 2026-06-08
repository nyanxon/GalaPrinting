/**
 * storage.js — StorageService: disk-based file persistence abstraction.
 * Replacing save/delete with S3/Cloudinary calls requires changes only here.
 *
 * Requirements: 11.1, 11.2, 11.7
 */

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/env.js';

const SUBDIRS = ['designs', 'payments', 'chat', 'avatars', 'products'];

/**
 * Ensure all required upload subdirectories exist.
 * Called at server startup.
 */
export async function ensureUploadDirs() {
  for (const sub of SUBDIRS) {
    const dir = path.resolve(process.cwd(), config.uploadDir, sub);
    await fs.mkdir(dir, { recursive: true });
  }
}

export const StorageService = {
  /**
   * Move a multer temp file to the appropriate upload subdirectory.
   * @param {Express.Multer.File} file
   * @param {'designs'|'payments'|'chat'|'avatars'} subdir
   * @returns {Promise<{ path: string, url: string, fileName: string }>}
   */
  async save(file, subdir) {
    const ext      = path.extname(file.originalname).toLowerCase();
    const fileName = `${Date.now()}-${randomUUID()}${ext}`;
    const destDir  = path.resolve(process.cwd(), config.uploadDir, subdir);
    const destPath = path.join(destDir, fileName);

    await fs.mkdir(destDir, { recursive: true });
    // Use copyFile + unlink instead of rename to support cross-device moves
    // (multer writes to /tmp which is a different filesystem on Hostinger)
    await fs.copyFile(file.path, destPath);
    await fs.unlink(file.path).catch(() => {}); // clean up temp file

    return {
      path:     `uploads/${subdir}/${fileName}`,
      url:      `/uploads/${subdir}/${fileName}`,
      fileName,
    };
  },

  /**
   * Delete a file silently (no error if already gone).
   * @param {string} filePath - relative path like 'uploads/payments/...'
   */
  async delete(filePath) {
    try {
      const abs = path.resolve(process.cwd(), filePath);
      await fs.unlink(abs);
    } catch {
      // Silently ignore — file may already be gone
    }
  },
};
