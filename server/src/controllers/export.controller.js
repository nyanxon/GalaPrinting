/**
 * export.controller.js — Owner-only endpoints to export data.
 *
 * GET /api/export/database — full DB snapshot as JSON
 * GET /api/export/uploads  — all uploaded files as a ZIP
 * GET /api/export/all      — one ZIP with two folders: Photo/ and DB/
 *
 * Security: authenticate + requireRole('owner', 'admin') applied on routes.
 */

import fsp from 'fs/promises';
import path from 'path';
import { query } from '../db/connection.js';
import { config } from '../config/env.js';
import { SUBDIRS } from '../utils/storage.js';

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

function resolveUploadRoot() {
  const dir = config.uploadDir;
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
}

/* ─────────────────────────────────────────────────────────────
   Minimal ZIP builder (STORE — no compression, pure Node.js)
   Mirrors the same format used in the frontend ExportDataCards.
───────────────────────────────────────────────────────────── */

function crc32(buf) {
  const TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; }

/**
 * Build a ZIP buffer from an array of { name, data } entries.
 * @param {Array<{ name: string, data: Buffer }>} files
 * @returns {Buffer}
 */
function buildZipBuffer(files) {
  const localHeaders = [];
  const centralDirs  = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc     = crc32(data);
    const size    = data.length;

    const lfh = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      u16(20),   // version needed
      u16(0),    // flags
      u16(0),    // compression: STORE
      u16(0),    // mod time
      u16(0),    // mod date
      u32(crc),
      u32(size), // compressed size
      u32(size), // uncompressed size
      u16(nameBuf.length),
      u16(0),    // extra length
      nameBuf,
    ]);

    const cdfh = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      u16(20), u16(20), u16(0), u16(0),
      u16(0), u16(0),
      u32(crc),
      u32(size), u32(size),
      u16(nameBuf.length),
      u16(0), u16(0), u16(0), u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]);

    localHeaders.push(lfh, data);
    centralDirs.push(cdfh);
    offset += lfh.length + data.length;
  }

  const cdBuf  = Buffer.concat(centralDirs);
  const eocd   = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(cdBuf.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...localHeaders, cdBuf, eocd]);
}

/* ─────────────────────────────────────────────────────────────
   Collect all files under upload root recursively
───────────────────────────────────────────────────────────── */

/**
 * Walk a directory and return all files as { zipName, absPath }.
 * zipName uses forward slashes so the ZIP is cross-platform.
 *
 * @param {string} baseDir   - absolute path to scan
 * @param {string} zipPrefix - prefix inside ZIP (e.g. "uploads/")
 */
async function collectFiles(baseDir, zipPrefix) {
  const results = [];
  async function walk(dir, prefix) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return; // directory doesn't exist — skip
    }
    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      const zipName = `${prefix}${entry.name}`;
      if (entry.isDirectory()) {
        await walk(absPath, `${zipName}/`);
      } else if (entry.isFile()) {
        results.push({ zipName, absPath });
      }
    }
  }
  await walk(baseDir, zipPrefix);
  return results;
}

/* ─────────────────────────────────────────────────────────────
   Controllers
───────────────────────────────────────────────────────────── */

/** Tables to include in the database export */
const EXPORT_TABLES = [
  'users',
  'categories',
  'products',
  'orders',
  'order_items',
  'order_history',
  'order_approvals',
  'cart_items',
  'conversations',
  'messages',
  'reviews',
  'analytics_visits',
  'analytics_product_views',
  'refresh_tokens',
  'promo_codes',
  'addresses',
  'notifications',
  'invoices',
  'invoice_sequence',
];

/**
 * GET /api/export/database
 * Returns a JSON snapshot of all DB tables.
 */
export async function exportDatabase(_req, res, next) {
  try {
    const snapshot = {};
    for (const table of EXPORT_TABLES) {
      try {
        const [rows] = await query(`SELECT * FROM \`${table}\``);
        snapshot[table] = rows;
      } catch {
        snapshot[table] = [];
      }
    }
    return res.json({
      ok: true,
      exportedAt: new Date().toISOString(),
      tables: snapshot,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/export/uploads
 * Streams a ZIP archive of all files inside the upload directory.
 * Structure inside ZIP: uploads/<subdir>/<filename>
 */
export async function exportUploads(_req, res, next) {
  try {
    const uploadRoot = resolveUploadRoot();
    const date = new Date().toISOString().slice(0, 10);

    // Collect all files across all subdirs
    const allFiles = [];
    for (const sub of SUBDIRS) {
      const subDir = path.join(uploadRoot, sub);
      const files  = await collectFiles(subDir, `uploads/${sub}/`);
      allFiles.push(...files);
    }

    if (allFiles.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Tidak ada file upload yang ditemukan di server.',
      });
    }

    // Read all files into memory and build ZIP
    // (for very large deployments a streaming ZIP would be better,
    //  but this is sufficient for typical Hostinger usage)
    const zipEntries = await Promise.all(
      allFiles.map(async ({ zipName, absPath }) => {
        const data = await fsp.readFile(absPath);
        return { name: zipName, data };
      })
    );

    // Add a manifest
    const manifest = {
      exportedAt: new Date().toISOString(),
      totalFiles: zipEntries.length,
      files: allFiles.map((f) => f.zipName),
    };
    zipEntries.push({
      name: 'manifest.json',
      data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
    });

    const zipBuf = buildZipBuffer(zipEntries);
    const filename = `BackupGALA (Photo) ${date}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Content-Length', zipBuf.length);
    return res.end(zipBuf);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/export/all
 * One ZIP file with two top-level folders:
 *   Photo/designs/…
 *   Photo/payments/…
 *   Photo/chat/…
 *   Photo/avatars/…
 *   Photo/products/…
 *   DB/database.json
 *   DB/README.txt
 *   manifest.json
 */
export async function exportAll(_req, res, next) {
  try {
    const uploadRoot = resolveUploadRoot();
    const date       = new Date().toISOString().slice(0, 10);
    const exportedAt = new Date().toISOString();
    const zipEntries = [];

    // ── Folder Photo ────────────────────────────────────────
    const photoFiles = [];
    for (const sub of SUBDIRS) {
      const subDir = path.join(uploadRoot, sub);
      const files  = await collectFiles(subDir, `Photo/${sub}/`);
      photoFiles.push(...files);
    }

    await Promise.all(
      photoFiles.map(async ({ zipName, absPath }) => {
        const data = await fsp.readFile(absPath);
        zipEntries.push({ name: zipName, data });
      }),
    );

    // ── Folder DB ───────────────────────────────────────────
    const snapshot = {};
    for (const table of EXPORT_TABLES) {
      try {
        const [rows] = await query(`SELECT * FROM \`${table}\``);
        snapshot[table] = rows;
      } catch {
        snapshot[table] = [];
      }
    }
    const totalRows = Object.values(snapshot).reduce((s, r) => s + (r?.length ?? 0), 0);

    zipEntries.push({
      name: 'DB/database.json',
      data: Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8'),
    });
    zipEntries.push({
      name: 'DB/README.txt',
      data: Buffer.from(
        JSON.stringify({
          source:     'BackupGALA (Photo + DB)',
          exportedAt,
          tables:     Object.keys(snapshot),
          totalRows,
        }, null, 2),
        'utf8',
      ),
    });

    // ── manifest.json ───────────────────────────────────────
    zipEntries.push({
      name: 'manifest.json',
      data: Buffer.from(
        JSON.stringify({
          exportedAt,
          photo: {
            totalFiles: photoFiles.length,
            files: photoFiles.map((f) => f.zipName),
          },
          db: {
            tables:    Object.keys(snapshot),
            totalRows,
          },
        }, null, 2),
        'utf8',
      ),
    });

    const zipBuf  = buildZipBuffer(zipEntries);
    const filename = `BackupGALA (Photo + DB) ${date}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Content-Length', zipBuf.length);
    return res.end(zipBuf);
  } catch (err) {
    next(err);
  }
}
