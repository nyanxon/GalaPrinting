import { useState, useEffect, useRef } from 'react';
import { subscribe } from '../../core/toastEmitter.js';
import '../../styles/css/components/toast.css';

/**
 * Toast component — subscribes to toastEmitter, queues messages,
 * displays one at a time, and auto-dismisses after `duration` ms.
 *
 * Rendered once at root level. Always present in the DOM.
 */
export default function Toast() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const timerRef = useRef(null);

  // Subscribe to the emitter on mount, unsubscribe on unmount
  useEffect(() => {
    const unsubscribe = subscribe((toast) => {
      setQueue((prev) => [...prev, toast]);
    });
    return unsubscribe;
  }, []);

  // Whenever the queue changes and nothing is showing, pop the next item
  useEffect(() => {
    if (current === null && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrent(next);
      setQueue(rest);
    }
  }, [queue, current]);

  // Auto-dismiss the current toast after its duration
  useEffect(() => {
    if (current === null) return;

    const duration = current.duration ?? 3000;
    timerRef.current = setTimeout(() => {
      setCurrent(null);
    }, duration);

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [current]);

  const icon =
    current?.type === 'success'
      ? '✓'
      : current?.type === 'error'
      ? '✕'
      : 'ℹ';

  return (
    <div
      id="toast-container"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {current && (
        <div
          className={`toast toast--${current.type ?? 'success'} toast--visible`}
          onClick={() => {
            clearTimeout(timerRef.current);
            setCurrent(null);
          }}
        >
          <span className="toast-icon">{icon}</span>
          <span className="toast-msg">{current.message}</span>
        </div>
      )}
    </div>
  );
}
