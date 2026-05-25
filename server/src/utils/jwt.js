/**
 * jwt.js — JWT sign and verify utilities.
 *
 * Requirements: 4.1, 4.4, 4.5
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * Sign an access token.
 * @param {{ sub: string, role: string, name: string, email: string }} payload
 * @returns {string}
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

/**
 * Sign a refresh token.
 * @param {string} userId
 * @param {string} family - UUID identifying the token family
 * @returns {string}
 */
export function signRefreshToken(userId, family) {
  return jwt.sign({ sub: userId, family }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

/**
 * Verify an access token. Throws on invalid/expired.
 * @param {string} token
 * @returns {jwt.JwtPayload}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/**
 * Verify a refresh token. Throws on invalid/expired.
 * @param {string} token
 * @returns {jwt.JwtPayload}
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}
