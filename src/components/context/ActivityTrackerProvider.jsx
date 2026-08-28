/**
 * ActivityTrackerProvider.jsx — Mounts the global activity logging listeners.
 *
 * Wires the non-React utils/activityTracker singleton into the app:
 *   - mirrors the current route into the tracker (page path)
 *   - installs the single global click listener (event delegation)
 *   - flushes the remaining queue on page close (sendBeacon)
 *
 * Must be rendered INSIDE <BrowserRouter> so useLocation() works.
 * It renders nothing — purely a side-effect host.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router';
import {
  initActivityTracker,
  setPagePath,
  flushOnExit,
} from '../../utils/activityTracker.js';

export default function ActivityTrackerProvider() {
  const location = useLocation();

  // Keep the tracker's notion of the current page in sync on every navigation.
  useEffect(() => {
    setPagePath(location.pathname + location.search);
  }, [location]);

  // Install the global click listener + page-close flush once.
  useEffect(() => {
    const cleanup = initActivityTracker(() => location.pathname + location.search);
    return () => {
      cleanup();
      try {
        flushOnExit();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
