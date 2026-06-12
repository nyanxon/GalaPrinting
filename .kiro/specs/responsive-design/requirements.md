# Requirements Document

## Introduction

Gala Web is a React + Vite e-commerce platform for custom print orders. The application currently contains a full set of public-facing pages (HomePage, ProductsPage, CartPage, CheckoutPage, ProfilePage, MyOrdersPage, StatusOrderPage, RegisterPage, PortfolioPage, CaraOrderPage, TentangKamiPage, CatalogProductPage) as well as internal staff dashboards (Admin, Owner, Sub-admin roles: Cashier, CS, Operational, QC). The CSS is organized into base variables, layout utilities, shared components, and per-page stylesheets — all plain CSS without a utility-class framework.

The goal of this feature is to make every page and shared component in the application fully responsive across three device classes: desktop (≥1024 px), tablet (768 px – 1023 px), and mobile (< 768 px), so that users on any screen size can browse, order, and manage their account without horizontal scrolling, overlapping elements, or broken layouts.

---

## Glossary

- **Application**: The complete Gala Web React frontend served by Vite.
- **Breakpoint_Mobile**: Viewport width strictly less than 768 px.
- **Breakpoint_Tablet**: Viewport width between 768 px and 1023 px inclusive.
- **Breakpoint_Desktop**: Viewport width of 1024 px or greater.
- **Container**: The `.container` CSS class that constrains content width to `--container` (1120 px) with auto side margins and 16 px side padding.
- **Navbar**: The `<Navbar>` shared component rendered inside `PublicLayout` and visible on all public pages.
- **Mobile_Menu**: The collapsible navigation panel that replaces the desktop horizontal nav at Breakpoint_Mobile.
- **Staff_Layout**: The `<StaffLayout>` component used by admin, owner, and sub-admin dashboards.
- **Staff_Sidebar**: The left sidebar inside `Staff_Layout` containing role navigation items.
- **Product_Card**: The `<ProductCard>` shared component used on HomePage, ProductsPage, and CatalogProductPage.
- **Drop_Zone**: The file-upload area on HomePage used to accept custom design files.
- **Touch_Target**: An interactive element (button, link, input) with a minimum tappable area.

---

## Requirements

### Requirement 1: Responsive Viewport Meta Tag and Base Reset

**User Story:** As a user on a mobile device, I want the browser to render the page at the correct scale without requiring me to zoom out, so that I can immediately read and interact with content.

#### Acceptance Criteria

1. THE Application SHALL include a `<meta name="viewport">` tag in `index.html` with `content` containing `width=device-width` and `initial-scale=1` (or `initial-scale=1.0`), so that mobile browsers render the page at the device's native width without automatic zoom.
2. THE Application SHALL set `box-sizing: border-box` on all elements (via `*, *::before, *::after`) so that padding and border are included in element dimensions and do not cause unintended overflow.
3. THE Application SHALL set `max-width: 100%` on `img`, `svg`, `video`, and `canvas` elements so that media never overflows its containing block on any device class.
4. THE Application SHALL NOT set a `width` property with a fixed pixel value on the `<body>` or `<html>` elements; permitted values are `100%`, `auto`, or no explicit `width` declaration.

---

### Requirement 2: Responsive Container and Grid Utilities

**User Story:** As a developer, I want a consistent Container width and grid system, so that all pages share a uniform responsive layout foundation.

#### Acceptance Criteria

1. THE Container SHALL use `width: min(100% - 32px, 1120px)` with `margin-inline: auto` so that it fills the viewport on narrow screens and is horizontally centered with at least 16 px of padding on each side on wide screens.
2. WHEN the viewport is at Breakpoint_Mobile, THE Container SHALL have a computed left padding and a computed right padding each of at least 16 px, so that content does not touch the screen edges.
3. THE Application SHALL provide CSS grid utility classes (`.grid.cols-2`, `.grid.cols-3`, `.grid.cols-4`) that each produce a single-column layout at Breakpoint_Mobile, measurable by the grid having `grid-template-columns` equivalent to `1fr` or a single column at viewport widths below 768 px.
4. WHEN the viewport is at Breakpoint_Tablet, THE Application SHALL render `.grid.cols-4` as a two-column grid (`grid-template-columns` equivalent to `repeat(2, 1fr)`), so that four-up grids remain legible on tablet-sized screens.
5. WHEN the viewport is at Breakpoint_Tablet, THE Application SHALL render `.grid.cols-3` as a two-column grid, so that three-up grids do not produce overly narrow columns on tablet widths.

---

### Requirement 3: Responsive Navbar

**User Story:** As a user on a mobile or tablet device, I want a usable navigation bar, so that I can access all site sections without the navbar overflowing or covering page content.

#### Acceptance Criteria

1. WHEN the viewport is at Breakpoint_Desktop, THE Navbar SHALL display the brand logo, category dropdown button, search bar, cart icon, and user authentication controls in a single horizontal row with no element wrapping to a second line.
2. WHEN the viewport is at Breakpoint_Mobile, THE Navbar SHALL hide the secondary navigation links and auth controls and display a hamburger toggle button, so that the navbar row contains only the brand logo, search bar, and the hamburger button.
3. WHEN the hamburger toggle is activated on Breakpoint_Mobile, THE Mobile_Menu SHALL expand as an overlay above page content and display all navigation links and auth controls as a vertical list, so that the underlying page layout is not reflowed.
4. WHEN the hamburger toggle is activated while the Mobile_Menu is open, THE Mobile_Menu SHALL collapse and the overlay SHALL be removed.
5. THE Navbar SHALL have `position: sticky` and `top: 0` on all device classes so that it remains visible at the top of the viewport during scroll.
6. WHEN the viewport is at Breakpoint_Mobile, THE Navbar search bar SHALL be visible and operable — accepting text input and submitting a search — and its width SHALL fill the available horizontal space between the brand logo and the hamburger button.
7. WHEN the viewport is at Breakpoint_Mobile, any popup rendered inside the Navbar (cart popup, login popup, profile popup) SHALL have a computed width no greater than `100vw` and SHALL NOT produce a horizontal scrollbar on `<body>`.
8. THE Navbar brand logo `<img>` or `<svg>` element SHALL have `max-width: 100%` and `height: auto` so that it scales proportionally within its flex or grid container on all device classes without overflowing.
9. WHEN the viewport is at Breakpoint_Mobile, all interactive elements inside the Navbar (hamburger button, cart icon, user avatar, search submit button) SHALL have a computed height of at least 44 px and a computed width of at least 44 px.
10. WHEN the viewport is at Breakpoint_Tablet, THE Navbar SHALL display the brand logo, search bar, cart icon, and authentication controls in a single horizontal row; secondary text-only navigation links MAY be hidden or collapsed to keep the row uncluttered.
11. WHEN the viewport is at Breakpoint_Tablet OR Breakpoint_Mobile, THE page content area below the Navbar SHALL have a `padding-top` or `margin-top` equal to or greater than the Navbar's computed height so that sticky Navbar does not overlap page content.

---

### Requirement 4: Responsive HomePage

**User Story:** As a customer browsing on a phone or tablet, I want the home page sections to reflow sensibly, so that I can browse featured products, use the search bar, and upload a design without horizontal scrolling.

#### Acceptance Criteria

1. WHEN the viewport is at Breakpoint_Desktop, THE HomePage SHALL display the category quick-links in a four-column grid beside the search row, with no category item wrapping outside the grid.
2. WHEN the viewport is at Breakpoint_Mobile, THE HomePage category quick-links grid SHALL render as a two-column grid (`grid-template-columns: repeat(2, 1fr)` or equivalent) so that all category links remain legible without horizontal scrolling.
3. WHEN the viewport is at Breakpoint_Tablet, THE HomePage category quick-links grid SHALL render as a three- or four-column grid so that items are not excessively large on mid-size screens.
4. WHEN the viewport is at Breakpoint_Desktop, THE HomePage custom-order section SHALL display the Drop_Zone and the order information text as two side-by-side columns in a flex or grid row.
5. WHEN the viewport is at Breakpoint_Mobile, THE HomePage custom-order section SHALL display the Drop_Zone stacked above the order information text in a single-column layout with no horizontal overflow.
6. WHEN the viewport is at Breakpoint_Tablet, THE HomePage custom-order section SHALL display the Drop_Zone and order information text side-by-side if the combined width fits, or stack them vertically if it does not, with no element overflowing the Container.
7. WHEN the viewport is at Breakpoint_Desktop, THE HomePage SHALL display product sections in a zig-zag layout with a category banner column and a product grid column beside it, where the product grid shows four cards per row.
8. WHEN the viewport is at Breakpoint_Tablet, THE HomePage product grid SHALL render in a two-column grid so that product cards remain usable at mid-size viewports.
9. WHEN the viewport is at Breakpoint_Mobile, THE HomePage product section SHALL stack the category banner above the product grid in a single column, and the product grid SHALL render in a two-column grid; for sections where the desktop layout uses `flex-direction: row-reverse`, the category banner SHALL still appear above (not below) the product grid on mobile.
10. THE HomePage hero banner heading text SHALL scale proportionally across all device classes — having a smaller computed font size at Breakpoint_Mobile than at Breakpoint_Desktop — and SHALL NOT overflow its container at any viewport width of 320 px or greater.

---

### Requirement 5: Responsive ProductsPage and CatalogProductPage

**User Story:** As a customer searching for products on a tablet or phone, I want the product catalog layout to adapt, so that I can easily browse and filter products.

#### Acceptance Criteria

1. WHEN the viewport is at Breakpoint_Desktop, THE ProductsPage SHALL display a sidebar filter panel beside a product grid in a side-by-side two-column layout, with the sidebar occupying a fixed or `min-content` width and the product grid occupying the remaining space.
2. WHEN the viewport is at Breakpoint_Mobile OR Breakpoint_Tablet, THE ProductsPage sidebar filter panel SHALL be visible without a toggle — it SHALL render at full container width and be positioned above the product grid in a single-column stack, so that filters are immediately accessible without an extra tap.
3. WHEN the viewport is at Breakpoint_Mobile OR Breakpoint_Tablet, THE ProductsPage product grid SHALL render in a two-column layout (`grid-template-columns: repeat(2, 1fr)` or equivalent).
4. WHEN the viewport is at Breakpoint_Desktop, THE CatalogProductPage SHALL display products in a four-column grid.
5. WHEN the viewport is at Breakpoint_Mobile, THE CatalogProductPage SHALL display products in a two-column grid.
6. WHEN the viewport is at Breakpoint_Tablet, THE CatalogProductPage SHALL display products in a three-column grid so that the transition from four columns (desktop) to two columns (mobile) is not abrupt.

---

### Requirement 6: Responsive CartPage

**User Story:** As a customer reviewing my cart on a mobile device, I want the cart and order summary to be readable and actionable without horizontal scrolling.

#### Acceptance Criteria

1. WHEN the viewport is at Breakpoint_Desktop (≥1024 px), THE CartPage SHALL display the cart items list and the order summary panel in a two-column grid with column proportions `1fr 360px`, matching the existing `cart.css` layout.
2. WHEN the viewport is at Breakpoint_Mobile OR Breakpoint_Tablet (below 1024 px), THE CartPage SHALL display the cart items list and the order summary panel in a single-column stack, with the cart items list appearing above the order summary panel.
3. WHEN any cart item card is rendered, no child element's computed width SHALL exceed the card's own computed width, and no horizontal scrollbar SHALL appear within the card on any device class.
4. WHEN the viewport is at Breakpoint_Mobile OR Breakpoint_Tablet, all quantity control buttons (increment, decrement) SHALL have a computed height of at least 44 px and a computed width of at least 44 px, so that they are safely tappable on touch devices.

---

### Requirement 7: Responsive CheckoutPage

**User Story:** As a customer completing an order on a phone, I want the checkout form and order summary to be usable at any screen width.

#### Acceptance Criteria

1. WHEN the viewport width is 768 px or greater (desktop), THE CheckoutPage SHALL render `.co-layout` with `grid-template-columns: 1fr 360px` so that the checkout form and order summary panel appear side by side.
2. WHEN the viewport width is less than 768 px (mobile), THE CheckoutPage `.co-layout` SHALL render as a single-column grid (no explicit `grid-template-columns`, inheriting the default single-column flow) so that the form and summary stack vertically.
3. THE `.co-payment-modal` SHALL have `max-width: 600px` and `width: 100%` on all device classes, and the `.co-payment-overlay` SHALL apply `padding: 16px` so that the modal never exceeds the viewport width.
4. WHEN the viewport width is 480 px or less, THE `.co-payment-overlay` SHALL set `align-items: flex-end` and `padding: 0`, and `.co-payment-modal` SHALL use `border-radius: 16px 16px 0 0` and `max-height: 95vh`, so that the payment modal presents as a bottom sheet anchored to the bottom of the viewport.
5. All `.co-input` and `.co-textarea` elements SHALL have `width: 100%` so that form fields fill the width of their parent `.co-field` container on all device classes.
6. WHEN the viewport is at Breakpoint_Mobile, THE `.co-step-indicator` inside the PaymentModal SHALL render each `.co-step-dot-label` without any label being clipped, truncated, or overlapping an adjacent label, measurable by each label's `offsetWidth` being less than or equal to its `.co-step-dot` container's `offsetWidth`.

---

### Requirement 8: Responsive ProfilePage

**User Story:** As a logged-in user managing my account on a mobile device, I want the profile page to be fully usable with a readable layout.

#### Acceptance Criteria

1. WHEN the viewport width is greater than 700 px, THE ProfilePage SHALL display the sidebar navigation and the content panel in a two-column grid, with the sidebar in the left column and the content panel in the right column.
2. WHEN the viewport width is 700 px or less, THE ProfilePage SHALL render the sidebar and the content panel in a single-column stack, with the sidebar appearing above the content panel.
3. WHEN the viewport width is 700 px or less, all form fields within the ProfilePage content panel SHALL have a computed width equal to 100% of the content panel's computed width, so that inputs fill the available space.
4. WHEN the viewport width is 700 px or less, THE ProfilePage sidebar navigation items SHALL not produce a horizontal scrollbar within the sidebar container; each item SHALL have a computed width no greater than the sidebar's computed width.
5. WHEN the viewport width is greater than 700 px, THE ProfilePage sidebar SHALL have `position: sticky` and `top` set to the Navbar height (or an equivalent offset) so that sidebar navigation remains visible during scroll of long content panels.

---

### Requirement 9: Responsive MyOrdersPage and StatusOrderPage

**User Story:** As a customer checking order history or status on a mobile device, I want tables and order cards to be readable without horizontal scrolling.

#### Acceptance Criteria

1. IF the orders data table on MyOrdersPage has a natural width wider than the current viewport at Breakpoint_Mobile, THEN the table SHALL be wrapped in a container with `overflow-x: auto` so that the full table content is reachable by horizontal scrolling within the container, and no table cell content is clipped or hidden.
2. WHEN the viewport is at Breakpoint_Mobile, THE StatusOrderPage order timeline SHALL render each timeline step so that the step's icon, label text, and timestamp are all fully visible without any element's `overflow` being clipped and without requiring horizontal scroll.
3. WHEN the viewport is at Breakpoint_Mobile, THE StatusOrderPage order detail section SHALL render in a single-column layout with no side-by-side columns, so that label and value pairs are readable at narrow widths.
4. WHEN the viewport is at Breakpoint_Mobile, THE MyOrdersPage order card footer action row SHALL wrap its action buttons to a new line rather than overflow the card boundary, so that all buttons remain fully visible and tappable without horizontal scroll.

---

### Requirement 10: Responsive Staff Dashboards

**User Story:** As a staff member (admin, owner, sub-admin) accessing the dashboard on a tablet or smaller screen, I want the layout to adapt so that I can perform my role tasks without losing access to navigation.

#### Acceptance Criteria

1. WHEN the viewport is at Breakpoint_Desktop (≥1024 px), THE Staff_Layout SHALL render the Staff_Sidebar and the main content area as two side-by-side columns, with the Staff_Sidebar occupying a fixed width (e.g., 240 px) and the main content area filling the remaining space.
2. WHEN the viewport is at Breakpoint_Mobile OR Breakpoint_Tablet (below 1024 px), THE Staff_Layout SHALL render the Staff_Sidebar and the main content area in a single-column stack, with the Staff_Sidebar appearing above the main content area and both sections spanning the full container width.
3. WHEN the viewport is at Breakpoint_Mobile OR Breakpoint_Tablet, THE Staff_Layout SHALL NOT apply `height: 100vh` or `overflow: hidden` to the `<body>` element, so that the page is scrollable using the browser's native scroll.
4. WHEN the viewport is at Breakpoint_Mobile, THE Staff_Layout KPI cards grid SHALL render with at most two columns (`grid-template-columns: repeat(2, 1fr)` or `repeat(1, 1fr)`), so that KPI cards do not become too narrow to read.
5. IF a data table inside the Staff_Layout has a natural width greater than the current viewport width, THEN the table SHALL be enclosed in a wrapper element with `overflow-x: auto` so that the table scrolls horizontally within its wrapper without causing the outer layout to break or produce a `<body>`-level horizontal scrollbar.
6. WHEN the viewport is at Breakpoint_Mobile, THE Staff_Layout chat panel SHALL render the conversation list and the message panel as two vertically stacked sections (conversation list above, message panel below), each spanning the full container width, so that both sections are accessible without horizontal scrolling.

---

### Requirement 11: Responsive Shared Components

**User Story:** As a user on any device, I want modals, cards, and the chat widget to display correctly so that I can complete actions without UI elements overflowing the screen.

#### Acceptance Criteria

1. THE Modal component SHALL have `width: min(90vw, 520px)` and `padding: 16px` on all device classes so that its computed width never exceeds the viewport width and its content is not flush against the screen edges.
2. WHEN the viewport is at Breakpoint_Mobile, THE Modal component SHALL have `max-height: 90vh` and `overflow-y: auto` so that modal content that exceeds the visible screen height is accessible by vertical scrolling within the modal.
3. WHEN the Product_Card image container is rendered, it SHALL have an explicit `aspect-ratio` (e.g., `1/1`) and `object-fit: cover` on the `<img>` element so that the image area maintains its proportions at any container width; the product name SHALL be truncated to one line with `text-overflow: ellipsis` if it overflows, and the product price SHALL be fully visible without truncation on any device class.
4. WHEN the viewport is at Breakpoint_Mobile, THE Footer SHALL render its top-row content columns in a single-column vertical stack, so that no column overflows the viewport or produces horizontal scrolling.
5. WHEN the viewport is at Breakpoint_Mobile, THE ChatWidget SHALL have `max-width: 100vw` and `max-height: 80vh` so that it is fully contained within the visible viewport area and does not cause overflow on either axis.
6. THE Toast notification component SHALL be positioned at the top of the viewport, vertically offset below the Navbar's computed height, so that toasts do not overlap the Navbar or primary page content on any device class; when multiple toasts are displayed simultaneously, they SHALL stack vertically in the same anchor position.

---

### Requirement 12: Touch Interaction and Tap Targets

**User Story:** As a user on a touch device, I want all interactive elements to be large enough to tap accurately so that I do not accidentally activate the wrong control.

#### Acceptance Criteria

1. THE Application SHALL render all primary action buttons (add to cart, checkout, submit) with a minimum computed height of 44 px and a minimum computed width of 44 px on all device classes.
2. THE Application SHALL render all navigation links and icon buttons with a minimum computed height of 44 px and a minimum computed width of 44 px on Breakpoint_Mobile.
3. IF the device supports touch input (detected via CSS `@media (pointer: coarse)`), THEN all form inputs SHALL have a minimum computed height of 44 px and a minimum computed width of 44 px so that they are reliably tappable.
4. WHEN interactive elements are displayed adjacent to each other (in a row or column) on Breakpoint_Mobile, THE Application SHALL provide at least 8 px of edge-to-edge spacing between each pair of Touch_Targets, so that tapping one element does not accidentally activate a neighboring one.

---

### Requirement 13: No Horizontal Overflow on Any Page

**User Story:** As a user on a narrow screen, I want the page to never require horizontal scrolling so that I can see all content without panning left and right.

#### Acceptance Criteria

1. THE Application SHALL NOT produce a horizontal scrollbar on the `<body>` element at any viewport width between 320 px and the widest supported desktop width, inclusive.
2. IF any descendant element's natural width would exceed the viewport width, THEN the nearest appropriate ancestor SHALL constrain the overflow — either by limiting the element's width to at most 100% of its container or by wrapping it in a container with `overflow-x: auto` — so that no `<body>`-level horizontal scrollbar appears.
3. THE Application SHALL use relative units (`%`, `vw`, `em`, `rem`, `clamp()`, `min()`, `max()`) rather than fixed pixel widths for page-level and section-level layout containers, so that container widths reflow at any viewport width of 320 px or greater.
4. IF a specific design component requires a fixed-pixel minimum width (e.g., a sidebar set to `240px` or a product card set to `160px`), THEN at Breakpoint_Mobile (320 px – 767 px), THE Application SHALL either reduce that minimum width to fit the viewport or wrap the component in a container with `overflow-x: auto`, so that no layout-breaking overflow occurs.
