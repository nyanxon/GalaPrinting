# Implementation Plan: Responsive Design

## Overview

This plan converts the responsive design document into incremental CSS and JSX coding tasks. Work is organized so foundational reset and utility changes land first, shared layout components come next, then page-specific overrides, and finally test coverage for the ten correctness properties. Each task wires directly into the existing plain-CSS file structure under `src/styles/css/` — no new frameworks or build steps are introduced.

## Tasks

- [x] 1. Verify and fix base reset and viewport meta tag
  - Confirm `index.html` contains `<meta name="viewport" content="width=device-width, initial-scale=1.0">` — add it if missing.
  - Add `overflow-x: hidden` to the `html` selector in `reset.css` to prevent body-level horizontal scroll.
  - Verify `box-sizing: border-box`, `max-width: 100%` on media elements, and no fixed `width` on `<body>` or `<html>` — add any missing rules.
  - Add `@media (pointer: coarse)` block to `reset.css` (or `shared.css`) enforcing `min-height: 44px` on all form input types.
  - Add global `.btn { min-height: 44px; }` rule to `buttons.css` or `shared.css`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 12.1, 12.3_

- [x] 2. Implement responsive grid utilities (`grid.css`)
  - [x] 2.1 Add tablet and mobile breakpoint overrides to `grid.css`
    - Add `@media (max-width: 1023px)` block reducing `.grid.cols-4` and `.grid.cols-3` to `repeat(2, 1fr)`.
    - Add `@media (max-width: 767px)` block collapsing `.grid.cols-2`, `.grid.cols-3`, and `.grid.cols-4` to a single `1fr` column.
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 2.2 Write property test for grid utility collapse (Property 3)
    - **Property 3: No body-level horizontal overflow**
    - **Validates: Requirements 13.1, 13.2, 13.4**
    - Use `fast-check` to generate random viewport widths in [320, 1440]; render each public page and assert `document.body.scrollWidth === document.body.clientWidth`.
    - Name the file `src/test/responsive/bodyOverflow.property.test.jsx`.

- [x] 3. Implement responsive Navbar (`navbar.css`)
  - [x] 3.1 Fix hamburger and nav-actions tap targets and overflow in `navbar.css`
    - Set `nav-toggle` to `width: 44px; height: 44px`.
    - Add `min-width: 44px; min-height: 44px` to `nav-cart-icon` and `nav-avatar-btn`.
    - Constrain `cart-popup`, `login-popup`, and `profile-popup` to `max-width: calc(100vw - 32px)` at `max-width: 919px`.
    - _Requirements: 3.2, 3.6, 3.7, 3.9, 12.2_

  - [x] 3.2 Write property test for Navbar tap targets on mobile (Property 6)
    - **Property 6: Navbar interactive element tap target on mobile**
    - **Validates: Requirements 3.9, 12.2**
    - Use `fast-check` to generate random viewport widths in [320, 767]; render `<Navbar>` at each width; assert every interactive element (toggle, cart, avatar, search submit) has computed height ≥ 44 px and width ≥ 44 px.
    - Name the file `src/test/responsive/navbarTapTarget.property.test.jsx`.

- [x] 4. Implement responsive HomePage (`home.css`)
  - [x] 4.1 Add tablet breakpoint for category grid in `home.css`
    - Add `@media (max-width: 1023px) and (min-width: 601px)` block setting `.home-cat-grid` to `grid-template-columns: repeat(3, 1fr)`.
    - Verify existing mobile rules (2-column cat-grid, stacked custom-order, stacked product section) are present and correct.
    - _Requirements: 4.2, 4.3, 4.5, 4.9, 4.10_

  - [x] 4.2 Write property test for hero heading clamp (Property 2)
    - **Property 2: Hero heading font-size clamp**
    - **Validates: Requirements 4.10**
    - Use `fast-check` to generate random viewport widths in [320, 1440]; compute expected `clamp(28px, 5vw, 48px)` value; assert computed `font-size` is in [28, 48] and `.home-hero-label` `scrollWidth === offsetWidth`.
    - Name the file `src/test/responsive/heroClamp.property.test.jsx`.

- [x] 5. Implement responsive ProductsPage and CatalogProductPage (`products.css`, `catalogProduct.css`)
  - [x] 5.1 Add tablet product grid override in `products.css`
    - Add `@media (max-width: 1023px)` block setting `.catalog-product-grid` to `grid-template-columns: repeat(2, 1fr)`.
    - Verify `@media (max-width: 768px)` sidebar stack rule is present.
    - _Requirements: 5.2, 5.3_

  - [x] 5.2 Add desktop, tablet, and mobile grid rules in `catalogProduct.css`
    - Confirm desktop default: `.catalog-product-grid { grid-template-columns: repeat(4, 1fr); }`.
    - Add `@media (max-width: 1023px)` reducing to `repeat(3, 1fr)`.
    - Add `@media (max-width: 767px)` reducing to `repeat(2, 1fr)`.
    - _Requirements: 5.4, 5.5, 5.6_

- [x] 6. Implement responsive CartPage (`cart.css`)
  - [x] 6.1 Add tap-target rules for quantity buttons in `cart.css`
    - Add `@media (max-width: 919px)` block setting `.cart-item-actions button, .cart-item-actions a { min-height: 44px; min-width: 44px; }`.
    - Verify existing single-column fallback below 920 px is in place.
    - _Requirements: 6.2, 6.4_

  - [x] 6.2 Write property test for cart item child overflow containment (Property 4)
    - **Property 4: Cart item child overflow containment**
    - **Validates: Requirements 6.3**
    - Use `fast-check` to generate random product data objects (name length 1–120 chars, varying price, quantity); render `CartItem` for each; assert no child element's `offsetWidth` exceeds the card's `offsetWidth`.
    - Name the file `src/test/responsive/cartItemOverflow.property.test.jsx`.

  - [x] 6.3 Write property test for quantity button tap targets (Property 9)
    - **Property 9: Quantity button tap target on mobile**
    - **Validates: Requirements 6.4**
    - Use `fast-check` to generate random viewport widths in [320, 767]; render cart quantity buttons; assert computed height ≥ 44 and width ≥ 44.
    - Name the file `src/test/responsive/quantityBtnTapTarget.property.test.jsx`.

- [x] 7. Implement responsive CheckoutPage (`checkout.css`)
  - [x] 7.1 Add step-indicator label truncation rule and verify existing rules in `checkout.css`
    - Add `@media (max-width: 480px)` block setting `.co-step-dot-label` to `font-size: 10px; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
    - Verify single-column `.co-layout` rule and `.co-payment-overlay` bottom-sheet rules are present.
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 8. Implement responsive ProfilePage (`profile.css`)
  - [x] 8.1 Add missing form and sidebar rules inside `@media (max-width: 700px)` in `profile.css`
    - Add `.pf-sidebar { position: static; }` to remove sticky on mobile.
    - Add `width: 100%; max-width: 100%;` to `.pf-form input, .pf-form select, .pf-form textarea`.
    - Add `max-width: 100%; overflow: hidden; text-overflow: ellipsis;` to `.pf-sidebar-item`.
    - _Requirements: 8.2, 8.3, 8.4_

- [x] 9. Implement responsive MyOrdersPage and StatusOrderPage (`myOrders.css`, `statusOrder.css`)
  - [x] 9.1 Add overflow wrapper and button wrap rules in `myOrders.css`
    - Add `overflow-x: auto; -webkit-overflow-scrolling: touch;` to `.my-orders-table-wrap` (create selector if missing).
    - Add `@media (max-width: 767px)` block setting `.my-orders-card-footer { flex-wrap: wrap; gap: 8px; }`.
    - _Requirements: 9.1, 9.4_

  - [x] 9.2 Add single-column and timeline rules in `statusOrder.css`
    - Add `@media (max-width: 767px)` block setting `.so-detail-grid { grid-template-columns: 1fr; }`.
    - Add `@media (max-width: 767px)` block with `.so-timeline-step { display: flex; flex-direction: row; align-items: flex-start; gap: 12px; flex-wrap: wrap; }`.
    - _Requirements: 9.2, 9.3_

- [x] 10. Implement responsive Staff Dashboards (`dashboard.css`)
  - [x] 10.1 Add tablet and mobile layout overrides in `dashboard.css`
    - Add `@media (max-width: 1023px)` block disabling `height: 100vh` and `overflow: hidden` on `.staff-body`, `.staff-layout`, `.staff-sidebar`, and `.staff-main`; switch layout to `display: block; height: auto;`.
    - Add `@media (max-width: 767px)` block reducing KPI grids (`.rev-kpi-row`, `.dir-kpi-grid`) to `repeat(2, 1fr)` and setting `.chat-layout` to `grid-template-columns: 1fr; grid-template-rows: auto 1fr; height: auto`.
    - _Requirements: 10.2, 10.3, 10.4, 10.6_

- [x] 11. Implement responsive shared components (`modal.css`, `chatWidget.css`, `toast.css`)
  - [x] 11.1 Update `modal.css` with viewport-safe sizing
    - Change modal width to `min(90vw, 520px)` and padding to `16px`.
    - Add `@media (max-width: 767px)` block setting `max-height: 90vh; overflow-y: auto;`.
    - _Requirements: 11.1, 11.2_

  - [x] 11.2 Write property test for modal viewport containment (Property 7)
    - **Property 7: Modal viewport containment**
    - **Validates: Requirements 11.1**
    - Use `fast-check` to generate random viewport widths in [320, 1440]; render `<Modal>` at each width; assert `offsetWidth ≤ Math.min(0.9 * viewportWidth, 520)`.
    - Name the file `src/test/responsive/modalContainment.property.test.jsx`.

  - [x] 11.3 Update `chatWidget.css` with viewport constraints
    - Add `max-width: 100vw; max-height: 80vh;` to `.cw-box` (replacing or supplementing the fixed `620px` height).
    - Verify `@media (max-width: 440px)` rule setting `width: calc(100vw - 32px)` is present.
    - _Requirements: 11.5_

  - [x] 11.4 Update `toast.css` to position below the Navbar
    - Change `#toast-container` from `bottom: 24px; right: 24px` to `top: 96px; right: 24px; bottom: auto;`.
    - Add `display: flex; flex-direction: column; gap: 10px; pointer-events: none;` to `#toast-container`.
    - _Requirements: 11.6_

  - [x] 11.5 Write property test for product card name text containment (Property 8)
    - **Property 8: Product card name text containment**
    - **Validates: Requirements 11.3**
    - Use `fast-check` to generate random product name strings (length 1–200, including Unicode and spaces); render `<ProductCard>` for each; assert `.product-card-name` `scrollWidth === offsetWidth`.
    - Name the file `src/test/responsive/productCardName.property.test.jsx`.

- [x] 12. Checkpoint — Verify tap targets, overflow guard, and container padding
  - Ensure all tests pass. Spot-check in browser at 320 px, 768 px, and 1024 px widths for any visible overflow or broken layout. Ask the user if questions arise.

- [x] 13. Write remaining property-based tests
  - [x] 13.1 Write property test for container padding invariant (Property 1)
    - **Property 1: Container padding invariant**
    - **Validates: Requirements 2.2**
    - Use `fast-check` to generate random viewport widths in [320, 767]; measure `.container` computed `padding-left` and `padding-right`; assert both ≥ 16 px.
    - Name the file `src/test/responsive/containerPadding.property.test.jsx`.

  - [x] 13.2 Write property test for primary action button tap targets (Property 5)
    - **Property 5: Primary action button tap target**
    - **Validates: Requirements 12.1**
    - Enumerate selectors `.btn`, `.co-submit-btn`, `.login-popup-submit`, `.cart-checkout-btn`; render at [320, 768, 1024] px viewports; assert computed height ≥ 44 and width ≥ 44 for each.
    - Name the file `src/test/responsive/primaryBtnTapTarget.property.test.jsx`.

  - [x] 13.3 Write property test for touch device form input sizing (Property 10)
    - **Property 10: Touch device form input sizing**
    - **Validates: Requirements 12.3**
    - Enumerate all form input types used in the application; simulate `pointer: coarse` media query; assert computed `min-height ≥ 44px` for each.
    - Name the file `src/test/responsive/touchInputSizing.property.test.jsx`.

  - [x] 13.4 Install `fast-check` if not already present
    - Run `npm install --save-dev fast-check` in the project root.
    - Confirm vitest config supports `*.property.test.jsx` file pattern.
    - _Requirements: Design Testing Strategy section_

- [x] 14. Final checkpoint — Full test suite and visual review
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All CSS changes go inside `@media` blocks at the end of each existing stylesheet — no rule reordering needed
- `fast-check` is the PBT library specified in the design; install with `npm install --save-dev fast-check`
- Each property test file follows the project convention: `*.property.test.jsx` (see `src/test/addressList.property.test.jsx`)
- Breakpoints used: desktop ≥1024 px (no query), tablet 768–1023 px (`max-width: 1023px`), mobile <768 px (`max-width: 767px`); page-specific exceptions (cart 920 px, checkout 768 px, profile 700 px) are preserved
- Checkpoints validate incremental progress before moving to test coverage

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "13.4"] },
    { "id": 1, "tasks": ["3.1", "4.1", "5.1", "5.2", "6.1", "7.1", "8.1", "9.1", "9.2", "10.1", "11.1", "11.3", "11.4"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "6.2", "6.3", "11.2", "11.5"] },
    { "id": 3, "tasks": ["13.1", "13.2", "13.3"] }
  ]
}
```
