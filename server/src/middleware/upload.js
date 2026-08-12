/**
 * upload.js — multer middleware configurations per upload type.
 * Returns 413 on size exceeded, 415 on wrong MIME type.
 *
 * Requirements: 11.3, 11.4, 11.5
 */

import multer from 'multer';
import os from 'os';

const ALLOWED_MIME = {
  design:  ['image/jpeg', 'image/png', 'application/pdf', 'application/zip', 'application/x-zip-compressed'],
  payment: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'application/pdf', 'application/zip', 'application/x-zip-compressed'],
  chat:    ['image/jpeg', 'image/png', 'application/pdf', 'application/zip', 'application/x-zip-compressed'],
  avatar:  ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  product: ['image/jpeg', 'image/png', 'image/webp'],
  review:  ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  homepage: ['image/jpeg', 'image/png', 'image/webp'],
};

const MAX_SIZE = {
  design:  100 * 1024 * 1024, // 100 MB (updated from 20 MB)
  payment: 100 * 1024 * 1024, // 100 MB (updated from 10 MB)
  chat:    100 * 1024 * 1024, // 100 MB (updated from 5 MB)
  avatar:  100 * 1024 * 1024, // 100 MB (updated from 5 MB)
  product: 100 * 1024 * 1024, // 100 MB (updated from 10 MB)
  review:  100 * 1024 * 1024, // 100 MB (updated from 5 MB)
  homepage:  10 * 1024 * 1024, // 10 MB — storefront banners stay lighter
};

function buildUpload(type) {
  const mw = multer({
    dest: os.tmpdir(),
    limits: { fileSize: MAX_SIZE[type] },
    fileFilter(_req, file, cb) {
      if (ALLOWED_MIME[type].includes(file.mimetype)) {
        cb(null, true);
      } else {
        const err = new Error(`Tipe file '${file.mimetype}' tidak didukung untuk upload ${type}.`);
        err.status = 415;
        cb(err, false);
      }
    },
  });

  // Express middleware that also exposes multer's instance methods
  // (.single/.array/.fields/.any/.none), so routes can keep calling
  // e.g. uploadProduct.single('image') exactly like before.
  const wrapped = (req, res, next) => {
    // Expose the actual size limit so the global error handler can report it.
    req.uploadMaxSize = MAX_SIZE[type];
    return mw(req, res, next);
  };
  wrapped.single = mw.single.bind(mw);
  wrapped.array  = mw.array.bind(mw);
  wrapped.fields = mw.fields.bind(mw);
  wrapped.any    = mw.any.bind(mw);
  wrapped.none   = mw.none.bind(mw);
  return wrapped;
}

export const uploadDesign  = buildUpload('design');
export const uploadPayment = buildUpload('payment');
export const uploadChat    = buildUpload('chat');
export const uploadAvatar  = buildUpload('avatar');
export const uploadProduct = buildUpload('product');
export const uploadReview  = buildUpload('review');
export const uploadHomepage = buildUpload('homepage');
