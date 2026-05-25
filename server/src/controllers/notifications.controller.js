/**
 * notifications.controller.js — Request handlers for notification preference endpoints.
 *
 * Requirements: 7.2, 7.4
 */

import * as svc from '../services/notifications.service.js';

export async function getPreferences(req, res, next) {
  try {
    const prefs = await svc.getPreferences(req.user.id);
    return res.json({ ok: true, data: prefs });
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const updatedPrefs = await svc.updatePreferences(req.user.id, req.body);
    return res.json({ ok: true, data: updatedPrefs });
  } catch (err) {
    next(err);
  }
}
