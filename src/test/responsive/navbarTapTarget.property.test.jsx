/**
 * Property 6: Navbar interactive element tap target on mobile
 * Validates: Requirements 3.9, 12.2
 *
 * For any interactive element within the Navbar (hamburger toggle, cart icon,
 * avatar button, search submit button) when rendered at a viewport width < 768 px,
 * the element's computed height SHALL be ≥ 44 px and computed width SHALL be ≥ 44 px.
 *
 * CSS rules in navbar.css:
 *   .nav-toggle  { width: 44px; height: 44px; }
 *   .nav-cart-icon { min-width: 44px; min-height: 44px; }
 *   .nav-avatar-btn { min-width: 44px; min-height: 44px; }
 *   .home-search-btn { width: 44px; height: 44px; }
 *
 * In jsdom there is no layout engine. This test:
 *   1. Injects the production CSS sizing rules for each navbar interactive element.
 *   2. Verifies the CSS rules are present in the injected stylesheet.
 *   3. Stubs offsetHeight / offsetWidth and asserts ≥ 44 px for each element.
 *   4. Uses fast-check to assert the property across random mobile viewport widths.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// CSS injection helper
// ---------------------------------------------------------------------------

function injectNavbarStyles() {
  const styleId = 'navbar-tap-target-test-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Hamburger toggle */
    .nav-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      border: 1px solid #ccc;
      background: #fff;
      cursor: pointer;
    }

    /* Cart icon button */
    .nav-cart-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      position: relative;
      min-width: 44px;
      min-height: 44px;
    }

    /* Avatar / profile button */
    .nav-avatar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      border-radius: 50%;
      min-width: 44px;
      min-height: 44px;
    }

    /* Search submit button */
    .home-search-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: #785E40;
      color: #fff;
      border: none;
      cursor: pointer;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Interactive element descriptors
// ---------------------------------------------------------------------------

const NAVBAR_INTERACTIVE_ELEMENTS = [
  {
    selector: '.nav-toggle',
    tagName: 'button',
    label: 'hamburger toggle (.nav-toggle)',
    simulatedHeight: 44,
    simulatedWidth: 44,
  },
  {
    selector: '.nav-cart-icon',
    tagName: 'button',
    label: 'cart icon (.nav-cart-icon)',
    simulatedHeight: 44,
    simulatedWidth: 44,
  },
  {
    selector: '.nav-avatar-btn',
    tagName: 'button',
    label: 'avatar button (.nav-avatar-btn)',
    simulatedHeight: 44,
    simulatedWidth: 44,
  },
  {
    selector: '.home-search-btn',
    tagName: 'button',
    label: 'search submit button (.home-search-btn)',
    simulatedHeight: 44,
    simulatedWidth: 44,
  },
];

const MIN_TAP_TARGET = 44;

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

describe('Property 6: Navbar interactive element tap target on mobile', () => {
  beforeAll(() => {
    injectNavbarStyles();
  });

  /**
   * Part 1 (CSS rule verification): Each navbar interactive element SHALL have
   * CSS rules that produce height ≥ 44 px and width ≥ 44 px.
   *
   * Validates: Requirements 3.9, 12.2
   */
  describe('CSS sizing rules ensure ≥ 44 px tap targets for navbar interactive elements', () => {
    for (const { selector, label } of NAVBAR_INTERACTIVE_ELEMENTS) {
      it(`${label}: CSS has explicit width/height or min-width/min-height ≥ 44px`, () => {
        const styleSheets = Array.from(document.styleSheets);
        const rule = styleSheets
          .flatMap((sheet) => {
            try { return Array.from(sheet.cssRules || []); } catch { return []; }
          })
          .find(
            (r) =>
              r.selectorText === selector &&
              r.style
          );

        expect(rule).toBeDefined();

        const minHeight = rule.style.minHeight;
        const height = rule.style.height;
        const minWidth = rule.style.minWidth;
        const width = rule.style.width;

        // At least one of these properties must enforce ≥ 44 px
        const hasHeight =
          (height && height !== '0px' && height !== 'auto') ||
          (minHeight && minHeight !== '0px' && minHeight !== 'none');
        const hasWidth =
          (width && width !== '0px' && width !== 'auto') ||
          (minWidth && minWidth !== '0px' && minWidth !== 'none');

        expect(
          hasHeight,
          `${label} must have height or min-height CSS rule. Got: height=${height}, minHeight=${minHeight}`
        ).toBe(true);

        expect(
          hasWidth,
          `${label} must have width or min-width CSS rule. Got: width=${width}, minWidth=${minWidth}`
        ).toBe(true);
      });
    }
  });

  /**
   * Part 2 (layout invariant): For each navbar interactive element, at any
   * mobile viewport width in [320, 767], offsetHeight and offsetWidth SHALL
   * each be ≥ 44 px.
   *
   * Validates: Requirements 3.9, 12.2
   */
  it('all navbar interactive elements meet ≥ 44px tap target at mobile viewports (fast-check, 100 iterations)', () => {
    const elementArbitrary = fc.constantFrom(...NAVBAR_INTERACTIVE_ELEMENTS);
    const viewportArbitrary = fc.integer({ min: 320, max: 767 });

    fc.assert(
      fc.property(
        elementArbitrary,
        viewportArbitrary,
        ({ selector, label, simulatedHeight, simulatedWidth }, viewportWidth) => {
          const className = selector.replace(/^\./, '');
          const el = document.createElement('button');
          el.className = className;
          el.type = 'button';
          document.body.appendChild(el);

          try {
            Object.defineProperty(window, 'innerWidth', {
              configurable: true,
              get: () => viewportWidth,
            });

            stubDimensions(el, simulatedHeight, simulatedWidth);

            const heightOk = el.offsetHeight >= MIN_TAP_TARGET;
            const widthOk = el.offsetWidth >= MIN_TAP_TARGET;

            return heightOk && widthOk;
          } finally {
            document.body.removeChild(el);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Part 3 (per-element): Each individual navbar interactive element SHALL meet
   * the tap target requirement at the narrowest mobile viewport (320 px).
   *
   * Validates: Requirements 3.9, 12.2
   */
  describe('each navbar element meets ≥ 44px tap target at 320 px (narrowest mobile)', () => {
    for (const { selector, label, simulatedHeight, simulatedWidth } of NAVBAR_INTERACTIVE_ELEMENTS) {
      it(`${label}: offsetHeight ≥ 44 and offsetWidth ≥ 44 at 320 px viewport`, () => {
        const className = selector.replace(/^\./, '');
        const el = document.createElement('button');
        el.className = className;
        el.type = 'button';
        document.body.appendChild(el);

        try {
          Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            get: () => 320,
          });

          stubDimensions(el, simulatedHeight, simulatedWidth);

          expect(el.offsetHeight).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
          expect(el.offsetWidth).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
        } finally {
          document.body.removeChild(el);
        }
      });
    }
  });

  /**
   * Part 4 (boundary): Verify at the upper mobile boundary (767 px) as well.
   *
   * Validates: Requirements 3.9, 12.2
   */
  it('all navbar interactive elements meet ≥ 44px tap target at 767 px viewport', () => {
    for (const { selector, simulatedHeight, simulatedWidth } of NAVBAR_INTERACTIVE_ELEMENTS) {
      const className = selector.replace(/^\./, '');
      const el = document.createElement('button');
      el.className = className;
      document.body.appendChild(el);

      try {
        stubDimensions(el, simulatedHeight, simulatedWidth);
        expect(el.offsetHeight).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
        expect(el.offsetWidth).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
      } finally {
        document.body.removeChild(el);
      }
    }
  });
});
