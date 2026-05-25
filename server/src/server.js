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



async function start() {
  // Verify DB connection before accepting traffic
  await testConnection();

  // Ensure upload directories exist
  await ensureUploadDirs();

  const app    = createApp();
  const server = http.createServer(app);

  // Attach Socket.io
  initSocket(server);

  server.listen(config.port, () => {
    console.log(
      `[server] Running on port ${config.port} (${config.nodeEnv})`
    );
  });
}

start().catch((err) => {
  console.error('[server] Startup error:', err);
  process.exit(1);
});
