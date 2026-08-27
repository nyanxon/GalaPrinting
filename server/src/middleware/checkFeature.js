/**
 * checkFeature.js — Feature-level access guard (dynamic permission).
 *
 * Dipasang per-endpoint yang membutuhkan fitur spesifik. Aturan (Step 4):
 *   - Kalau akun bukan promoted admin (is_promoted_admin = false) → SKIP,
 *     akun tetap diatur oleh sistem role lama (requireRole).
 *   - Kalau akun promoted admin → cek granted di admin_permissions
 *     untuk feature_key yang diminta; kalau granted → lanjut, kalau tidak → 403.
 *
 * CATATAN: `authenticate` hanya mengisi req.user = { id, role, name, email }
 * tanpa `is_promoted_admin`, jadi middleware ini membaca flag-nya langsung
 * dari tabel `users`.
 *
 * BELUM dipasang ke endpoint manapun (keputusan Step 4: dibangun terpisah
 * dan diuji unit dulu).
 */

import { query } from '../db/connection.js';

/**
 * @param {string} featureKey — key dari config/features.js (mis. 'orders.view')
 * @returns {import('express').RequestHandler}
 */
export function checkFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          ok: false,
          message: 'Token tidak valid atau sudah kedaluwarsa.',
        });
      }

      // 1) Apakah akun ini promoted admin?
      const [userRows] = await query(
        'SELECT is_promoted_admin FROM users_admin WHERE id = ? AND deleted_at IS NULL',
        [userId]
      );
      const user = userRows[0];
      if (!user) {
        return res.status(401).json({
          ok: false,
          message: 'Token tidak valid atau sudah kedaluwarsa.',
        });
      }

      // 2) Bukan promoted admin → biarkan sistem role lama yang menangani.
      if (!user.is_promoted_admin) {
        return next();
      }

      // 3) Promoted admin → cek permission fitur.
      const [permRows] = await query(
        'SELECT granted FROM admin_permissions WHERE user_id = ? AND feature_key = ?',
        [userId, featureKey]
      );
      const perm = permRows[0];

      if (perm && Boolean(perm.granted)) {
        return next();
      }

      return res.status(403).json({
        ok: false,
        message: 'Anda tidak memiliki akses ke fitur ini.',
      });
    } catch (err) {
      next(err);
    }
  };
}

export default checkFeature;
