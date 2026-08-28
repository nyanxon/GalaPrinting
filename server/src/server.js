/**
 * server.js — HTTP + Socket.io server entry point.
 *
 * Requirements: 2.1
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { testConnection } from './db/connection.js';
import { initSocket } from './socket/index.js';
import { ensureUploadDirs } from './utils/storage.js';
import { ensureHomepageTables } from './db/ensureHomepageTables.js';
import { startActivityLogPurgeJob } from './jobs/activityLogPurge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Startup diagnostic log (writes to file in case hPanel log is unavailable) ──
const DIAG_PATH = path.resolve(__dirname, '../../startup-diag.log');
function diagLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(DIAG_PATH, line); } catch { /* ignore */ }
}

async function start() {
  diagLog('[server] Starting backend server...');
  diagLog(`[server] Node.js: ${process.version}`);
  diagLog(`[server] CWD: ${process.cwd()}`);
  diagLog(`[server] Environment: ${config.nodeEnv}`);
  diagLog(`[server] Port: ${config.port}`);
  diagLog(`[server] Client Origin: ${config.clientOrigin}`);

  // Verify DB connection before accepting traffic
  diagLog('[server] Testing database connection...');
  await testConnection();

  // Ensure upload directories exist
  diagLog('[server] Ensuring upload directories exist...');
  await ensureUploadDirs();

  // Ensure homepage tables exist (auto-creates on first deploy)
  diagLog('[server] Ensuring homepage tables...');
  await ensureHomepageTables();

  // Start the Activity Log auto-retention job (best-effort; never fatal).
  try {
    startActivityLogPurgeJob();
    diagLog('[server] Activity Log auto-retention job started.');
  } catch (err) {
    diagLog(`[server] WARN: watchActivityLogPurgeJob failed to start: ${err.message}`);
  }

  diagLog('[server] Creating Express app...');
  const app    = createApp();
  const server = http.createServer(app);

  // Attach Socket.io
  diagLog('[server] Attaching Socket.io...');
  initSocket(server);

  server.listen(config.port, () => {
    diagLog(`[server] ✓ Server running on port ${config.port} (${config.nodeEnv})`);
    diagLog(`[server] ✓ API available at http://localhost:${config.port}/api/*`);
  });
}

start().catch((err) => {
  diagLog(`[server] STARTUP ERROR: ${err.stack || err.message}`);
  console.error('[server] Startup error:', err);
  process.exit(1);
});
