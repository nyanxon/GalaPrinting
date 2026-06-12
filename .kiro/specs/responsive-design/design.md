# Design Document: Responsive Design

## Overview

This document describes the technical approach for making every page and shared component in Gala Web fully responsive across three device classes: desktop (≥1024 px), tablet (768–1023 px), and mobile (<768 px).

The work is purely CSS-side with minor JSX adjustments where needed (e.g., the Navbar hamburger toggle, the staff dashboard layout). No new JavaScript frameworks or utility-class libraries are introduced. The project already uses plain CSS organized into `base/`, `layout/`, `components/`, and `pages/` sub-directories, all imported through `main.css`. All responsive rules will be added as `@media` blocks within those existing files.

The goal is to eliminate horizontal overflow on all pages, ensure minimum 44 px tap targets on touch devices, and reflow multi-column layouts gracefully at each breakpoint.

---

## Architecture

### CSS Cascade Strategy

Gala Web uses a **mobile-first baseline with desktop overrides** approach where appropriate, but because the existing desktop styles are already written, we adopt a **desktop-default + downscale overrides** approach for consistency with the existing code. This means:

- Base styles are written for desktop (existing code, unchanged where already responsive).
- `@media (max-width: 1023px)` or `@media (max-width: 767px)` blocks override for tablet and mobile.
- Where a rule applies to both tablet and mobile, a single `@media (max-width: 1023px)` block is used.

### Breakpoint Tokens

Three breakpoints are used consistently across all stylesheets:

| Name | Condition | Media Query |
|---|---|---|
| Desktop | ≥ 1024 px | (default, no media query needed) |
| Tablet | 768–1023 px | `@media (max-width: 1023px)` |
| Mobile | < 768 px | `@media (max-width: 767px)` |

Exceptions noted inline where a specific page uses a non-standard breakpoint (e.g., CartPage at 920 px, CheckoutPage at 768 px, ProfilePage at 700 px) — these are retained to preserve consistency with existing CSS.

### File Modification Plan

```
src/styles/css/
  base/
    reset.css          — verify viewport meta, box-sizing, max-width rules (already done)
  layout/
    grid.css           — add tablet breakpoint for cols-3/cols-4
    navbar.css         — expand mobile hamburger behavior, popup widths, tap targets
    footer.css         — already has mobile stacking; verify completeness
  components/
    modal.css          — add max-height: 90vh and overflow-y: auto for mobile
    cards.css          — no changes needed (generic card)
    chatWidget.css     — update max-width constraint for mobile
    toast.css          — reposition to top with navbar offset
  pages/
    home.css           — already has mobile rules; fill tablet gap for cat-grid
    products.css       — add tablet breakpoint for catalog grid (3-col)
    catalogProduct.css — add responsive grid breakpoints
    cart.css           — add mobile tap-target sizes for quantity buttons
    checkout.css       — already has bottom-sheet; verify step indicator
    profile.css        — already has 700px breakpoint; verify form widths
    myOrders.css       — add overflow-x: auto wrapper, button wrap rules
    statusOrder.css    — add single-column detail section
    dashboard.css      — add mobile stacking, remove body overflow:hidden

index.html             — verify viewport meta tag presence
```

---

## Components and Interfaces

### 1. Viewport Meta Tag and Base Reset (`index.html`, `reset.css`)

**Current state:** `reset.css` already has `box-sizing: border-box`, `max-width: 100%` on media elements, and no fixed widths on `body`/`html`. The `index.html` needs verification that the viewport meta tag is present.

**Changes:**
- Confirm `index.html` contains `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.
- No CSS changes needed — reset is already correct.

### 2. Responsive Grid Utilities (`grid.css`)

**Current state:**
```css
/* Only has min-width: 768px — no tablet-specific override */
@media (min-width: 768px) {
  .grid.cols-2 { grid-template-columns: 1fr 1fr; }
  .grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
}
```

**Gap:** No tablet override. At 768–1023 px, `.grid.cols-4` shows 4 columns (too narrow). No explicit single-column fallback for mobile (the absence of a rule means the default single-column `display: grid` applies, which is correct, but it should be explicit).

**Changes:**
```css
/* Tablet: cols-3 and cols-4 reduce to 2 columns */
@media (max-width: 1023px) {
  .grid.cols-4 { grid-template-columns: repeat(2, 1fr); }
  .grid.cols-3 { grid-template-columns: repeat(2, 1fr); }
}

/* Mobile: all grids collapse to single column */
@media (max-width: 767px) {
  .grid.cols-2,
  .grid.cols-3,
  .grid.cols-4 { grid-template-columns: 1fr; }
}
```

### 3. Responsive Navbar (`navbar.css`, `Navbar.jsx`)

**Current state:**
- `nav-toggle` (hamburger) is hidden at `min-width: 920px` via `display: none`.
- Mobile menu (`.nav-mobile`) shows as a block when `.open` is added.
- No explicit breakpoint for hiding auth controls on mobile.
- Popups at `max-width: 480px` already have a rule expanding to near-full-width.
- The secondary nav (`.navbar-secondary`) is shown at `min-width: 768px`.

**Gap:** On mobile, `nav-actions` still shows the cart icon and profile button inline. The Navbar category button and search still appear. At very narrow widths (320–479 px), the row can overflow. The hamburger toggle is 42×42 px which is just below the 44 px minimum.

**Changes to `navbar.css`:**
- Increase `nav-toggle` to `width: 44px; height: 44px`.
- At `max-width: 919px` (below the hamburger breakpoint), ensure the navbar center and nav-actions don't overflow by constraining flex sizing.
- Ensure `cart-popup`, `login-popup`, and `profile-popup` are constrained to `max-width: calc(100vw - 32px)` on mobile.
- Add `min-width: 44px; min-height: 44px` to `nav-cart-icon` and `nav-avatar-btn`.

**Navbar JSX (`Navbar.jsx`):** No structural changes needed. The existing `mobileOpen` state and `.open` class toggling is already in place.

### 4. Responsive HomePage (`home.css`)

**Current state:** Already has `max-width: 600px` mobile rules for cat-grid (2-col), custom-order stacking, and product section stacking. Has `max-width: 900px` for 2-col product grid.

**Gap:** No tablet (768–1023 px) override for the category grid (it stays at 4 columns until 600 px). The hero font uses `clamp()` already.

**Changes:**
```css
/* Tablet: category grid 3 columns */
@media (max-width: 1023px) and (min-width: 601px) {
  .home-cat-grid { grid-template-columns: repeat(3, 1fr); }
}
```

The rest of the HomePage mobile rules are already adequate.

### 5. Responsive ProductsPage (`products.css`)

**Current state:** At `max-width: 768px`, `.catalog-layout` switches to `flex-direction: column` and `.catalog-sidebar` goes to `width: 100%`.

**Gap:** No tablet-specific rule for the product grid (stays at whatever the parent flex gives it, which can be cramped). No explicit 2-col product grid rule.

**Changes:**
```css
@media (max-width: 1023px) {
  .catalog-product-grid { grid-template-columns: repeat(2, 1fr); }
}
```

### 6. Responsive CatalogProductPage (`catalogProduct.css`)

**Current state:** Needs examination — the grid columns for the catalog product page need breakpoints.

**Changes:**
- Desktop: 4-column grid.
- Tablet (768–1023 px): 3-column grid.
- Mobile (<768 px): 2-column grid.

```css
.catalog-product-grid { grid-template-columns: repeat(4, 1fr); }

@media (max-width: 1023px) {
  .catalog-product-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 767px) {
  .catalog-product-grid { grid-template-columns: repeat(2, 1fr); }
}
```

### 7. Responsive CartPage (`cart.css`)

**Current state:** Already has `min-width: 920px` for two-column layout. Below 920px, falls back to single column.

**Gap:** Quantity buttons don't have minimum 44 px dimensions enforced on mobile.

**Changes:**
```css
@media (max-width: 919px) {
  .cart-item-actions button,
  .cart-item-actions a {
    min-height: 44px;
    min-width: 44px;
  }
}
```

### 8. Responsive CheckoutPage (`checkout.css`)

**Current state:** Already has `@media (min-width: 768px)` for 2-col layout, and `@media (max-width: 480px)` for bottom-sheet payment modal. `.co-input` already has `width: 100%`.

**Gap:** Step indicator labels (`.co-step-dot-label`) use `white-space: nowrap` which can overflow at very narrow widths.

**Changes:**
```css
@media (max-width: 480px) {
  .co-step-dot-label {
    font-size: 10px;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

### 9. Responsive ProfilePage (`profile.css`)

**Current state:** Already has `@media (max-width: 700px)` switching to single-column grid and reducing padding. Sidebar has `position: sticky; top: 86px`.

**Gap:** Need to verify form fields inside `.pf-content` have `width: 100%` and sidebar items don't overflow at mobile.

**Changes:**
```css
@media (max-width: 700px) {
  .pf-sidebar { position: static; }  /* remove sticky on mobile */

  .pf-form input,
  .pf-form select,
  .pf-form textarea {
    width: 100%;
    max-width: 100%;
  }

  .pf-sidebar-item {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
```

### 10. Responsive MyOrdersPage and StatusOrderPage (`myOrders.css`, `statusOrder.css`)

**MyOrdersPage changes:**
```css
/* Wrap table in scrollable container */
.my-orders-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 767px) {
  .my-orders-card-footer {
    flex-wrap: wrap;
    gap: 8px;
  }
}
```

**StatusOrderPage changes:**
```css
@media (max-width: 767px) {
  .so-detail-grid {
    grid-template-columns: 1fr;
  }

  .so-timeline-step {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }
}
```

### 11. Responsive Staff Dashboards (`dashboard.css`, `StaffLayout.jsx`)

**Current state:** `staff-body` has `height: 100vh; overflow: hidden` globally applied. At `max-width: 760px`, the layout switches to `display: block`. However, `height: 100vh; overflow: hidden` is still applied even at mobile, preventing native scroll.

**Gap:** The `overflow: hidden` on `.staff-body` and `height: 100vh` on `.staff-layout` must be disabled on mobile/tablet.

**Changes:**
```css
@media (max-width: 1023px) {
  .staff-body {
    height: auto;
    overflow: visible;
  }

  .staff-layout {
    display: block;
    height: auto;
    padding: 16px;
  }

  .staff-sidebar {
    height: auto;
    position: static;
    margin-bottom: 16px;
  }

  .staff-main {
    height: auto;
    overflow: visible;
  }
}

@media (max-width: 767px) {
  .rev-kpi-row,
  .dir-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Chat panel stacks vertically */
  .chat-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    height: auto;
  }
}
```

### 12. Responsive Shared Components

**Modal (`modal.css`):**
```css
.modal {
  width: min(90vw, 520px);  /* was min(560px, 100%) — slightly narrower max */
  padding: 16px;
}

@media (max-width: 767px) {
  .modal {
    max-height: 90vh;
    overflow-y: auto;
  }
}
```

**ProductCard (`products.css` + `shared.css`):**
- `.product-card-media` already has `aspect-ratio: 4/5` and `object-fit: cover`.
- `.product-card-name` already has `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
- `.product-card-price` is a short formatted string — unlikely to overflow. Verify `white-space: nowrap` is set.

**ChatWidget (`chatWidget.css`):**
- Already has `@media (max-width: 440px)` setting `width: calc(100vw - 32px)`.
- Add explicit `max-width: 100vw; max-height: 80vh` to `.cw-box`.

```css
.cw-box {
  max-width: 100vw;
  max-height: 80vh;  /* was 620px fixed */
}
```

**Toast (`toast.css`):**
Currently positioned at `bottom: 24px; right: 24px`. The requirement asks for **top** positioning below the Navbar. The navbar is ~92 px tall (including secondary nav).

```css
#toast-container {
  position: fixed;
  top: 96px;   /* below sticky navbar (~92px) + 4px gap */
  right: 24px;
  bottom: auto;  /* remove bottom positioning */
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}
```

**Footer (`footer.css`):**
Already has `@media (max-width: 600px)` stacking `.footer-top` vertically. Adequate.

### 13. Touch Interaction and Tap Targets

A dedicated media query block using `@media (pointer: coarse)` ensures form inputs have adequate sizing on touch devices:

```css
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
```

Primary action buttons (`.btn`, `.co-submit-btn`, `.cart-checkout-btn`, etc.) should already be ≥44 px in height based on existing padding. A global rule ensures this:

```css
/* In buttons.css or shared.css */
.btn {
  min-height: 44px;
}
```

Adjacent interactive elements spacing is enforced through existing `gap` values in flex/grid containers (typically 8–12 px), which already satisfies the 8 px minimum.

### 14. No Horizontal Overflow

A global overflow guard added to `reset.css`:

```css
html {
  overflow-x: hidden;  /* prevent body-level horizontal scroll */
}

/* Optional: visual debugging class removed before prod */
```

The `.container` rule `width: min(100% - 32px, var(--container))` already prevents side-bleed. Any components with `min-width` pixel values (sidebar 240 px, product cards) must either scale or be wrapped in `overflow-x: auto` at mobile.

---

## Data Models

This feature is purely presentational — no new data models, API calls, or state management changes are introduced. The only state change is the existing `mobileOpen` boolean in `Navbar.jsx` which already controls the mobile menu toggle.

CSS custom properties used for layout:

```css
:root {
  --container: 1120px;     /* max container width */
  --navbar-h: 92px;        /* approximate navbar height for toast offset */
  /* breakpoints are not stored as CSS vars — they are in media queries */
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Container padding invariant

*For any* viewport width between 320 px and 767 px (Breakpoint_Mobile), the `.container` element's computed left padding and right padding SHALL each be at least 16 px, so that content never touches the screen edge.

**Validates: Requirements 2.2**

---

### Property 2: Hero heading font-size clamp

*For any* viewport width ≥ 320 px, the `.home-hero-label` computed `font-size` SHALL be in the range [28 px, 48 px] and the element SHALL NOT overflow its container (its `scrollWidth` SHALL equal its `offsetWidth`).

**Validates: Requirements 4.10**

---

### Property 3: No body-level horizontal overflow

*For any* viewport width between 320 px and 1440 px, the `document.body.scrollWidth` SHALL equal `document.body.clientWidth`, meaning no horizontal scrollbar is produced at the page level.

**Validates: Requirements 13.1, 13.2, 13.4**

---

### Property 4: Cart item child overflow containment

*For any* cart item card rendered with any product data (any product name, price, quantity, or description), no child element's `offsetWidth` SHALL exceed the cart item card's own `offsetWidth`.

**Validates: Requirements 6.3**

---

### Property 5: Primary action button tap target

*For any* primary action button (elements matching `.btn`, `.co-submit-btn`, `.login-popup-submit`, `.cart-checkout-btn`) on any device class, the computed `height` SHALL be ≥ 44 px and the computed `width` SHALL be ≥ 44 px.

**Validates: Requirements 12.1**

---

### Property 6: Navbar interactive element tap target on mobile

*For any* interactive element within the Navbar (hamburger toggle, cart icon, avatar button, search submit button) when rendered at a viewport width < 768 px, the element's computed `height` SHALL be ≥ 44 px and computed `width` SHALL be ≥ 44 px.

**Validates: Requirements 3.9, 12.2**

---

### Property 7: Modal viewport containment

*For any* viewport width ≥ 320 px, the `.modal` element's computed `width` SHALL be ≤ `min(90vw, 520px)` — that is, it SHALL NOT exceed 90% of the viewport width nor exceed 520 px.

**Validates: Requirements 11.1**

---

### Property 8: Product card name text containment

*For any* product with any name string (including very long names), the `.product-card-name` element's `scrollWidth` SHALL equal its `offsetWidth`, confirming the text is truncated with ellipsis and does not overflow the card.

**Validates: Requirements 11.3**

---

### Property 9: Quantity button tap target on mobile

*For any* quantity control button (increment or decrement) in the CartPage rendered at a viewport width < 768 px, the computed `height` SHALL be ≥ 44 px and the computed `width` SHALL be ≥ 44 px.

**Validates: Requirements 6.4**

---

### Property 10: Touch device form input sizing

*For any* form input element (`input`, `select`, `textarea`) on a device matching `@media (pointer: coarse)`, the computed `min-height` SHALL be ≥ 44 px.

**Validates: Requirements 12.3**

---

## Error Handling

Since this feature is entirely CSS/layout work, "errors" manifest as visual regressions rather than runtime exceptions. The following defensive patterns are applied:

### Overflow Containment
- `overflow-x: hidden` on `<html>` prevents a single overflowing element from adding a page-level scrollbar.
- Tables and wide content (staff data tables, order history) are wrapped in `overflow-x: auto` containers, so they scroll independently without breaking the outer layout.

### Fallback for Fixed-Pixel Components
- Staff sidebar (240 px): switched to `display: block` + `width: 100%` on mobile.
- Product cards (160 px min-width): grid columns use `1fr` units at mobile, so cards scale to fit.
- Chat widget (400 px): `max-width: calc(100vw - 32px)` ensures containment at any width.

### CSS Specificity Conflicts
- All responsive overrides are placed in `@media` blocks at the end of each CSS file, ensuring they override the base rules without relying on specificity hacks.

### Missing Breakpoint Gaps
- Where a component transitions from 4-column desktop to 2-column mobile with no intermediate tablet rule, a 3-column tablet rule is added to prevent abrupt layout jumps (e.g., CatalogProductPage, category grid).

---

## Testing Strategy

### Unit Tests (Example-Based)

These cover specific, discrete behaviors where a concrete example is more expressive than a universal property:

- **Navbar toggle behavior** — render `<Navbar>` at mobile width; click toggle → verify `.nav-mobile` has class `open`; click again → verify class removed.
- **Navbar popup containment at mobile** — render cart popup at 375 px viewport; verify no horizontal scrollbar.
- **Checkout layout at 600 px** — render `.co-layout` at 600 px; verify `grid-template-columns` is a single column.
- **Checkout bottom sheet at 400 px** — verify `.co-payment-overlay` has `align-items: flex-end` and `.co-payment-modal` has `border-radius: 16px 16px 0 0`.
- **Staff layout at tablet** — verify `.staff-body` does not have `overflow: hidden` at viewport < 1024 px.
- **Footer columns stack at mobile** — render `<Footer>` at 375 px; verify `.footer-top` computed `flex-direction` is `column`.
- **ProfilePage layout at ≤700 px** — verify `.pf-layout` renders as single column.
- **MyOrders table wrap** — verify `<table>` ancestor has `overflow-x: auto`.
- **Toast position** — render toast; verify `#toast-container` computed `top` ≥ 92 px (below navbar).

### Property-Based Tests

Property-based tests use **fast-check** (TypeScript/JavaScript PBT library). Each test runs a minimum of 100 iterations with randomly generated inputs. Tests are tagged with the property they validate.

**Library:** `fast-check` — `npm install --save-dev fast-check`

```
// Tag format: Feature: responsive-design, Property N: <property_text>
```

**Property 1 — Container padding invariant:**
Generate random viewport widths in [320, 767]. For each width, measure `.container` computed padding-left and padding-right. Assert both ≥ 16 px.

**Property 2 — Hero heading clamp:**
Generate random viewport widths in [320, 1440]. For each, compute what `clamp(28px, 5vw, 48px)` resolves to at that width. Assert result is in [28, 48] and no overflow occurs.

**Property 3 — No body horizontal overflow:**
Generate random viewport widths in [320, 1440] and random pages (HomePage, ProductsPage, CartPage, CheckoutPage). For each combination, render the page at that width and assert `document.body.scrollWidth === document.body.clientWidth`.

**Property 4 — Cart item child overflow:**
Generate random product data objects (varying name length 1–120 chars, varying price, varying quantity). Render a `CartItem` for each. Assert no child element's `offsetWidth` exceeds the card's `offsetWidth`.

**Property 5 — Primary action button tap target:**
Enumerate all primary action button selectors. For each, render at [320, 768, 1024] px viewports. Assert computed height ≥ 44 and width ≥ 44.

**Property 6 — Navbar interactive element tap target:**
Generate random viewport widths in [320, 767]. Render `<Navbar>` at each width. For each interactive element (toggle, cart, avatar), assert dimensions ≥ 44 px.

**Property 7 — Modal viewport containment:**
Generate random viewport widths in [320, 1440]. Render `<Modal>` at each width. Assert `offsetWidth ≤ Math.min(0.9 * viewportWidth, 520)`.

**Property 8 — Product card name text containment:**
Generate random product name strings (length 1–200, including Unicode, spaces, special characters). Render `<ProductCard>` for each. Assert `.product-card-name` `scrollWidth === offsetWidth`.

**Property 9 — Quantity button tap target:**
Generate random viewport widths in [320, 767]. Render cart quantity buttons at each width. Assert computed height ≥ 44 and width ≥ 44.

**Property 10 — Touch device form input sizing:**
Enumerate all form input types used in the application. For each, simulate `pointer: coarse` media query. Assert computed `min-height ≥ 44px`.

### Integration Tests

For behaviors involving the full rendered page across multiple components:

- **Cross-page overflow sweep** — automated Playwright test opening every public page route at widths [320, 375, 768, 1024, 1440] and asserting no horizontal scrollbar (`page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth)`).
- **Staff dashboard mobile scroll** — open each staff dashboard at 375 px; verify native vertical scroll works (body is scrollable).

### Test Configuration

```js
// vitest.config.js — property tests run with --run flag (non-watch)
// fast-check default: 100 runs per property
// For CI: fc.configureGlobal({ numRuns: 200 });
```

Each property-based test file is named `*.property.test.jsx` following the existing project convention (see `src/test/addressList.property.test.jsx`).
