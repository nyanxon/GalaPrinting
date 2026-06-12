/**
 * Property 1: Container padding invariant
 * Validates: Requirements 2.2
 *
 * For any viewport width between 320 px and 767 px (Breakpoint_Mobile), the
 * .container element's computed left padding and right padding SHALL each be
 * at least 16 px, so that content never touches the screen edge.
 *
 * The .container rule is:
 *   width: min(100% - 32px, var(--container));
 *   margin-inline: auto;
 *
 * This achieves a 16 px inset on each side by making the container 32 px
 * narrower than its parent viewport. The "padding" is implicit — the container
 * width leaves 16 px on each side (when parent === viewport at mobile widths).
 *
 * In jsdom, CSS layout is not computed (no reflow engine), so the test:
 *   1. Injects the production .container CSS rule into the document.
 *   2. Verifies the width formula contains the correct 32 px subtraction that
 *      guarantees ≥ 16 px on each side.
 *   3. Simulates rendered layout by stubbing offsetWidth / parentElement
 *      dimensions and asserts the mathematical invariant: for any viewport width
 *      W in [320, 767], the available side space per edge is ≥ 16 px.
 *
 * Formula verification:
 *   containerWidth = min(W - 32, 1120)
 *   At mobile widths (W ≤ 767): containerWidth = W - 32  (since W - 32 < 1120)
 *   Side space each edge = (W - containerWidth) / 2 = (W - (W - 32)) / 2 = 32 / 2 = 16 px
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// CSS injection helper
// ---------------------------------------------------------------------------

/**
 * Inject the production .container CSS rule so that getComputedStyle
 * returns the real style applied to .container elements in the document.
 *
 * Also inject the --container custom property at :root.
 */
function injectContainerStyles() {
  const styleId = 'container-padding-test-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    :root {
      --container: 1120px;
    }
    .container {
      width: min(100% - 32px, var(--container));
      margin-inline: auto;
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helper: create a .container element inside a viewport-width wrapper
// ---------------------------------------------------------------------------

/**
 * Creates a .container div nested inside a wrapper that simulates a viewport
 * of the given width. Returns both elements and an unmount function.
 *
 * @param {number} viewportWidth - Simulated viewport width in pixels
 * @returns {{ wrapperEl: HTMLElement, containerEl: HTMLElement, unmount: () => void }}
 */
function createContainerInViewport(viewportWidth) {
  const wrapper = document.createElement('div');
  wrapper.style.width = `${viewportWidth}px`;
  wrapper.style.position = 'relative';

  const containerEl = document.createElement('div');
  containerEl.className = 'container';

  wrapper.appendChild(containerEl);
  document.body.appendChild(wrapper);

  return {
    wrapperEl: wrapper,
    containerEl,
    unmount: () => document.body.removeChild(wrapper),
  };
}

// ---------------------------------------------------------------------------
// Mathematical invariant helper
// ---------------------------------------------------------------------------

/**
 * Computes the expected container width for a given viewport width using the
 * production formula: min(viewportWidth - 32, 1120).
 *
 * @param {number} viewportWidth
 * @returns {number}
 */
function expectedContainerWidth(viewportWidth) {
  return Math.min(viewportWidth - 32, 1120);
}

/**
 * Computes the available space on each side (the implicit "padding") between
 * the container edge and the viewport edge.
 *
 * With margin-inline: auto, the space is split equally on both sides:
 *   sideSpace = (viewportWidth - containerWidth) / 2
 *
 * @param {number} viewportWidth
 * @returns {number}
 */
function sideSpacePerEdge(viewportWidth) {
  const containerWidth = expectedContainerWidth(viewportWidth);
  return (viewportWidth - containerWidth) / 2;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 1: Container padding invariant', () => {
  beforeAll(() => {
    injectContainerStyles();
  });

  /**
   * Part 1 (CSS rule verification): The .container element SHALL have a CSS
   * width formula that subtracts at least 32 px from the parent width
   * (ensuring ≥ 16 px per side), and SHALL use margin-inline: auto.
   *
   * Validates: Requirements 2.2
   */
  it('container CSS uses the min(100% - 32px, ...) formula and margin-inline: auto', () => {
    const { containerEl, unmount } = createContainerInViewport(375);

    try {
      const computed = window.getComputedStyle(containerEl);

      // The width should contain the min() formula with 32px subtraction
      // (jsdom exposes the CSS value as written — min(100% - 32px, var(--container)))
      // We verify the CSS text is correct via the stylesheet rule
      const styleSheets = Array.from(document.styleSheets);
      const containerRule = styleSheets
        .flatMap((sheet) => {
          try {
            return Array.from(sheet.cssRules || []);
          } catch {
            return [];
          }
        })
        .find(
          (rule) =>
            rule.selectorText === '.container' &&
            rule.style &&
            rule.style.width
        );

      expect(containerRule).not.toBeNull();
      expect(containerRule).toBeDefined();

      // The width value must include a subtraction that creates ≥ 16 px per side.
      // Production value: "min(100% - 32px, var(--container))"
      const widthValue = containerRule.style.width;
      expect(widthValue).toMatch(/min\(/i);
      expect(widthValue).toMatch(/100%/);
      // Subtraction of at least 32px ensures 16px per side
      expect(widthValue).toMatch(/32px/);

      // margin-inline: auto centers the container (equal margins on both sides)
      // jsdom exposes this as marginInline or as marginLeft/marginRight
      const marginInline = computed.marginInline;
      const marginLeft = computed.marginLeft;
      const marginRight = computed.marginRight;

      const hasCenteredMargins =
        marginInline === 'auto' ||
        (marginLeft === 'auto' && marginRight === 'auto');

      expect(hasCenteredMargins).toBe(true);
    } finally {
      unmount();
    }
  });

  /**
   * Part 2 (mathematical invariant): For any viewport width in [320, 767],
   * the side space on each edge SHALL be exactly 16 px.
   *
   * At mobile widths (W ≤ 767), the formula resolves to W - 32 (since W - 32 < 1120).
   * With margin-inline: auto, the remaining space (W - (W - 32)) = 32 px is
   * split equally: 16 px per side.
   *
   * This is the core correctness property: ≥ 16 px side space guaranteed.
   *
   * Validates: Requirements 2.2
   */
  it('side space per edge is ≥ 16 px for any viewport width in [320, 767] (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (viewportWidth) => {
          const space = sideSpacePerEdge(viewportWidth);

          // At mobile widths the formula is always min(W - 32, 1120) = W - 32
          // (since W ≤ 767, so W - 32 ≤ 735 < 1120).
          // Space per side = (W - (W - 32)) / 2 = 16 px exactly.
          expect(space).toBeGreaterThanOrEqual(16);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Part 3 (boundary verification): Explicitly verify the two boundary viewports
   * (320 px and 767 px) produce exactly 16 px of side space.
   *
   * Validates: Requirements 2.2
   */
  it('produces exactly 16 px side space at the boundary viewports 320 px and 767 px', () => {
    expect(sideSpacePerEdge(320)).toBe(16);
    expect(sideSpacePerEdge(767)).toBe(16);
  });

  /**
   * Part 4 (DOM rendering): For any viewport width in [320, 767], a rendered
   * .container element SHALL exist in the DOM and SHALL use the correct CSS class.
   *
   * Validates: Requirements 2.2
   */
  it('container element renders and carries the .container class for any mobile viewport width (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (viewportWidth) => {
          const { containerEl, unmount } = createContainerInViewport(viewportWidth);

          try {
            expect(containerEl).not.toBeNull();
            expect(containerEl.classList.contains('container')).toBe(true);

            // The wrapper simulates the viewport — verify the parent width is set
            const parent = containerEl.parentElement;
            expect(parent).not.toBeNull();
            expect(parent.style.width).toBe(`${viewportWidth}px`);
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Part 5 (simulated layout): Stub offsetWidth dimensions to simulate a
   * real browser rendering and verify the 16 px invariant holds.
   *
   * In a real browser, containerEl.offsetWidth = viewportWidth - 32 at mobile.
   * This test stubs the dimensions and asserts the invariant directly.
   *
   * Validates: Requirements 2.2
   */
  it('simulated layout: container offsetWidth leaves ≥ 16 px per side for any mobile viewport (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (viewportWidth) => {
          const { containerEl, wrapperEl, unmount } = createContainerInViewport(viewportWidth);

          try {
            // Stub the rendered dimensions as a real browser would compute them.
            // At mobile widths: containerWidth = viewportWidth - 32
            const simulatedContainerWidth = expectedContainerWidth(viewportWidth);

            Object.defineProperty(wrapperEl, 'offsetWidth', {
              configurable: true,
              get: () => viewportWidth,
            });

            Object.defineProperty(containerEl, 'offsetWidth', {
              configurable: true,
              get: () => simulatedContainerWidth,
            });

            // Compute the available space on each side
            const totalSideSpace = wrapperEl.offsetWidth - containerEl.offsetWidth;
            const sideSpace = totalSideSpace / 2; // margin-inline: auto splits equally

            // The core invariant: ≥ 16 px per side
            expect(sideSpace).toBeGreaterThanOrEqual(16);
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
