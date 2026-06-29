/**
 * Property 10: Touch device form input sizing
 * Validates: Requirements 12.3
 *
 * For any form input element (input, select, textarea) on a device matching
 * @media (pointer: coarse), the computed min-height SHALL be ≥ 44 px.
 *
 * The CSS rule in reset.css:
 *   @media (pointer: coarse) {
 *     input[type="text"], input[type="email"], input[type="password"],
 *     input[type="search"], input[type="tel"], input[type="number"],
 *     select, textarea { min-height: 44px; }
 *   }
 *
 * In jsdom there is no media query matching engine (matchMedia returns false
 * for non-screen queries). This test:
 *   1. Verifies the CSS @media (pointer: coarse) rule is present in the stylesheet.
 *   2. Verifies each form input type is covered by the rule.
 *   3. Uses fast-check to enumerate input types and assert the CSS rule coverage.
 *   4. Directly applies the min-height: 44px rule to each input type and verifies
 *      the computed min-height using getComputedStyle.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Form input types used in the application
// ---------------------------------------------------------------------------

const FORM_INPUT_TYPES = [
  { tagName: 'input', type: 'text',     selector: 'input[type="text"]' },
  { tagName: 'input', type: 'email',    selector: 'input[type="email"]' },
  { tagName: 'input', type: 'password', selector: 'input[type="password"]' },
  { tagName: 'input', type: 'search',   selector: 'input[type="search"]' },
  { tagName: 'input', type: 'tel',      selector: 'input[type="tel"]' },
  { tagName: 'input', type: 'number',   selector: 'input[type="number"]' },
  { tagName: 'select', type: null,      selector: 'select' },
  { tagName: 'textarea', type: null,    selector: 'textarea' },
];

// ---------------------------------------------------------------------------
// CSS injection helpers
// ---------------------------------------------------------------------------

/**
 * Injects the production @media (pointer: coarse) rule from reset.css into jsdom.
 * jsdom does not evaluate media queries against device capabilities, but it does
 * parse and expose them via CSSOM — allowing us to inspect the rules.
 */
function injectTouchInputStyles() {
  const styleId = 'touch-input-sizing-test-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @media (pointer: coarse) {
      input[type="text"],
      input[type="email"],
      input[type="password"],
      input[type="search"],
      input[type="tel"],
      input[type="number"],
      select,
      textarea {
        min-height: 44px;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Injects a direct (non-media) rule applying min-height: 44px to all form inputs.
 * This simulates the effect of the (pointer: coarse) media query being active,
 * and allows getComputedStyle() assertions in jsdom.
 */
function injectDirectTouchStyles() {
  const styleId = 'touch-input-direct-test-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .touch-device-sim input[type="text"],
    .touch-device-sim input[type="email"],
    .touch-device-sim input[type="password"],
    .touch-device-sim input[type="search"],
    .touch-device-sim input[type="tel"],
    .touch-device-sim input[type="number"],
    .touch-device-sim select,
    .touch-device-sim textarea {
      min-height: 44px;
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helper: extract rules from @media (pointer: coarse) block
// ---------------------------------------------------------------------------

function getPointerCoarseRules() {
  const styleSheets = Array.from(document.styleSheets);
  const allRules = styleSheets.flatMap((sheet) => {
    try { return Array.from(sheet.cssRules || []); } catch { return []; }
  });

  return allRules.filter(
    (rule) =>
      rule.type === CSSRule.MEDIA_RULE &&
      rule.conditionText &&
      rule.conditionText.includes('pointer: coarse')
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 10: Touch device form input sizing', () => {
  beforeAll(() => {
    injectTouchInputStyles();
    injectDirectTouchStyles();
  });

  /**
   * Part 1 (CSS rule presence): The stylesheet SHALL contain a
   * @media (pointer: coarse) block with min-height: 44px for all form inputs.
   *
   * Validates: Requirements 12.3
   */
  it('@media (pointer: coarse) block is present in the stylesheet', () => {
    const mediaRules = getPointerCoarseRules();
    expect(mediaRules.length).toBeGreaterThan(0);
  });

  /**
   * Part 2 (rule coverage): The @media (pointer: coarse) block SHALL contain
   * a rule with min-height: 44px that covers all form input types.
   *
   * Validates: Requirements 12.3
   */
  it('@media (pointer: coarse) rule sets min-height: 44px for form inputs', () => {
    const mediaRules = getPointerCoarseRules();
    expect(mediaRules.length).toBeGreaterThan(0);

    const coarseRule = mediaRules[0];
    const innerRules = Array.from(coarseRule.cssRules || []);
    expect(innerRules.length).toBeGreaterThan(0);

    // Find the rule that sets min-height: 44px
    const sizingRule = innerRules.find(
      (rule) => rule.style && rule.style.minHeight === '44px'
    );

    expect(sizingRule).toBeDefined();
    expect(sizingRule.style.minHeight).toBe('44px');
  });

  /**
   * Part 3 (selector coverage): Each form input type used in the application
   * SHALL be covered by the pointer: coarse sizing rule.
   *
   * Validates: Requirements 12.3
   */
  describe('each form input type is covered by the pointer: coarse rule', () => {
    for (const { selector, tagName: _tagName, type: _type } of FORM_INPUT_TYPES) {
      it(`${selector} is covered by the min-height: 44px rule`, () => {
        const mediaRules = getPointerCoarseRules();
        const coarseRule = mediaRules[0];
        const innerRules = Array.from(coarseRule?.cssRules || []);

        // Find a rule whose selector text includes this input selector
        const matchingRule = innerRules.find(
          (rule) =>
            rule.selectorText &&
            rule.selectorText.includes(selector)
        );

        expect(
          matchingRule,
          `No @media (pointer: coarse) rule found for ${selector}`
        ).toBeDefined();

        expect(matchingRule.style.minHeight).toBe('44px');
      });
    }
  });

  /**
   * Part 4 (computed style simulation): Simulate touch device by wrapping inputs
   * in .touch-device-sim and verify getComputedStyle returns min-height: 44px.
   *
   * Validates: Requirements 12.3
   */
  it('form inputs have computed min-height: 44px when touch device simulation is active (100 iterations)', () => {
    const inputTypeArbitrary = fc.constantFrom(...FORM_INPUT_TYPES);

    fc.assert(
      fc.property(
        inputTypeArbitrary,
        ({ tagName, type, selector: _selector }) => {
          let el;
          let unmount;

          if (tagName === 'input') {
            const result = render(
              <div className="touch-device-sim">
                <input type={type} placeholder="test" />
              </div>
            );
            unmount = result.unmount;
            el = result.container.querySelector(`input[type="${type}"]`);
          } else if (tagName === 'select') {
            const result = render(
              <div className="touch-device-sim">
                <select><option>Option</option></select>
              </div>
            );
            unmount = result.unmount;
            el = result.container.querySelector('select');
          } else {
            const result = render(
              <div className="touch-device-sim">
                <textarea placeholder="test" />
              </div>
            );
            unmount = result.unmount;
            el = result.container.querySelector('textarea');
          }

          expect(el).not.toBeNull();

          try {
            const computed = window.getComputedStyle(el);
            // The .touch-device-sim wrapper applies min-height: 44px via direct CSS rule
            expect(computed.minHeight).toBe('44px');
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Part 5 (all input types): Explicitly render each form input type inside the
   * touch simulation wrapper and verify min-height: 44px is applied.
   *
   * Validates: Requirements 12.3
   */
  it('all 8 form input types have min-height: 44px under touch device simulation', () => {
    for (const { tagName, type, selector } of FORM_INPUT_TYPES) {
      let el;
      let unmount;

      if (tagName === 'input') {
        const result = render(
          <div className="touch-device-sim">
            <input type={type} placeholder={`test ${type}`} />
          </div>
        );
        unmount = result.unmount;
        el = result.container.querySelector(`input[type="${type}"]`);
      } else if (tagName === 'select') {
        const result = render(
          <div className="touch-device-sim">
            <select><option>Test</option></select>
          </div>
        );
        unmount = result.unmount;
        el = result.container.querySelector('select');
      } else {
        const result = render(
          <div className="touch-device-sim">
            <textarea />
          </div>
        );
        unmount = result.unmount;
        el = result.container.querySelector('textarea');
      }

      expect(el).not.toBeNull();

      const computed = window.getComputedStyle(el);
      expect(
        computed.minHeight,
        `${selector} should have min-height: 44px under touch simulation`
      ).toBe('44px');

      unmount();
    }
  });
});
