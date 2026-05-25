/**
 * errorHandler.js — Global Express error handler middleware.
 * Must be mounted as the last middleware in app.js.
 *
 * Requirements: 15.4
 */

import { config } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  // Multer / body-parser payload too large → 422 (Req 9.4)
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(422).json({ ok: false, message: 'Ukuran file maksimal 5 MB.' });
  }

  // Unsupported media type (custom error thrown by upload middleware) → 422 (Req 9.3)
  if (err.status === 415) {
    return res.status(422).json({ ok: false, message: 'Format file tidak didukung. Gunakan PDF, PNG, JPG, JPEG, atau ZIP.' });
  }

  const status = err.status || err.statusCode || 500;
  const message =
    status === 500 && config.isProd
      ? 'Terjadi kesalahan server.'
      : err.message || 'Terjadi kesalahan server.';

  const body = { ok: false, message };
  if (config.isDev && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}
