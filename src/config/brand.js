/**
 * config/brand.js — Brand palette (JS mirror of the CSS tokens in
 * styles/css/base/variables.css).
 *
 * CSS is the primary source of truth for styling; these constants exist ONLY
 * for runtime scripting where a CSS variable cannot be referenced directly,
 * e.g. inline JS styles, SVG fills (PaymentModal QRIS), chart palettes, etc.
 * Keep the values in sync with :root in variables.css.
 */

export const BRAND_COLOR = '#785E40';          // --brand-brown
export const BRAND_COLOR_DARK = '#5c4630';     // --brand-brown-dark
export const BRAND_BEIGE = '#EDC8AE';          // --brand-beige

export const BRAND = {
  color: BRAND_COLOR,
  colorDark: BRAND_COLOR_DARK,
  beige: BRAND_BEIGE,
};

/**
 * Resolved JS values for the semantic/neutral palette. These mirror the CSS
 * tokens in variables.css but are __resolved hex values__, intended ONLY for
 * runtime contexts where a CSS variable cannot resolve, e.g. SVG attributes
 * (stroke/fill set via setAttribute) and canvas/chart libraries.
 */
export const COLORS = {
  text: '#1f1f1f',              // --text
  textStrong: '#2d2d2d',        // --text-strong
  textSecondary: '#3a3a3a',     // --text-secondary
  muted: '#6b6b6b',             // --muted / --gray-mid
  gray900: '#111827',           // --gray-900
  gray700: '#374151',           // --gray-700
  gray500: '#6b7280',           // --gray-500
  gray400: '#9ca3af',           // --gray-400
  gray300: '#d1d5db',           // --gray-300
  gray200: '#e5e7eb',           // --gray-200
  gray100: '#f3f4f6',           // --gray-100
  gray50: '#f9fafb',            // --gray-50
  grayLight: '#9b9b9b',         // --gray-light
  success: '#16a34a',           // --color-success
  successDark: '#166534',       // --color-success-dark
  successMid: '#15803d',        // --color-success-mid
  warning: '#92400e',           // --color-warning
  warningAmber: '#d97706',      // --color-warning-amber
  danger: '#dc2626',            // --color-danger
  dangerDark: '#b91c1c',        // --color-danger-dark
  dangerDeep: '#991b1b',        // --color-danger-deep
  info: '#2563eb',              // --color-info
  infoDark: '#1e40af',          // --color-info-dark
  sky: '#0369a1',               // --color-sky
  skyBg: '#e0f2fe',             // --color-sky-bg
  purple: '#5b21b6',            // --color-purple
  purpleBg: '#ede9fe',          // --color-purple-bg
  orange: '#9a3412',            // --color-orange
  orangeBg: '#ffedd5',          // --color-orange-bg
  indigo: '#3730a3',            // --color-indigo
  indigoBorder: '#c7d2fe',      // --color-indigo-border
  alert: '#c0392b',             // --color-alert
};
