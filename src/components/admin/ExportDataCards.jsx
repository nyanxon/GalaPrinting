/**
 * ExportDataCards.jsx — Dashboard export cards for Super-Admin / Owner.
 *
 * Three cards:
 *   1. Export localStorage  → "localStorage GALA (DATE).zip"
 *   2. Export Database      → "Database GALA (DATE).zip"
 *   3. Export Both          → "LocalStorage + Database GALA (DATE).zip"
 *
 * ZIP is built in-browser using the ZIP format written manually (no extra
 * dependencies). The database snapshot is fetched from GET /api/export/database.
 */

import { useState } from 'react';
import { api } from '../../core/httpClient.js';

/* ─────────────────────────────────────────────────────────────────────────────
   localStorage keys to collect
───────────────────────────────────────────────────────────────────────────── */
const GALA_LS_KEYS = [
  'gala.users',
  'gala.session',
  'gala.products',
  'gala.orders',
  'gala.chats',
  'gala.reviews',
  'gala.analytics.visits',
  'gala.analytics.productViews',
];

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */

/** Returns YYYY-MM-DD string for today */
function dateStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Collect all present gala.* localStorage entries into a plain object */
function collectLocalStorage() {
  const data = {};
  GALA_LS_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null && raw !== '') {
      try { data[key] = JSON.parse(raw); }
      catch { data[key] = raw; }
    }
  });
  return data;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Minimal ZIP builder (no external lib)
   Spec: PKWARE .ZIP format — Local File Header + Data + Central Directory.
   Supports STORE method (no compression) for simplicity & universal support.
───────────────────────────────────────────────────────────────────────────── */

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

function u16le(n) { return [n & 0xff, (n >> 8) & 0xff]; }
function u32le(n) { return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; }

/**
 * Build a ZIP archive in memory.
 * @param {Array<{ name: string, data: Uint8Array }>} files
 * @returns {Uint8Array}
 */
function buildZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const size = data.length;
    const dosDate = 0; // 0 = no date
    const dosTime = 0;

    // Local file header
    const lfh = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,       // signature
      ...u16le(20),                  // version needed: 2.0
      ...u16le(0),                   // general purpose bit flag
      ...u16le(0),                   // compression: STORE
      ...u16le(dosTime),
      ...u16le(dosDate),
      ...u32le(crc),
      ...u32le(size),                // compressed size
      ...u32le(size),                // uncompressed size
      ...u16le(nameBytes.length),
      ...u16le(0),                   // extra field length
      ...nameBytes,
    ]);

    // Central directory header entry (saved for later)
    const cdfh = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,       // signature
      ...u16le(20),                  // version made by
      ...u16le(20),                  // version needed
      ...u16le(0),
      ...u16le(0),                   // STORE
      ...u16le(dosTime),
      ...u16le(dosDate),
      ...u32le(crc),
      ...u32le(size),
      ...u32le(size),
      ...u16le(nameBytes.length),
      ...u16le(0),                   // extra field length
      ...u16le(0),                   // file comment length
      ...u16le(0),                   // disk number start
      ...u16le(0),                   // internal attrs
      ...u32le(0),                   // external attrs
      ...u32le(offset),              // offset of local file header
      ...nameBytes,
    ]);

    parts.push(lfh, data);
    centralDir.push(cdfh);
    offset += lfh.length + data.length;
  }

  // End of central directory record
  const cdSize = centralDir.reduce((s, b) => s + b.length, 0);
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,         // signature
    ...u16le(0),                     // disk number
    ...u16le(0),                     // disk with start of central dir
    ...u16le(files.length),
    ...u16le(files.length),
    ...u32le(cdSize),
    ...u32le(offset),                // offset of central dir
    ...u16le(0),                     // comment length
  ]);

  const allParts = [...parts, ...centralDir, eocd];
  const total = allParts.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const b of allParts) { result.set(b, pos); pos += b.length; }
  return result;
}

/** Encode a plain object to a pretty-printed JSON Uint8Array */
function jsonBytes(obj) {
  return new TextEncoder().encode(JSON.stringify(obj, null, 2));
}

/** Trigger a browser file download */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Export handlers
───────────────────────────────────────────────────────────────────────────── */

async function fetchDatabaseSnapshot() {
  const { data } = await api.get('/api/export/database');
  if (!data.ok) throw new Error('Server menolak permintaan export.');
  return data;
}

async function exportLocalStorage() {
  const ls = collectLocalStorage();
  const count = Object.keys(ls).length;
  if (count === 0) {
    alert('Tidak ada data localStorage (gala.*) yang ditemukan.');
    return;
  }

  const date = dateStr();
  const zipBytes = buildZip([
    { name: 'localStorage.json', data: jsonBytes(ls) },
    {
      name: 'README.txt',
      data: jsonBytes({
        source: 'localStorage GALA',
        exportedAt: new Date().toISOString(),
        keys: Object.keys(ls),
      }),
    },
  ]);

  downloadBlob(
    new Blob([zipBytes], { type: 'application/zip' }),
    `localStorage GALA (${date}).zip`,
  );
}

async function exportDatabase(setLoading) {
  setLoading(true);
  try {
    const snapshot = await fetchDatabaseSnapshot();
    const date = dateStr();
    const tables = snapshot.tables || {};
    const tableCount = Object.values(tables).reduce((s, rows) => s + (rows?.length ?? 0), 0);

    const zipBytes = buildZip([
      { name: 'database.json', data: jsonBytes(tables) },
      {
        name: 'README.txt',
        data: jsonBytes({
          source: 'Database GALA',
          exportedAt: snapshot.exportedAt,
          tableNames: Object.keys(tables),
          totalRows: tableCount,
        }),
      },
    ]);

    downloadBlob(
      new Blob([zipBytes], { type: 'application/zip' }),
      `Database GALA (${date}).zip`,
    );
  } catch (err) {
    console.error('DB export failed:', err);
    alert('Gagal mengambil data database. Pastikan server berjalan dan Anda sudah login.');
  } finally {
    setLoading(false);
  }
}

async function exportBoth(setLoading) {
  setLoading(true);
  try {
    const ls = collectLocalStorage();
    const snapshot = await fetchDatabaseSnapshot();
    const date = dateStr();
    const tables = snapshot.tables || {};
    const lsCount = Object.keys(ls).length;
    const tableCount = Object.values(tables).reduce((s, rows) => s + (rows?.length ?? 0), 0);

    const zipBytes = buildZip([
      { name: 'localStorage.json', data: jsonBytes(ls) },
      { name: 'database.json',     data: jsonBytes(tables) },
      {
        name: 'README.txt',
        data: jsonBytes({
          source: 'LocalStorage + Database GALA',
          exportedAt: new Date().toISOString(),
          localStorage: { keys: Object.keys(ls), keyCount: lsCount },
          database:     { tables: Object.keys(tables), totalRows: tableCount },
        }),
      },
    ]);

    downloadBlob(
      new Blob([zipBytes], { type: 'application/zip' }),
      `LocalStorage + Database GALA (${date}).zip`,
    );
  } catch (err) {
    console.error('Combined export failed:', err);
    alert('Gagal mengambil data database untuk export gabungan. Pastikan server berjalan.');
  } finally {
    setLoading(false);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */

/** Single export card */
function ExportCard({ icon, title, description, buttonLabel, onExport, loading }) {
  return (
    <div className="export-card">
      <div className="export-card-icon" aria-hidden="true">{icon}</div>
      <div className="export-card-body">
        <div className="export-card-title">{title}</div>
        <div className="export-card-desc">{description}</div>
      </div>
      <button
        className="adm-btn adm-btn--primary export-card-btn"
        type="button"
        disabled={loading}
        onClick={onExport}
        aria-label={buttonLabel}
      >
        {loading ? '⏳ Memproses…' : buttonLabel}
      </button>
    </div>
  );
}

export default function ExportDataCards() {
  const [loadingDb,   setLoadingDb]   = useState(false);
  const [loadingBoth, setLoadingBoth] = useState(false);

  return (
    <section className="export-cards-section" aria-labelledby="export-section-title">
      <div className="export-cards-header">
        <div className="export-cards-title" id="export-section-title">📤 Export Data</div>
        <div className="export-cards-sub">
          Download backup data sebagai file <code>.zip</code> ke komputer Anda.
        </div>
      </div>

      <div className="export-cards-grid">
        <ExportCard
          icon="💾"
          title="LocalStorage"
          description="Export semua data sesi lokal (gala.*) yang tersimpan di browser ini."
          buttonLabel="⬇ Export localStorage"
          loading={false}
          onExport={exportLocalStorage}
        />
        <ExportCard
          icon="🗄️"
          title="Database"
          description="Export snapshot seluruh tabel database dari server."
          buttonLabel="⬇ Export Database"
          loading={loadingDb}
          onExport={() => exportDatabase(setLoadingDb)}
        />
        <ExportCard
          icon="📦"
          title="LocalStorage + Database"
          description="Export gabungan data browser lokal dan database server dalam satu file."
          buttonLabel="⬇ Export Semua"
          loading={loadingBoth}
          onExport={() => exportBoth(setLoadingBoth)}
        />
      </div>
    </section>
  );
}
