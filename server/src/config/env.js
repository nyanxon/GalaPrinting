/**
 * env.js — Reads and validates all required environment variables at startup.
 * Exits the process with a descriptive error if any required variable is missing.
 *
 * Requirements: 2.1, 2.2, 2.5
 */

import 'dotenv/config';

const REQUIRED = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

// DB_PASSWORD is allowed to be empty string (XAMPP default), so we only check
// that the key exists in process.env (not that it has a truthy value).
const REQUIRED_PRESENT = ['DB_PASSWORD'];

const missing = REQUIRED.filter((key) => !process.env[key]);
const missingPresent = REQUIRED_PRESENT.filter(
  (key) => !(key in process.env)
);

if (missing.length > 0 || missingPresent.length > 0) {
  const all = [...missing, ...missingPresent];
  console.error(
    `[config] FATAL: Missing required environment variable(s): ${all.join(', ')}\n` +
      'Set these in Hostinger hPanel → Environment Variables.'
  );
  console.error('[config] All current env keys:', Object.keys(process.env).filter(k => !k.startsWith('npm_')).join(', '));
  process.exit(1);
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  uploadDir: process.env.UPLOAD_DIR || './uploads',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,

  email: {
    resendApiKey: process.env.RESEND_API_KEY || null,
    fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@galaprinting.com',
  },

  get isDev() {
    return this.nodeEnv === 'development';
  },
  get isProd() {
    return this.nodeEnv === 'production';
  },
};
