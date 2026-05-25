/**
 * hash.js — bcrypt password hashing utilities.
 *
 * Requirements: 4.3
 */

import bcrypt from 'bcrypt';
import { config } from '../config/env.js';

/**
 * Hash a plain-text password.
 * @param {string} plain
 * @returns {Promise<string>}
 */
export function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptRounds);
}

/**
 * Compare a plain-text password against a stored hash.
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
