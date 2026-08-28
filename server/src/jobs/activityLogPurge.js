/**
 * jobs/activityLogPurge.js — Scheduled auto-retention for the Activity Log.
 *
 * Reads the persisted `activity_log_retention_months` setting and periodically
 * deletes logs older than the configured cutoff. When the setting is OFF (0),
 * the job is a no-op.
 *
 * The job is started from the server entry (server.js) after the DB connection
 * is confirmed. Uses a plain setInterval (node-cron is not a dependency).
 */

import { purgeOldLogs } from '../services/activityLog.service.js';

const RUN_ONCE_AFTER_MS = 60 * 1000;   // first purge ~1 min after boot
const RUN_EVERY_MS      = 60 * 60 * 1000; // then every hour

let timer = null;
let firstRun = null;

async function run() {
  try {
    const deleted = await purgeOldLogs();
    if (deleted) {
      console.log(`[activity-log] auto-retention purged ${deleted} rows`);
    }
  } catch (err) {
    // Retention is best-effort — never crash the app if it fails.
    console.error('[activity-log] auto-retention purge failed:', err?.message);
  }
}

/**
 * Start the scheduled purge job (idempotent).
 */
export function startActivityLogPurgeJob() {
  if (timer) return;
  firstRun = setTimeout(run, RUN_ONCE_AFTER_MS);
  timer = setInterval(run, RUN_EVERY_MS);
  firstRun.unref?.();
  timer.unref?.();
}

/**
 * Stop the scheduled purge job (mainly for tests / clean shutdown).
 */
export function stopActivityLogPurgeJob() {
  if (firstRun) {
    clearTimeout(firstRun);
    firstRun = null;
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
