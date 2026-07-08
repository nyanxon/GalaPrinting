/**
 * start.js — Hostinger-safe entry point.
 *
 * Menggunakan path absolut berdasarkan lokasi file ini,
 * sehingga bisa dijalankan dari working directory manapun.
 */
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Force working directory ke folder server/ agar semua relative imports resolve
process.chdir(__dirname);

// Dinamis import src/server.js menggunakan absolute URL
const serverUrl = pathToFileURL(path.join(__dirname, 'src', 'server.js')).href;
await import(serverUrl);
