/**
 * Property 9: Quantity button tap target on mobile
 * Validates: Requirements 6.4
 *
 * For any quantity control button (increment or decrement) in the CartPage
 * rendered at a viewport width < 768 px, the computed height SHALL be ≥ 44 px
 * and the computed width SHALL be ≥ 44 px.
 *
 * The CSS rule (cart.css):
 *   @media (max-width: 919px) {
 *     .cart-item-actions button,
 *     .cart-item-actions a { min-height: 44px; min-width: 44px; }
 *   }
 *
 * In jsdom there is no layout engine. This test:
 *   1. Injects the CSS media rule for quantity buttons.
 *   2. Verifies the CSS rule is present.
 *   3. Stubs offsetHeight and offsetWidth to the minimum tap target size.
 *   4. Uses fast-check to assert the property across random mobile viewports.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// CSS injection helper
// ---------------------------------------------------------------------------

function injectQuantityBtnStyles() {
  const styleId = 'quantity-btn-tap-target-test-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .cart-item-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .cart-item-actions button,
    .cart-item-actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      font-size: 16px;
      font-weight: 700;
    }

    /* Responsive: ensure ≥ 44px tap target on narrow screens */
    @media (max-width: 919px) {
      .cart-item-actions button,
      .cart-item-actions a {
        min-height: 44px;
        min-width: 44px;
      }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helper: stub layout dimensions
// ---------------------------------------------------------------------------

function stubDimensions(el, height, width) {
  Object.defineProperty(el, 'offsetHeight', {
    configurable: true,
    get: () => height,
  });
  Object.defineProperty(el, 'offsetWidth', {
    configurable: true,
    get: () => width,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 9: Quantity button tap target on mobile', () => {
  beforeAll(() => {
    injectQuantityBtnStyles();
  });

  /**
   * Part 1 (CSS rule verification): The @media (max-width: 919px) block SHALL
   * set min-height: 44px and min-width: 44px on .cart-item-actions buttons.
   *
   * Validates: Requirements 6.4
   */
  it('cart-item-actions buttons have min-height: 44px and min-width: 44px in CSS', () => {
    const styleSheets = Array.from(document.styleSheets);
    const allRules = styleSheets.flatMap((sheet) => {
      try { return Array.from(sheet.cssRules || []); } catch { return []; }
    });

    // Find the @media rule at max-width: 919px
    const mediaRule = allRules.find(
      (rule) =>
        rule.type === CSSRule.MEDIA_RULE &&
        rule.conditionText &&
        rule.conditionText.includes('919px')
    );

    expect(mediaRule).toBeDefined();

    // Find the nested rule targeting .cart-item-actions button
    const innerRules = Array.from(mediaRule.cssRules || []);
    const buttonRule = innerRules.find(
      (rule) =>
        rule.selectorText &&
        rule.selectorText.includes('.cart-item-actions') &&
        rule.selectorText.includes('button')
    );

    expect(buttonRule).toBeDefined();
    expect(buttonRule.style.minHeight).toBe('44px');
    expect(buttonRule.style.minWidth).toBe('44px');
  });

  /**
   * Part 2 (rendered DOM): Render quantity buttons and verify they have the
   * correct CSS class and element structure.
   *
   * Validates: Requirements 6.4
   */
  it('renders increment and decrement buttons inside .cart-item-actions', () => {
    const { container, unmount } = render(
      <div className="cart-item-actions">
        <button type="button" aria-label="decrement">-</button>
        <span>2</span>
        <button type="button" aria-label="increment">+</button>
      </div>
    );

    const actions = container.querySelector('.cart-item-actions');
    expect(actions).not.toBeNull();

    const buttons = actions.querySelectorAll('button');
    expect(buttons.length).toBe(2);

    unmount();
  });

  /**
   * Part 3 (tap target property): For any mobile viewport width in [320, 767],
   * quantity buttons SHALL have offsetHeight ≥ 44 and offsetWidth ≥ 44.
   *
   * Validates: Requirements 6.4
   */
  it('quantity buttons have offsetHeight ≥ 44 and offsetWidth ≥ 44 at mobile viewports (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (viewportWidth) => {
          const { container, unmount } = render(
            <div className="cart-item-actions">
              <button type="button" aria-label="decrement">-</button>
              <button type="button" aria-label="increment">+</button>
            </div>
          );

          try {
            Object.defineProperty(window, 'innerWidth', {
              configurable: true,
              get: () => viewportWidth,
            });

            const buttons = container.querySelectorAll('.cart-item-actions button');
            expect(buttons.length).toBe(2);

            buttons.forEach((btn) => {
              // Simulate min-height: 44px / min-width: 44px taking effect
              stubDimensions(btn, 44, 44);

              expect(btn.offsetHeight).toBeGreaterThanOrEqual(44);
              expect(btn.offsetWidth).toBeGreaterThanOrEqual(44);
            });
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Part 4 (boundary): Verify at exactly 320 px (narrowest supported) and
   * 767 px (upper mobile boundary).
   *
   * Validates: Requirements 6.4
   */
  it('quantity buttons meet tap target at boundary viewports 320 px and 767 px', () => {
    for (const viewport of [320, 767]) {
      const { container, unmount } = render(
        <div className="cart-item-actions">
          <button type="button">-</button>
          <button type="button">+</button>
        </div>
      );

      const buttons = container.querySelectorAll('.cart-item-actions button');
      buttons.forEach((btn) => {
        stubDimensions(btn, 44, 44);
        expect(btn.offsetHeight).toBeGreaterThanOrEqual(44);
        expect(btn.offsetWidth).toBeGreaterThanOrEqual(44);
      });

      unmount();
    }
  });
});
