/**
 * useLogUnreadBadge.js — Polls the Activity Log unread count for the current
 * admin/owner reader and exposes a `refresh()` used by the ActivityLogSection
 * whenever logs are marked read.
 *
 * The unread badge is per-reader (server: activity_log_reads keyed by user id),
 * so only admin/owner viewers should call this. Availability is left to the
 * caller via the `enabled` flag.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getUnreadLogCount } from '../services/activityLog.js';

const POLL_MS = 30_000;
const REFRESH_EVENT = 'gala:log-read';

export default function useLogUnreadBadge(enabled) {
  const [unreadCount, setUnreadCount] = useState(0);
  const enabledRef = useRef(enabled);

  const refresh = useCallback(async () => {
    if (!enabledRef.current) return;
    try {
      const count = await getUnreadLogCount();
      setUnreadCount(count);
    } catch {
      // Best-effort — badge disappearing on transient errors is fine.
    }
  }, []);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();

    const timer = setInterval(refresh, POLL_MS);

    function handleRefresh() { refresh(); }
    window.addEventListener(REFRESH_EVENT, handleRefresh);

    return () => {
      clearInterval(timer);
      window.removeEventListener(REFRESH_EVENT, handleRefresh);
    };
  }, [enabled, refresh]);

  return { unreadCount, refresh };
}

export { REFRESH_EVENT };
