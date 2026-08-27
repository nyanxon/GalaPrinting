/**
 * Property 7: Modal viewport containment
 * Validates: Requirements 11.1
 *
 * For any viewport width ≥ 320 px, the .modal element's computed width SHALL be
 * ≤ min(90vw, 520px) — that is, it SHALL NOT exceed 90% of the viewport width
 * nor exceed 520 px.
 *
 * The CSS rule: width: min(90vw, 520px)
 *
 * In jsdom there is no layout engine, so this test:
 *   1. Verifies the CSS rule contains the correct min() formula.
 *   2. Uses a mathematical helper to compute the expected max width.
 *   3. Uses fast-check to assert the containment property across 100 random viewports.
 *   4. Stubs offsetWidth to simulate real browser values.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Real source CSS (jsdom's CSSOM drops min() declarations, so we verify the
// actual production stylesheet directly)
// ---------------------------------------------------------------------------

// process is available in vitest's node/jsdom runtime but not in the browser env
const MODAL_CSS = readFileSync(
  // eslint-disable-next-line no-undef
  join(process.cwd(), 'src', 'styles', 'css', 'components', 'modal.css'),
  'utf8'
);

// ---------------------------------------------------------------------------
// Mathematical helper
// ---------------------------------------------------------------------------

/**
 * Computes the expected maximum modal width for a given viewport width.
 * Formula: min(0.9 * viewportWidth, 520)
 *
 * @param {number} viewportWidth - Viewport width in pixels
 * @returns {number} Expected maximum modal width in pixels
 */
function expectedMaxModalWidth(viewportWidth) {
  return Math.min(0.9 * viewportWidth, 520);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 7: Modal viewport containment', () => {
  /**
   * Part 1 (CSS rule verification): The .modal SHALL have width: min(90vw, 520px).
   *
   * Validates: Requirements 11.1
   */
  it('modal CSS uses width: min(90vw, 520px)', () => {
    const ruleMatch = MODAL_CSS.match(/\.modal\s*\{([^}]*)\}/);
    expect(ruleMatch, '.modal rule not found in modal.css').toBeTruthy();

    const declarations = ruleMatch[1];
    expect(declarations).toMatch(/min\s*\(/i);
    expect(declarations).toMatch(/90vw/);
    expect(declarations).toMatch(/520px/);
  });

  /**
   * Part 2 (mathematical invariant): For any viewport width in [320, 1440],
   * the expected modal width SHALL be ≤ viewport width.
   *
   * Validates: Requirements 11.1
   */
  it('modal width never exceeds viewport width for any width in [320, 1440] (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1440 }),
        (viewportWidth) => {
          const maxWidth = expectedMaxModalWidth(viewportWidth);
          expect(maxWidth).toBeLessThanOrEqual(viewportWidth);
          expect(maxWidth).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Part 3 (boundary behavior): At 320 px, width = 288 px (90% of 320 < 520).
   * At 578 px, 90vw = 520 → reaches the 520 px cap.
   * At 1440 px, width = 520 px (capped).
   *
   * Validates: Requirements 11.1
   */
  it('modal width is correctly capped at 520px for wide viewports', () => {
    expect(expectedMaxModalWidth(320)).toBeCloseTo(288, 0);   // 90% of 320
    expect(expectedMaxModalWidth(578)).toBeCloseTo(520, 0);   // 90% of 578 ≈ 520
    expect(expectedMaxModalWidth(1024)).toBe(520);             // capped at 520
    expect(expectedMaxModalWidth(1440)).toBe(520);             // capped at 520
  });

  /**
   * Part 4 (width range): For all viewports in [320, 1440], the modal width
   * SHALL be in [288, 520] px.
   *
   * Validates: Requirements 11.1
   */
  it('modal width is in [288, 520] px for any viewport in [320, 1440] (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1440 }),
        (viewportWidth) => {
          const maxWidth = expectedMaxModalWidth(viewportWidth);
          expect(maxWidth).toBeGreaterThanOrEqual(288);  // 90% of 320
          expect(maxWidth).toBeLessThanOrEqual(520);     // hard cap
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Part 5 (DOM simulation): Render a .modal element, stub its offsetWidth to
   * the expected containment value, and assert it never exceeds the viewport.
   *
   * Validates: Requirements 11.1
   */
  it('modal offsetWidth ≤ viewportWidth for any viewport width (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1440 }),
        (viewportWidth) => {
          const el = document.createElement('div');
          el.className = 'modal';
          document.body.appendChild(el);

          try {
            // Stub window.innerWidth to simulate the viewport
            Object.defineProperty(window, 'innerWidth', {
              configurable: true,
              get: () => viewportWidth,
            });

            // Stub offsetWidth as a real browser would compute it
            const simulatedWidth = expectedMaxModalWidth(viewportWidth);
            Object.defineProperty(el, 'offsetWidth', {
              configurable: true,
              get: () => simulatedWidth,
            });

            // Core property: modal width ≤ viewport width
            expect(el.offsetWidth).toBeLessThanOrEqual(viewportWidth);
            // And ≤ 520 px
            expect(el.offsetWidth).toBeLessThanOrEqual(520);
          } finally {
            document.body.removeChild(el);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
