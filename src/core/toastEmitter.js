/**
 * core/toastEmitter.js — Module-level pub/sub for toast notifications.
 * No React dependencies — service-layer code can call showToast() freely.
 */

const listeners = new Set();

/**
 * Emit a toast notification to all registered listeners.
 * @param {string} message
 * @param {"success"|"error"|"info"} [type="success"]
 * @param {number} [duration=3000]
 */
export function showToast(message, type = 'success', duration = 3000) {
  listeners.forEach((cb) => cb({ message, type, duration }));
}

/**
 * Register a listener for toast events.
 * @param {(toast: { message: string, type: string, duration: number }) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribe(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
