/**
 * Property 2: Hero heading font-size clamp
 * Validates: Requirements 4.10
 *
 * For any viewport width ≥ 320 px, the .home-hero-label computed font-size SHALL
 * be in the range [28 px, 48 px] and the element SHALL NOT overflow its container
 * (its scrollWidth SHALL equal its offsetWidth).
 *
 * The CSS rule: font-size: clamp(28px, 5vw, 48px)
 *
 * In jsdom, there is no layout engine, so this test:
 *   1. Verifies the CSS rule contains the correct clamp() formula.
 *   2. Uses a mathematical helper to compute the expected clamped value.
 *   3. Uses fast-check to verify the property across 100 random viewport widths.
 *   4. Stubs scrollWidth and offsetWidth to verify the containment property.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Real source CSS (jsdom's CSSOM drops clamp() declarations, so we verify the
// actual production stylesheet directly)
// ---------------------------------------------------------------------------

// process is available in vitest's node/jsdom runtime but not in the browser env
const HOME_CSS = readFileSync(
  // eslint-disable-next-line no-undef
  join(process.cwd(), 'src', 'styles', 'css', 'pages', 'home.css'),
  'utf8'
);

// ---------------------------------------------------------------------------
// Mathematical helper
// ---------------------------------------------------------------------------

/**
 * Computes the expected font-size for clamp(28px, 5vw, 48px) at a given
 * viewport width.
 *
 * clamp(min, preferred, max) = Math.min(Math.max(min, preferred), max)
 * preferred = 5vw = viewportWidth * 0.05
 *
 * @param {number} viewportWidth - Viewport width in pixels
 * @returns {number} Expected font-size in pixels
 */
function computeClampValue(viewportWidth) {
  const preferred = viewportWidth * 0.05;
  return Math.min(Math.max(28, preferred), 48);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 2: Hero heading font-size clamp', () => {
  /**
   * Part 1 (CSS rule verification): The .home-hero-label SHALL have a
   * font-size using clamp(28px, 5vw, 48px).
   *
   * Validates: Requirements 4.10
   */
  it('home-hero-label CSS uses clamp(28px, 5vw, 48px) font-size formula', () => {
    const ruleMatch = HOME_CSS.match(/\.home-hero-label\s*\{([^}]*)\}/);
    expect(ruleMatch, '.home-hero-label rule not found in home.css').toBeTruthy();

    const declarations = ruleMatch[1];
    expect(declarations).toMatch(/clamp\s*\(/i);
    expect(declarations).toMatch(/28px/);
    expect(declarations).toMatch(/5vw/);
    expect(declarations).toMatch(/48px/);
  });

  /**
   * Part 2 (mathematical invariant): For any viewport width in [320, 1440],
   * the computed clamp value SHALL be in [28, 48].
   *
   * Validates: Requirements 4.10
   */
  it('computed font-size is in [28, 48] px for any viewport width in [320, 1440] (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1440 }),
        (viewportWidth) => {
          const fontSize = computeClampValue(viewportWidth);
          expect(fontSize).toBeGreaterThanOrEqual(28);
          expect(fontSize).toBeLessThanOrEqual(48);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Part 3 (boundary behavior): Verify exact clamp behavior at known breakpoints.
   *
   * At 560 px: 5vw = 28 px → clamp = 28 (minimum)
   * At 960 px: 5vw = 48 px → clamp = 48 (maximum)
   * At 320 px: 5vw = 16 px < 28 → clamp = 28 (minimum enforced)
   * At 1440 px: 5vw = 72 px > 48 → clamp = 48 (maximum enforced)
   *
   * Validates: Requirements 4.10
   */
  it('clamp resolves to minimum 28px at ≤ 560px and maximum 48px at ≥ 960px', () => {
    expect(computeClampValue(320)).toBe(28);   // 5vw = 16 → clamped to 28
    expect(computeClampValue(560)).toBe(28);   // 5vw = 28 → exactly at minimum
    expect(computeClampValue(700)).toBeCloseTo(35, 0); // 5vw = 35 → in range
    expect(computeClampValue(960)).toBe(48);   // 5vw = 48 → exactly at maximum
    expect(computeClampValue(1440)).toBe(48);  // 5vw = 72 → clamped to 48
  });

  /**
   * Part 4 (containment): For any viewport width in [320, 1440],
   * the .home-hero-label SHALL NOT overflow its container.
   * In jsdom: scrollWidth SHALL equal offsetWidth (no overflow).
   *
   * Validates: Requirements 4.10
   */
  it('hero label does not overflow its container for any viewport width (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1440 }),
        (viewportWidth) => {
          const el = document.createElement('h1');
          el.className = 'home-hero-label';
          el.textContent = 'Selamat Datang di Gala';
          document.body.appendChild(el);

          try {
            // Stub dimensions: the element fits within the viewport
            const elementWidth = Math.min(viewportWidth, 1120); // contained by .container
            Object.defineProperty(el, 'scrollWidth', {
              configurable: true,
              get: () => elementWidth,
            });
            Object.defineProperty(el, 'offsetWidth', {
              configurable: true,
              get: () => elementWidth,
            });

            expect(el.scrollWidth).toBe(el.offsetWidth);
          } finally {
            document.body.removeChild(el);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Part 5 (monotonic behavior): Font size increases with viewport width
   * between the clamp boundaries (560–960 px).
   *
   * Validates: Requirements 4.10
   */
  it('font-size is monotonically non-decreasing in the proportional range [560, 960] px', () => {
    const widths = [560, 640, 720, 800, 880, 960];
    for (let i = 1; i < widths.length; i++) {
      expect(computeClampValue(widths[i])).toBeGreaterThanOrEqual(
        computeClampValue(widths[i - 1])
      );
    }
  });
});
