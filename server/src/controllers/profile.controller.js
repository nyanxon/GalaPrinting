/**
 * profile.controller.js — Request handlers for customer profile endpoints.
 *
 * Requirements: 2.3, 2.4, 2.5, 3.6, 9.2
 */

import * as svc from '../services/profile.service.js';

export async function getProfile(req, res, next) {
  try {
    const profile = await svc.getProfile(req.user.id);
    return res.json({ ok: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const updatedProfile = await svc.updateProfile(req.user.id, req.body);
    return res.json({ ok: true, data: updatedProfile });
  } catch (err) {
    if (err.status === 422) {
      return res.status(422).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function uploadAvatar(req, res, next) {
  if (!req.file) {
    return res.status(422).json({ ok: false, message: 'File gambar wajib diunggah.' });
  }

  try {
    const updatedProfile = await svc.uploadAvatar(req.user.id, req.file);
    return res.json({ ok: true, data: updatedProfile });
  } catch (err) {
    next(err);
  }
}
