/**
 * upload.controller.js — Handlers for generic file upload endpoints.
 *
 * Each handler follows the same pattern:
 *   1. Verify multer attached a file
 *   2. Persist via StorageService into the given folder
 *   3. Return { ok, path, url, fileName }
 */

import { StorageService } from '../utils/storage.js';

/**
 * Factory: returns an Express handler that saves `req.file` into `folder`.
 *
 * @param {string} folder — subdirectory inside uploads/ (e.g. 'designs', 'payments')
 */
export function createUploadHandler(folder) {
  return async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(422).json({ ok: false, message: 'File wajib diunggah.' });
      }
      const { path, url, fileName } = await StorageService.save(req.file, folder);
      return res.json({ ok: true, path, url, fileName });
    } catch (err) {
      next(err);
    }
  };
}
