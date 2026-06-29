/**
 * storage.js — StorageService: disk-based file persistence abstraction.
 * Replacing save/delete with S3/Cloudinary calls requires changes only here.
 *
 * Requirements: 11.1, 11.2, 11.7
 *
 * DEPLOYMENT NOTE (Hostinger):
 * ─────────────────────────────────────────────────────────────────────────────
 * Files stored inside the project directory will be wiped on every git push.
 * To persist uploads, set UPLOAD_DIR to an absolute path OUTSIDE the project:
 *
 *   UPLOAD_DIR=/home/u<account_id>/persistent_uploads
 *
 * Steps on Hostinger:
 *   1. Open File Manager → create folder at /home/u<account_id>/persistent_uploads
 *      with subfolders: designs, payments, chat, avatars, products
 *   2. In hPanel → Node.js → Environment Variables, set:
 *      UPLOAD_DIR=/home/u<account_id>/persistent_uploads
 *   3. Restart the Node.js app.
 *
 * The static serving in app.js already uses the absolute path from config.uploadDir,
 * so /uploads/** will continue to resolve correctly after this change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../config/env.js';

const SUBDIRS = ['designs', 'payments', 'chat', 'avatars', 'products', 'homepage', 'reviews'];

/**
 * Resolve the absolute path to the upload root directory.
 * Supports both absolute paths (e.g. /home/user/persistent_uploads set via
 * UPLOAD_DIR env var) and relative paths (./uploads, for local development).
 */
function resolveUploadRoot() {
  const dir = config.uploadDir;
  // If it's already absolute (starts with / on Linux, or drive letter on Windows),
  // use it as-is. Otherwise resolve relative to cwd.
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
}

/**
 * Ensure all required upload subdirectories exist.
 * Called at server startup.
 */
export async function ensureUploadDirs() {
  const root = resolveUploadRoot();
  for (const sub of SUBDIRS) {
    const dir = path.join(root, sub);
    await fs.mkdir(dir, { recursive: true });
  }
  console.log(`[storage] Upload root: ${root}`);
}

export const StorageService = {
  /**
   * Move a multer temp file to the appropriate upload subdirectory.
   * @param {Express.Multer.File} file
   * @param {'designs'|'payments'|'chat'|'avatars'|'products'} subdir
   * @returns {Promise<{ path: string, url: string, fileName: string }>}
   */
  async save(file, subdir) {
    const ext      = path.extname(file.originalname).toLowerCase();
    const fileName = `${Date.now()}-${randomUUID()}${ext}`;
    const destDir  = path.join(resolveUploadRoot(), subdir);
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
      // Support both relative paths (uploads/avatars/xxx) and absolute paths
      const abs = path.isAbsolute(filePath)
        ? filePath
        : path.join(resolveUploadRoot(), filePath.replace(/^uploads\//, ''));
      await fs.unlink(abs);
    } catch {
      // Silently ignore — file may already be gone
    }
  },
};
