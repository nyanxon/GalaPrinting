// Feature: vanilla-to-react-migration, Property 7: Toast auto-dismiss
// Feature: vanilla-to-react-migration, Property 12: Toast accessibility attributes
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import * as fc from 'fast-check';
import Toast from '../components/ui/Toast.jsx';
import { showToast } from '../core/toastEmitter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reset the toastEmitter between tests by unsubscribing all listeners.
 * We do this by re-importing the module — but since ESM modules are cached,
 * we instead rely on the Toast component's own subscribe/unsubscribe lifecycle.
 * Each render mounts a fresh Toast that subscribes, and unmount unsubscribes.
 */

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('Toast', () => {
  it('renders the container even when no toast is showing', () => {
    const { container } = render(<Toast />);
    const toastContainer = container.querySelector('#toast-container');
    expect(toastContainer).not.toBeNull();
  });

  it('shows a toast message after showToast is called', async () => {
    render(<Toast />);
    act(() => {
      showToast('Hello world', 'success', 3000);
    });
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('dismisses the toast after the duration elapses', async () => {
    vi.useFakeTimers();
    render(<Toast />);

    act(() => {
      showToast('Bye world', 'info', 500);
    });

    expect(screen.getByText('Bye world')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText('Bye world')).toBeNull();
    vi.useRealTimers();
  });

  it('container always has role="status" and aria-live="polite"', () => {
    const { container } = render(<Toast />);
    const toastContainer = container.querySelector('#toast-container');
    expect(toastContainer.getAttribute('role')).toBe('status');
    expect(toastContainer.getAttribute('aria-live')).toBe('polite');
  });
});

// ---------------------------------------------------------------------------
// Property 7: Toast auto-dismiss
// Validates: Requirements 6.5
// ---------------------------------------------------------------------------

describe('Property 7: Toast auto-dismiss', () => {
  /**
   * For any call to showToast(message, type, duration), the toast SHALL be
   * visible immediately after the call and SHALL no longer be visible after
   * `duration` milliseconds have elapsed.
   *
   * Validates: Requirements 6.5
   */
  it('toast is visible immediately and dismissed after duration', () => {
    vi.useFakeTimers();

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom('success', 'error', 'info'),
        fc.integer({ min: 50, max: 500 }),
        (message, type, duration) => {
          const { unmount, container } = render(<Toast />);

          // Show the toast
          act(() => {
            showToast(message, type, duration);
          });

          // Assert: visible immediately
          const msgEl = container.querySelector('.toast-msg');
          expect(msgEl).not.toBeNull();
          expect(msgEl.textContent).toBe(message);

          // Assert: not visible after duration elapses
          act(() => {
            vi.advanceTimersByTime(duration);
          });

          const msgElAfter = container.querySelector('.toast-msg');
          expect(msgElAfter).toBeNull();

          unmount();
        }
      ),
      { numRuns: 50 }
    );

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Property 12: Toast accessibility attributes
// Validates: Requirements 15.6
// ---------------------------------------------------------------------------

describe('Property 12: Toast accessibility attributes', () => {
  /**
   * For any toast notification rendered by <Toast>, the container element
   * SHALL have role="status" or aria-live="polite" set, regardless of the
   * message content.
   *
   * Validates: Requirements 15.6
   */
  it('container always has role="status" or aria-live="polite" for any message', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.constantFrom('success', 'error', 'info'),
        fc.integer({ min: 50, max: 500 }),
        (message, type, duration) => {
          const { unmount, container } = render(<Toast />);

          act(() => {
            showToast(message, type, duration);
          });

          const toastContainer = container.querySelector('#toast-container');
          expect(toastContainer).not.toBeNull();

          const hasRole = toastContainer.getAttribute('role') === 'status';
          const hasAriaLive = toastContainer.getAttribute('aria-live') === 'polite';

          expect(hasRole || hasAriaLive).toBe(true);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
