# Requirements Document

## Introduction

This document covers the migration of the `gala-printing` vanilla JavaScript multi-page application (MPA) to a React single-page application (SPA) within the existing Vite + React scaffold (`gala-print-web`). The migration is a structural refactoring: no new features are added and no business logic changes. All existing UI, styling, behaviour, role-based access control, and service-layer logic must be preserved. The output is a component-based React SPA that renders identically to the original vanilla JS version, is maintainable, and follows React best practices.

The source application is a full e-commerce and multi-role admin system for a printing business. It includes a public storefront (product catalogue, cart, checkout, order tracking), a customer portal (order history, chat), and five distinct staff dashboards (Super Admin, Owner, Cashier, Customer Service, Operational, Quality Control, Offline/walk-in).

## Glossary

- **App**: The root React component rendered by `src/main.jsx` into `#root`.
- **Component**: A self-contained React function component (`.jsx` file) responsible for a discrete section of the UI.
- **Page_Component**: A top-level component that maps 1-to-1 with a route and composes the full page layout for that route.
- **Vanilla_Source**: The original `gala-printing/` vanilla JS HTML/CSS/JS files that serve as the migration source.
- **Scaffold**: The existing Vite + React project (`gala-print-web`) with `src/App.jsx`, `src/main.jsx`, `vite.config.js`, and `package.json` already in place.
- **Service**: A JavaScript module under `js/services/` in the vanilla source that encapsulates all data access and business logic against `localStorage`. Services are preserved as-is and imported by React components.
- **Router**: React Router (v6+) used to replace the vanilla `js/routes/router.js` and the MPA HTML-per-page architecture.
- **Role_Guard**: A React component or hook that checks the authenticated user's role and redirects or blocks access to routes that require a specific role.
- **Global_State**: Application-wide reactive data (current user, cart contents) previously managed by `js/core/state.js`, replaced by React Context + hooks.
- **Static_Asset**: An image, SVG, font, or other binary file referenced by the UI (e.g. `logo.png`, `placeholder.svg`).
- **CSS_Custom_Property**: A CSS variable defined in `variables.css` (e.g. `--brand-brown`) used throughout the stylesheet.
- **Toast**: A transient notification rendered by `js/core/toast.js` / `chatWidget.css` / `toast.css`.
- **Modal**: A generic overlay dialog previously managed by `js/components/modal.js`.
- **Role**: One of the eight user roles in the system — `customer`, `admin`, `owner`, `cashier`, `cs`, `operational`, `qc`, `offline`.
- **Staff_Role**: Any Role that is not `customer` — i.e. `admin`, `owner`, `cashier`, `cs`, `operational`, `qc`, `offline`.
- **HMR**: Vite Hot Module Replacement — live reload of changed modules without a full page refresh.
- **MPA**: Multi-Page Application — the original architecture where each page is a separate HTML file.
- **SPA**: Single-Page Application — the target architecture where React Router handles navigation client-side.

---

## Requirements

### Requirement 1: Project Structure and Vite SPA Entry Point

**User Story:** As a developer, I want the migrated project to use the existing Vite + React scaffold as its single entry point, so that the MPA HTML-per-page architecture is replaced by a React SPA without changing the build pipeline.

#### Acceptance Criteria

1. THE Scaffold SHALL retain `src/main.jsx` as the sole application entry point, rendering `<App />` inside `React.StrictMode`.
2. THE Scaffold SHALL retain `index.html` with a single `<div id="root">` mount point and no inline scripts beyond the Vite module entry.
3. THE App SHALL be the single root component exported from `src/App.jsx` and imported by `src/main.jsx`.
4. WHEN the development server starts, THE Scaffold SHALL serve the application with HMR enabled.
5. THE Scaffold SHALL NOT retain any of the original `pages/*.html` files as separate entry points; all navigation SHALL be handled by the Router.
6. THE Scaffold SHALL remove the ghost directories `js/js/`, `js/pages/` (legacy entry points superseded by the router), and `js/modules/director/` before migration begins.

---

### Requirement 2: Routing — Replacing the MPA with React Router

**User Story:** As a developer, I want all page navigation handled by React Router, so that the application behaves as a SPA and the vanilla `router.js` role-guard logic is preserved.

#### Acceptance Criteria

1. THE Router SHALL define a route for each of the following paths, mapping each to its corresponding Page_Component:

   | Path | Page_Component |
   |---|---|
   | `/` | `HomePage` |
   | `/products` | `ProductsPage` |
   | `/products/:slug` | `CatalogProductPage` |
   | `/cart` | `CartPage` |
   | `/checkout` | `CheckoutPage` |
   | `/register` | `RegisterPage` |
   | `/status` | `StatusOrderPage` |
   | `/my-orders` | `MyOrdersPage` |
   | `/cara-order` | `CaraOrderPage` |
   | `/portfolio` | `PortfolioPage` |
   | `/tentang-kami` | `TentangKamiPage` |
   | `/admin` | `AdminDashboardPage` |
   | `/owner` | `OwnerDashboardPage` |
   | `/cashier` | `CashierDashboardPage` |
   | `/cs` | `CSDashboardPage` |
   | `/operational` | `OperationalDashboardPage` |
   | `/qc` | `QCDashboardPage` |
   | `/offline` | `OfflineDashboardPage` |

2. WHEN a user navigates to a route that does not match any defined path, THE Router SHALL render a `NotFoundPage` component.
3. THE Router SHALL use `BrowserRouter` (HTML5 history API) so that URLs match the original MPA paths.
4. WHEN the application boots, THE Router SHALL call `seedStaffUsers()` from `authService.js` and `hydrateUser()` from `authService.js` before rendering any route, preserving the vanilla boot sequence.

---

### Requirement 3: Role-Based Access Control

**User Story:** As a developer, I want the role-guard logic from `router.js` preserved as a React component, so that staff dashboards remain inaccessible to unauthenticated users or users with the wrong role.

#### Acceptance Criteria

1. THE Role_Guard SHALL read the current user's role from Global_State and compare it against the required role for the route.
2. WHEN an unauthenticated user navigates to a Staff_Role route, THE Role_Guard SHALL redirect the user to `/register`.
3. WHEN an authenticated user with an incorrect role navigates to a Staff_Role route, THE Role_Guard SHALL redirect the user to `/register`.
4. WHEN an authenticated user with the correct role navigates to a Staff_Role route, THE Role_Guard SHALL render the protected Page_Component.
5. THE Role_Guard SHALL support all eight Roles defined in `js/core/config.js` (`STAFF_ROLES` constant).
6. THE Role_Guard SHALL be implemented as a reusable wrapper component so that each staff route can declare its required role declaratively in the route definition.

---

### Requirement 4: Global State Management

**User Story:** As a developer, I want the global reactive state (current user and cart) managed by React Context and hooks, so that `state.js` direct-mutation patterns are replaced with idiomatic React state.

#### Acceptance Criteria

1. THE App SHALL provide an `AuthContext` that exposes the current user object and an `updateUser` function to all descendant components.
2. THE App SHALL provide a `CartContext` that exposes the cart item array, a `addItem` function, a `removeItem` function, and a `clearCart` function to all descendant components.
3. WHEN `authService.js` `hydrateUser()` resolves on boot, THE AuthContext SHALL initialise its state with the returned user object.
4. WHEN a user logs in or registers, THE AuthContext SHALL update its state so that all subscribed components re-render without a page reload.
5. WHEN a cart item is added or removed, THE CartContext SHALL update its state so that the navbar cart badge and cart page re-render without a page reload.
6. THE App SHALL use no direct DOM manipulation (`document.querySelector`, `innerHTML`, `addEventListener`) for state that React manages.
7. WHEN a component unmounts, THE App SHALL leave no orphaned event listeners attached to the DOM.

---

### Requirement 5: Service Layer Preservation

**User Story:** As a developer, I want all existing service modules preserved and imported directly into React components, so that no business logic or localStorage data schema is changed during migration.

#### Acceptance Criteria

1. THE Scaffold SHALL copy the following service files from the vanilla source into `src/services/` without modification to their exported function signatures:
   - `authService.js`
   - `cartService.js`
   - `orderService.js`
   - `productService.js`
   - `categoryService.js`
   - `chatService.js`
   - `reviewService.js`
   - `analyticsService.js`
2. THE Scaffold SHALL copy the following core utility files from the vanilla source into `src/core/` without modification:
   - `config.js`
   - `storage.js`
   - `helpers.js`
   - `validate.js`
   - `notifications.js`
   - `httpClient.js`
3. WHEN a React component needs data, THE Component SHALL call the corresponding service function and store the result in local component state via `useState` or `useEffect`.
4. THE Service files SHALL NOT be refactored to use React-specific APIs; they SHALL remain framework-agnostic JavaScript modules.

---

### Requirement 6: Component Decomposition — Shared Shell

**User Story:** As a developer, I want the shared navbar, footer, toast system, and chat widget implemented as React components, so that they appear consistently across all public-facing pages.

#### Acceptance Criteria

1. THE App SHALL render a `<Navbar>` component on all public and customer routes, equivalent to `js/components/navbar.js` `renderNavbar()` + `bindNavbar()`.
2. THE App SHALL render a `<Footer>` component on all public and customer routes, equivalent to `js/components/footer.js`.
3. THE App SHALL render a `<ChatWidget>` component on all public and customer routes, equivalent to `js/components/chatWidget.js`.
4. THE App SHALL render a `<Toast>` component at the root level that is accessible to all routes, equivalent to `js/core/toast.js` `showToast()`.
5. WHEN `showToast()` is called from any component, THE Toast SHALL display the message and auto-dismiss after the same duration as the vanilla implementation.
6. THE Navbar SHALL display the cart item count badge using CartContext state, updating reactively when items are added or removed.
7. THE Navbar SHALL display the correct navigation links based on the authenticated user's role from AuthContext.
8. Staff dashboard routes SHALL NOT render the public `<Navbar>`, `<Footer>`, or `<ChatWidget>`; they SHALL render their own sidebar shell.

---

### Requirement 7: Component Decomposition — Public Pages

**User Story:** As a developer, I want each public-facing page decomposed into focused React components, so that each section of the page is independently readable and maintainable.

#### Acceptance Criteria

1. THE `HomePage` SHALL render sections equivalent to `js/modules/home/homeView.js`, including hero banner, featured products, and any promotional sections.
2. THE `ProductsPage` SHALL render a product grid using a `<ProductCard>` component equivalent to `js/components/productCard.js`, with filtering and pagination state managed via `useState`.
3. THE `CatalogProductPage` SHALL render the product detail view including the design file upload (base64 encoding) and add-to-cart functionality from `catalogProductController.js`.
4. THE `CartPage` SHALL render the cart item list with quantity controls and totals, equivalent to `js/modules/cart/cartView.js`.
5. THE `CheckoutPage` SHALL render the checkout form and trigger the `<PaymentModal>` on submission, equivalent to `js/modules/public/checkout/checkoutController.js`.
6. THE `RegisterPage` SHALL render both the login and registration forms and handle staff role redirect on successful login, equivalent to `js/modules/register/registerController.js`.
7. THE `StatusOrderPage` SHALL render the 8-step order timeline and courier tracking lookup by order number and phone, equivalent to `js/modules/statusOrder/statusOrderView.js`.
8. THE `MyOrdersPage` SHALL render the customer's order history with a pay button for pending orders, equivalent to `js/modules/myOrders/myOrdersController.js`.
9. THE `CaraOrderPage`, `PortfolioPage`, and `TentangKamiPage` SHALL render their respective static content pages.

---

### Requirement 8: Component Decomposition — Shared Modal Components

**User Story:** As a developer, I want the payment modal and order detail modal implemented as reusable React components, so that they can be triggered from multiple pages without duplicating logic.

#### Acceptance Criteria

1. THE `<PaymentModal>` SHALL implement the 2-step payment flow (QRIS display → proof-of-payment file upload) equivalent to `js/modules/shared/paymentModal.js`.
2. THE `<OrderDetailModal>` SHALL implement the order detail viewer with file lightbox equivalent to `js/modules/shared/orderDetailModal.js`.
3. WHEN a modal is open, THE Modal SHALL trap keyboard focus within the modal overlay and restore focus to the trigger element on close.
4. WHEN the user presses Escape, THE Modal SHALL close.
5. THE `<Modal>` base component SHALL be a generic overlay wrapper equivalent to `js/components/modal.js`, reused by both `<PaymentModal>` and `<OrderDetailModal>`.

---

### Requirement 9: Component Decomposition — Admin Dashboard (Super Admin)

**User Story:** As a developer, I want the Super Admin dashboard decomposed into a sidebar shell and section components, so that each admin section is independently maintainable.

#### Acceptance Criteria

1. THE `AdminDashboardPage` SHALL render a sidebar shell equivalent to `js/modules/admin/dashboard/adminView.js`.
2. THE `AdminDashboardPage` SHALL render the following section components, each equivalent to its vanilla counterpart in `js/modules/admin/dashboard/sections/`:
   - `<OrdersSection>` — paginated orders table with status select dropdown
   - `<CustomersSection>` — customer list
   - `<ProductsSection>` — product CRUD table
   - `<ReviewsSection>` — review moderation table
   - `<ChatsSection>` — WhatsApp-style chat panel
3. WHEN the admin selects a section from the sidebar, THE AdminDashboardPage SHALL display the corresponding section component without a full page reload.
4. THE `<ChatsSection>` SHALL render the conversation list and message thread equivalent to `js/modules/admin/dashboard/sections/chatsSection.js`, using `chatService.js` for data.

---

### Requirement 10: Component Decomposition — Owner Dashboard

**User Story:** As a developer, I want the Owner dashboard to include all Super Admin sections plus revenue, reports, and analytics sections, so that the owner role retains its full visibility.

#### Acceptance Criteria

1. THE `OwnerDashboardPage` SHALL render all sections available in `AdminDashboardPage` plus the following additional sections equivalent to `js/modules/owner/dashboard/sections/`:
   - `<RevenueSection>` — revenue summary and charts
   - `<ReportsSection>` — downloadable reports
   - `<AnalyticsSection>` — product view and visit analytics
2. THE `<RevenueSection>` and `<AnalyticsSection>` SHALL render SVG charts using the chart generator logic from `js/components/charts.js` and `js/modules/owner/dashboard/components/charts.js`, implemented as a `<Chart>` React component.
3. THE `<AnalyticsSection>` SHALL call `analyticsService.js` `getBestSellers()` and `recordVisit()` equivalently to the vanilla implementation.

---

### Requirement 11: Component Decomposition — Sub-Admin Dashboards

**User Story:** As a developer, I want the four sub-admin dashboards (Cashier, CS, Operational, QC) implemented as React components sharing a common layout, so that the shared `subAdminController.js` logic is not duplicated.

#### Acceptance Criteria

1. THE `CashierDashboardPage`, `CSDashboardPage`, `OperationalDashboardPage`, and `QCDashboardPage` SHALL each render a dashboard equivalent to the corresponding vanilla page (`cashier.html`, `cs.html`, `operational.html`, `qc.html`).
2. THE four sub-admin Page_Components SHALL share a common `<SubAdminLayout>` wrapper component that encapsulates the sidebar shell and section-switching logic from `js/modules/subadmin/subAdminController.js`.
3. WHEN a sub-admin user is authenticated, THE Role_Guard SHALL permit access only to the route matching that user's role.

---

### Requirement 12: Component Decomposition — Offline Admin Dashboard

**User Story:** As a developer, I want the Offline Admin dashboard implemented as a React component, so that walk-in order entry and receipt printing are preserved.

#### Acceptance Criteria

1. THE `OfflineDashboardPage` SHALL render the walk-in order entry form and receipt view equivalent to `js/modules/offline/offlineController.js`.
2. WHEN an offline order is submitted, THE OfflineDashboardPage SHALL call `orderService.js` `createOrder()` and display a printable receipt.

---

### Requirement 13: CSS Migration — Preserve All Existing Styles

**User Story:** As a developer, I want all existing CSS files preserved and correctly imported in the React project, so that the migrated application renders visually identically to the original.

#### Acceptance Criteria

1. THE Scaffold SHALL copy the entire `css/` directory from the vanilla source into `src/styles/`, preserving the directory structure (`base/`, `components/`, `layout/`, `pages/`).
2. THE `src/index.css` SHALL import `src/styles/main.css` (or inline the `@import` chain from `main.css`) so that all global styles are loaded once at application boot.
3. THE CSS_Custom_Properties defined in `variables.css` (e.g. `--brand-brown`) SHALL be available globally to all components without modification.
4. WHEN a Page_Component corresponds to a vanilla page that has a dedicated page CSS file (e.g. `cart.css`, `dashboard.css`), THE Page_Component SHALL import that CSS file directly so styles are loaded when the page is rendered.
5. THE Component SHALL apply CSS class names using the `className` JSX attribute, not the `class` attribute.
6. IF a CSS rule targets an element by `id`, THEN THE Component SHALL render that element with the matching `id` attribute so existing styles continue to apply.
7. THE Scaffold SHALL NOT convert any existing CSS to CSS Modules or CSS-in-JS; all styles SHALL remain as plain CSS files.

---

### Requirement 14: Static Asset Handling

**User Story:** As a developer, I want all images and SVG assets from the vanilla source available in the React project, so that no visual assets are missing after migration.

#### Acceptance Criteria

1. THE Scaffold SHALL copy `assets/img/logo.png` and `assets/img/placeholder.svg` from the vanilla source into `src/assets/` (or `public/` for assets that must be served at a fixed URL).
2. THE Component SHALL import each image asset using an ES module `import` statement rather than a hard-coded public path string, unless the asset is in `public/`.
3. WHEN a Static_Asset is referenced in JSX, THE Component SHALL use the imported module reference as the `src` attribute value.
4. THE Scaffold SHALL serve inline SVG sprite references (e.g. `<use href="/icons.svg#...">`) from the `public/` directory without modification.
5. IF a font file is added to `assets/fonts/` in the future, THEN THE Scaffold SHALL serve it via `public/` or import it in `src/index.css` using `@font-face`.

---

### Requirement 15: Accessibility Preservation

**User Story:** As a developer, I want all accessibility attributes from the original markup preserved in JSX, so that the migrated application maintains the same accessibility characteristics.

#### Acceptance Criteria

1. THE Component SHALL preserve all `aria-*` attributes present in the original HTML on the corresponding JSX elements.
2. THE Component SHALL preserve all `role` attributes present in the original HTML on the corresponding JSX elements.
3. WHEN an image is decorative, THE Component SHALL render it with `alt=""`.
4. WHEN an image conveys meaning, THE Component SHALL render it with a descriptive `alt` attribute matching the original.
5. WHEN a Modal is open, THE Modal SHALL set `aria-modal="true"` and `role="dialog"` on the overlay element.
6. WHEN a Toast notification appears, THE Toast SHALL use `role="status"` or `aria-live="polite"` so screen readers announce the message.
7. THE Navbar SHALL render navigation landmarks using `<nav>` with an `aria-label` attribute.

---

### Requirement 16: Build and Lint Compliance

**User Story:** As a developer, I want the migrated codebase to pass the existing build and lint checks without errors, so that the project is ready for further development.

#### Acceptance Criteria

1. WHEN `vite build` is executed, THE Scaffold SHALL produce a production bundle with no errors.
2. WHEN `eslint .` is executed, THE Scaffold SHALL report zero errors against the existing ESLint configuration.
3. THE Component SHALL not use deprecated React APIs (e.g. string refs).
4. IF a component renders a list of elements, THEN THE Component SHALL assign a stable, unique `key` prop to each list item.
5. THE Scaffold SHALL add `react-router-dom` as a dependency in `package.json` before any routing code is written.
6. WHEN `vite build` produces a bundle, THE Scaffold SHALL not include any of the removed ghost directories (`js/js/`, `js/pages/` legacy entry points, `js/modules/director/`) in the output.
