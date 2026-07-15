import { useEffect, useRef } from 'react';

/**
 * Generic overlay base component.
 *
 * Props:
 *   isOpen   {boolean}    — whether the modal is visible
 *   onClose  {() => void} — called when the modal should close
 *   children {ReactNode}  — modal content
 *
 * Accessibility (Requirements 8.3, 8.4, 8.5, 15.5):
 *   - Sets aria-modal="true" and role="dialog" on the overlay
 *   - Closes on Escape key
 *   - Traps focus within the overlay while open
 *   - Restores focus to the element that triggered the modal on close
 */
function Modal({ isOpen, onClose, children }) {
  const overlayRef = useRef(null);
  // Remember which element had focus before the modal opened
  const previousFocusRef = useRef(null);

  // Save the currently focused element when the modal opens, restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
    } else {
      // Restore focus when modal closes
      const target = previousFocusRef.current;
      if (target && typeof target.focus === 'function') {
        target.focus();
      } else {
        document.body.focus();
      }
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap: cycle Tab / Shift+Tab within focusable elements
      if (e.key === 'Tab' && overlayRef.current) {
        const focusableSelectors = [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(', ');

        const focusableElements = Array.from(
          overlayRef.current.querySelectorAll(focusableSelectors)
        );

        if (focusableElements.length === 0) return;

        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: if focus is on first element, wrap to last
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          // Tab: if focus is on last element, wrap to first
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Move focus into the overlay when it opens
  useEffect(() => {
    if (isOpen && overlayRef.current) {
      // Focus the first focusable element, or the overlay itself
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      const firstFocusable = overlayRef.current.querySelector(focusableSelectors);
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        overlayRef.current.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleBackdropClick(e) {
    // Close when clicking the backdrop (not the modal content itself)
    if (e.target === overlayRef.current) {
      onClose();
    }
  }

  return (
    <div
      ref={overlayRef}
      className="modal-backdrop open"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onClick={handleBackdropClick}
    >
      {children}
    </div>
  );
}

export default Modal;
