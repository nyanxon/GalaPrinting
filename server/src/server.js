/**
 * server.js — HTTP + Socket.io server entry point.
 *
 * Requirements: 2.1
 */

import http from 'http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { testConnection } from './db/connection.js';
import { initSocket } from './socket/index.js';
import { ensureUploadDirs } from './utils/storage.js';
import { ensureHomepageTables } from './db/ensureHomepageTables.js';



async function start() {
  console.log('[server] Starting backend server...');
  console.log(`[server] Environment: ${config.nodeEnv}`);
  console.log(`[server] Port: ${config.port}`);
  console.log(`[server] Client Origin: ${config.clientOrigin}`);

  // Verify DB connection before accepting traffic
  console.log('[server] Testing database connection...');
  await testConnection();

  // Ensure upload directories exist
  console.log('[server] Ensuring upload directories exist...');
  await ensureUploadDirs();

  // Ensure homepage tables exist (auto-creates on first deploy)
  await ensureHomepageTables();

  const app    = createApp();
  const server = http.createServer(app);

  // Attach Socket.io
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`[server] ✓ Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[server] ✓ API endpoints available at http://localhost:${config.port}/api/*`);
  });
}

start().catch((err) => {
  console.error('[server] Startup error:', err);
  process.exit(1);
});
