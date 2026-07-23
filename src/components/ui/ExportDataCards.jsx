/**
 * ExportDataCards.jsx — Dashboard export cards for Super-Admin / Owner.
 *
 * Three cards:
 *   1. Export File Upload  → "BackupGALA (Photo) DATE.zip"
 *
 *   2. Export Database     → "BackupGALA (DB) DATE.zip"
 *
 *   3. Export Both         → "BackupGALA (Photo + DB) DATE.zip"
 */

import { useState } from 'react';
import { api } from '../../core/httpClient.js';

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */

function dateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Trigger a browser file download from a Blob */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Minimal ZIP builder — used only for the Database card (built in-browser).
   STORE method, no compression, no external dependencies.
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

function buildZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const crc  = crc32(data);
    const size = data.length;

    const lfh = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...u16le(20), ...u16le(0), ...u16le(0),
      ...u16le(0),  ...u16le(0),
      ...u32le(crc), ...u32le(size), ...u32le(size),
      ...u16le(nameBytes.length), ...u16le(0),
      ...nameBytes,
    ]);

    const cdfh = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,
      ...u16le(20), ...u16le(20), ...u16le(0), ...u16le(0),
      ...u16le(0),  ...u16le(0),
      ...u32le(crc), ...u32le(size), ...u32le(size),
      ...u16le(nameBytes.length), ...u16le(0), ...u16le(0),
      ...u16le(0),  ...u16le(0),  ...u32le(0), ...u32le(offset),
      ...nameBytes,
    ]);

    parts.push(lfh, data);
    centralDir.push(cdfh);
    offset += lfh.length + data.length;
  }

  const cdSize = centralDir.reduce((s, b) => s + b.length, 0);
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    ...u16le(0), ...u16le(0),
    ...u16le(files.length), ...u16le(files.length),
    ...u32le(cdSize), ...u32le(offset),
    ...u16le(0),
  ]);

  const all   = [...parts, ...centralDir, eocd];
  const total = all.reduce((s, b) => s + b.length, 0);
  const out   = new Uint8Array(total);
  let pos = 0;
  for (const b of all) { out.set(b, pos); pos += b.length; }
  return out;
}

function jsonBytes(obj) {
  return new TextEncoder().encode(JSON.stringify(obj, null, 2));
}

/* ─────────────────────────────────────────────────────────────────────────────
   Export handlers
───────────────────────────────────────────────────────────────────────────── */

/**
 * Card 1 — Export Upload Files
 * The server reads persistent_uploads, zips everything, and streams the ZIP.
 * The browser just needs to receive the binary and trigger a download.
 */
async function exportUploads(setLoading) {
  setLoading(true);
  try {
    const date = dateStr();
    // Use axios with responseType: 'blob' so we get raw binary
    const res = await api.get('/api/export/uploads', { responseType: 'blob' });
    downloadBlob(res.data, `BackupGALA (Photo) ${date}.zip`);
  } catch (err) {
    const msg =
      err.response?.status === 404
        ? 'Tidak ada file upload yang ditemukan di server.\nPastikan folder persistent_uploads sudah memiliki file.'
        : 'Gagal mengambil file upload dari server. Pastikan server berjalan dan Anda sudah login.';
    alert(msg);
  } finally {
    setLoading(false);
  }
}

/**
 * Card 2 — Export Database
 * Fetch DB snapshot from server, build a ZIP in the browser, download.
 */
async function exportDatabase(setLoading) {
  setLoading(true);
  try {
    const { data } = await api.get('/api/export/database');
    if (!data.ok) throw new Error('Server menolak permintaan export.');

    const date   = dateStr();
    const tables = data.tables || {};
    const totalRows = Object.values(tables).reduce((s, rows) => s + (rows?.length ?? 0), 0);

    const zipBytes = buildZip([
      { name: 'database.json', data: jsonBytes(tables) },
      {
        name: 'README.txt',
        data: jsonBytes({
          source:     'BackupGALA (DB)',
          exportedAt: data.exportedAt,
          tables:     Object.keys(tables),
          totalRows,
        }),
      },
    ]);

    downloadBlob(
      new Blob([zipBytes], { type: 'application/zip' }),
      `BackupGALA (DB) ${date}.zip`,
    );
  } catch (err) {
    console.error('DB export failed:', err);
    alert('Gagal mengambil data database. Pastikan server berjalan dan Anda sudah login.');
  } finally {
    setLoading(false);
  }
}

/**
 * Card 3 — Export Both
 * Server builds one ZIP with Photo/ and DB/ folders, browser just downloads it.
 */
async function exportBoth(setLoading) {
  setLoading(true);
  try {
    const date = dateStr();
    const res  = await api.get('/api/export/all', { responseType: 'blob' });
    downloadBlob(res.data, `BackupGALA (Photo + DB) ${date}.zip`);
  } catch (err) {
    console.error('Combined export failed:', err);
    alert('Gagal export gabungan. Pastikan server berjalan dan Anda sudah login.');
  } finally {
    setLoading(false);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */

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
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [loadingDb,      setLoadingDb]      = useState(false);
  const [loadingBoth,    setLoadingBoth]    = useState(false);

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
          icon="🖼️"
          title="File Upload (Foto)"
          description={
            'Export semua foto yang tersimpan di server — produk, pembayaran, desain, avatar, dan chat.'
          }
          buttonLabel="⬇ Export File Upload"
          loading={loadingUploads}
          onExport={() => exportUploads(setLoadingUploads)}
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
          title="File Upload + Database"
          description="Export semua foto dan data database — dua file ZIP terpisah yang didownload sekaligus."
          buttonLabel="⬇ Export Semua"
          loading={loadingBoth}
          onExport={() => exportBoth(setLoadingBoth)}
        />
      </div>
    </section>
  );
}
