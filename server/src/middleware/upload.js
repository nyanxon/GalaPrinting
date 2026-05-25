/**
 * upload.js — multer middleware configurations per upload type.
 * Returns 413 on size exceeded, 415 on wrong MIME type.
 *
 * Requirements: 11.3, 11.4, 11.5
 */

import multer from 'multer';
import os from 'os';

const ALLOWED_MIME = {
  design:  ['image/jpeg', 'image/png', 'application/pdf'],
  payment: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'application/pdf'],
  chat:    ['image/jpeg', 'image/png', 'application/pdf', 'application/zip'],
  avatar:  ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  product: ['image/jpeg', 'image/png', 'image/webp'],
};

const MAX_SIZE = {
  design:  20 * 1024 * 1024, // 20 MB
  payment: 10 * 1024 * 1024, // 10 MB
  chat:     5 * 1024 * 1024, //  5 MB
  avatar:   5 * 1024 * 1024, //  5 MB
  product: 10 * 1024 * 1024, // 10 MB
};

function buildUpload(type) {
  return multer({
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
}

export const uploadDesign  = buildUpload('design');
export const uploadPayment = buildUpload('payment');
export const uploadChat    = buildUpload('chat');
export const uploadAvatar  = buildUpload('avatar');
export const uploadProduct = buildUpload('product');
