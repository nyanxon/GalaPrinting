// Feature: vanilla-to-react-migration, Property 11: Modal accessibility attributes
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import Modal from '../components/shared/Modal.jsx';

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}}>
        <div>Content</div>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay with correct ARIA attributes when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <div>Content</div>
      </Modal>
    );
    const overlay = screen.getByRole('dialog');
    expect(overlay).toBeTruthy();
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(overlay.getAttribute('role')).toBe('dialog');
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <button>Close</button>
      </Modal>
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when Escape is pressed and modal is closed', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={false} onClose={onClose}>
        <button>Close</button>
      </Modal>
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * Property 11: Modal accessibility attributes
   * Validates: Requirements 8.3, 15.5
   *
   * For any open modal (with any children content), the overlay element SHALL
   * have aria-modal="true" and role="dialog" regardless of the modal's content.
   */
  it('Property 11: Modal accessibility attributes — aria-modal and role="dialog" always present when open', () => {
    fc.assert(
      fc.property(
        // Generate random string content for the modal children
        fc.string({ minLength: 0, maxLength: 200 }),
        (content) => {
          const { unmount } = render(
            <Modal isOpen={true} onClose={() => {}}>
              <div>{content}</div>
            </Modal>
          );

          const overlay = screen.getByRole('dialog');
          expect(overlay.getAttribute('aria-modal')).toBe('true');
          expect(overlay.getAttribute('role')).toBe('dialog');

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
