# Bugfix Requirements Document

## Introduction

A comprehensive codebase audit identified 30 issues across the frontend and backend of the Gala Printing application. These range from critical async/await misuse that causes silent failures in backend mode, to API response shape mismatches, missing status values, security vulnerabilities, and UX regressions. This document captures the defective behaviors, the correct behaviors they must be replaced with, and the existing behaviors that must be preserved without regression.

The bugs are grouped into six categories: Critical (async/await and data integrity), Major (race conditions and missing validation), Minor (dead code and mode-guard gaps), Security, Performance, and UX/UI.

---

## Bug Analysis

### Current Behavior (Defect)

**Critical — Async/Await Misuse & Data Integrity**

1.1 WHEN `USE_BACKEND=true` and a customer submits checkout THEN the system calls `createOrderFromCart(...)` synchronously without `await`, so `order` is a Promise object and `order.id` is `undefined`, causing the payment proof to be attached to a non-existent order ID in localStorage instead of via the API

1.2 WHEN `USE_BACKEND=true` and a customer submits checkout with a payment proof THEN the system writes the proof directly to `localStorage` via `localStorage.setItem('gala.orders', ...)` instead of calling `attachPaymentProof(order.id, proof)` from `orderService.js`, so the proof is never sent to the backend

1.3 WHEN `USE_BACKEND=true` and `MyOrdersPage` mounts THEN the system calls `listOrdersByCustomer(...)` without `await` inside a non-async `useEffect` callback, so `orders` is set to a Promise object and the page renders nothing

1.4 WHEN `USE_BACKEND=true` and a `gala:orders-updated` event fires on `MyOrdersPage` THEN the system calls `listOrdersByCustomer(...)` without `await` inside a non-async event handler, so the orders list is set to a Promise and the refresh silently fails

1.5 WHEN `USE_BACKEND=true` and a customer submits a payment proof on `MyOrdersPage` THEN the system calls `attachPaymentProof(...)` without `await`, so `res` is a Promise (always truthy), `res.ok` is never checked correctly, and the subsequent `listOrdersByCustomer(...)` call also runs without `await`

1.6 WHEN `USE_BACKEND=true` and the `ChatWidget` opens for a logged-in customer THEN the system calls `getMessagesByCustomer(user.id)` without `await` and passes the resulting Promise directly to `setMessages(...)`, so the widget renders nothing

1.7 WHEN `USE_BACKEND=true` and a customer sends a text message in the `ChatWidget` THEN the system calls `sendMessage(...)` without `await`, so `res` is a Promise object, `res.ok` is always truthy (never catches errors), and `loadMessages()` is called before the message is persisted

1.8 WHEN the `listMyOrders` controller responds to `GET /api/orders/my` THEN the system returns `{ ok: true, data: orders }` but the frontend `orderService.js` reads `res.data.items ?? res.data.data`, so the frontend accidentally reads the array via the `data` fallback — a fragile match that breaks if the controller key ever changes to `items`

1.9 WHEN `USE_BACKEND=true` and `App.jsx` initialises THEN the system calls `seedStaffUsers()` unconditionally at module level, writing to localStorage on every page load even though staff accounts in backend mode are managed by the database, causing misleading stale data and wasted cycles

1.10 WHEN an admin cancels an order via the backend THEN the system transitions the order to status `Cancelled` (present in `server/src/services/orders.service.js` TRANSITIONS map) but the frontend `STATUS_CONFIG`, `ORDER_STATUSES`, and `STANDARD_TIMELINE` arrays have no entry for `Cancelled`, so cancelled orders render with no badge, no icon, and a broken UI

**Major — Race Conditions & Missing Validation**

1.11 WHEN a logged-in user hard-refreshes any protected page (e.g. `/my-orders`) THEN the system initialises `AuthContext` with `user = null` and immediately fires the redirect to `/register` before `getCurrentUser()` resolves, so a valid session causes an incorrect redirect on every hard refresh

1.12 WHEN a client sends `POST /api/cart/items` THEN the system passes `req.body` directly to `svc.addItem()` with no validation, so a client can send `name: null`, `price: -999`, `quantity: 0`, or arbitrary extra fields without rejection

1.13 WHEN a client sends `POST /api/orders` THEN the system accepts `items: undefined`, `items: []`, or a `subtotal` that does not match the sum of `item.price * item.quantity`, creating orders with no items or an incorrect total without any server-side rejection

1.14 WHEN the frontend sends `PATCH /api/orders/:id/status` THEN the system sends `{ newStatus }` in the request body but the controller reads `req.body.status`, so the status field is always `undefined` and the update always fails with a 422 "Status wajib diisi." error

1.15 WHEN `USE_BACKEND=true` and `CartContext` loads the cart THEN the system calls `getCart(user?.id)` and destructures `{ items: loaded }` without a null-safety guard, so if the backend response shape changes and `result.items` is `undefined`, `setItems(undefined)` crashes the cart

**Minor — Dead Code & Mode-Guard Gaps**

1.16 WHEN any component imports from `src/core/helpers.js` THEN the system exports `debounce` but no component or service imports or uses it, leaving dead code in the bundle

1.17 WHEN `USE_BACKEND=true` and the `ChatWidget` needs to load messages THEN the system calls `getConversationByCustomer(customerId)` and `getConversationById(convId)` which are localStorage-only functions with no `USE_BACKEND` guard, so they always return `null` in backend mode and `getMessagesByCustomer` returns `[]` instead of calling the API

1.18 WHEN `USE_BACKEND=true` and a customer syncs their cart on login THEN the system sends cart items including `designDataUrl` (base64-encoded image data, potentially megabytes) in the JSON body of `POST /api/cart/sync`, which exceeds the `1mb` body limit in `server/src/app.js` and returns a 413 error

1.19 WHEN the backend generates an order number THEN the system uses `Math.floor(Math.random() * 9000) + 1000` (4 random digits), giving a 1/9000 chance of collision per day; the `order_number` UNIQUE constraint causes an unhandled DB crash rather than a graceful error

**Security**

1.20 WHEN `USE_BACKEND=true` and a customer sends a chat message THEN the system sends raw user input to the API without HTML sanitization, while the localStorage path applies `escapeHtml()` before storing, creating an inconsistent XSS risk if content is ever rendered as `innerHTML`

1.21 WHEN a client calls `POST /api/orders/:id/payment-proof` THEN the system in `server/src/services/orders.service.js` accepts any string as `proofPath` and writes it directly to the database, but the controller correctly derives the path from `StorageService.save()` — the service layer should enforce that the path only comes from storage, never from client input

1.22 WHEN `clearSession()` is called in `src/core/httpClient.js` THEN the system redirects via `window.location.href = '/register'`, bypassing React Router entirely and causing a full page reload that discards any unsaved form state

1.23 WHEN `USE_BACKEND=false` and `App.jsx` initialises THEN the system calls `seedStaffUsers()` which hardcodes `password: "Password123!"` in plain text in the source code, and these credentials are stored in plain text in localStorage

**Performance**

1.24 WHEN `analyticsService.js` computes revenue metrics in localStorage fallback mode THEN the system calls `listAllOrders()` which fetches up to 1000 orders into memory just to compute sums that the backend analytics endpoints already compute in SQL

1.25 WHEN `getOrderById` is called in `server/src/services/orders.service.js` THEN the system runs three sequential `SELECT` queries (orders, order_items, order_history) as separate round-trips instead of running them in parallel

**UX/UI**

1.26 WHEN a user submits the login or register form THEN the system does not disable the submit button or show a loading state, allowing double-submission

1.27 WHEN `USE_BACKEND=true` and a logged-in user hard-refreshes `/my-orders` THEN the system shows a flash redirect to `/register` before `getCurrentUser()` completes, even though the user has a valid session

1.28 WHEN `USE_BACKEND=true` and a new message arrives via Socket.io THEN the system dispatches a `gala:message-new` DOM event from `chatService.js` but the `ChatWidget` only listens for `gala:chat-updated` and `storage` events, so new messages in backend mode never appear in the widget without a manual refresh

1.29 WHEN a customer visits the order tracking page (`/status`) THEN the system requires both `orderNumber` AND `phone` to look up an order, so a logged-in customer who forgets their phone number cannot track their order at all

1.30 WHEN `handlePaymentSubmit` in `CheckoutPage` throws a network error (e.g. `createOrderFromCart` fails in backend mode) THEN the system swallows the error silently because there is no `try/catch` around the call and `setFormAlert` is never triggered

---

### Expected Behavior (Correct)

**Critical — Async/Await Misuse & Data Integrity**

2.1 WHEN `USE_BACKEND=true` and a customer submits checkout THEN the system SHALL `await createOrderFromCart(...)` so that `order` is the resolved order object with a valid `id` UUID before any subsequent operations

2.2 WHEN `USE_BACKEND=true` and a customer submits checkout with a payment proof THEN the system SHALL call `await attachPaymentProof(order.id, proof)` from `orderService.js` to send the proof to the backend API, not write to localStorage directly

2.3 WHEN `USE_BACKEND=true` and `MyOrdersPage` mounts THEN the system SHALL use an `async` `useEffect` callback and `await listOrdersByCustomer(...)` so that `orders` is set to the resolved array

2.4 WHEN `USE_BACKEND=true` and a `gala:orders-updated` event fires on `MyOrdersPage` THEN the system SHALL use an `async` event handler and `await listOrdersByCustomer(...)` so the orders list refreshes correctly

2.5 WHEN `USE_BACKEND=true` and a customer submits a payment proof on `MyOrdersPage` THEN the system SHALL `await attachPaymentProof(...)`, check `res.ok` on the resolved value, and `await listOrdersByCustomer(...)` to refresh the list

2.6 WHEN `USE_BACKEND=true` and the `ChatWidget` opens for a logged-in customer THEN the system SHALL `await getMessagesByCustomer(user.id)` and pass the resolved array to `setMessages(...)`

2.7 WHEN `USE_BACKEND=true` and a customer sends a text message in the `ChatWidget` THEN the system SHALL `await sendMessage(...)` and check `res.ok` on the resolved value before calling `loadMessages()`

2.8 WHEN the `listMyOrders` controller responds to `GET /api/orders/my` THEN the system SHALL return `{ ok: true, items: orders }` to match the key the frontend reads (`res.data.items`), consistent with all other list endpoints

2.9 WHEN `App.jsx` initialises THEN the system SHALL guard the `seedStaffUsers()` call with `if (!USE_BACKEND) seedStaffUsers()` so it is never called in backend mode

2.10 WHEN an admin cancels an order via the backend THEN the system SHALL render the `Cancelled` status correctly by adding `Cancelled` to `STATUS_CONFIG`, `ORDER_STATUSES`, and `STANDARD_TIMELINE` on the frontend

**Major — Race Conditions & Missing Validation**

2.11 WHEN a user hard-refreshes any protected page THEN the system SHALL expose a `loading` boolean from `AuthContext` that is `true` until `getCurrentUser()` resolves, and all redirect guards SHALL return `null` (render nothing) while `loading` is `true`

2.12 WHEN a client sends `POST /api/cart/items` THEN the system SHALL validate that `name` is a non-empty string, `price` is a number `>= 0`, and `quantity` is an integer `>= 1`, returning 422 with a descriptive message on failure

2.13 WHEN a client sends `POST /api/orders` THEN the system SHALL validate that `items` is a non-empty array and that `subtotal` matches the server-computed sum of `item.price * item.quantity`, returning 422 on failure

2.14 WHEN the frontend sends `PATCH /api/orders/:id/status` THEN the system SHALL use a consistent key: either the controller reads `req.body.newStatus` OR the frontend sends `{ status: newStatus }` — one standard must be chosen and applied to both sides

2.15 WHEN `CartContext` loads the cart THEN the system SHALL apply a null-safety guard: `const loaded = Array.isArray(result?.items) ? result.items : []` before calling `setItems`

**Minor — Dead Code & Mode-Guard Gaps**

2.16 WHEN `src/core/helpers.js` is audited THEN the system SHALL either use `debounce` in a search input (e.g. `ProductsPage`) or remove the export to eliminate dead code

2.17 WHEN `USE_BACKEND=true` and the `ChatWidget` needs to load messages THEN the system SHALL call the backend API path in `getMessagesByCustomer` (which already exists) without routing through the localStorage-only `getConversationByCustomer` function

2.18 WHEN `USE_BACKEND=true` and a customer syncs their cart on login THEN the system SHALL strip `designDataUrl` from items before sending to `POST /api/cart/sync`: `items.map(({ designDataUrl, ...rest }) => rest)`

2.19 WHEN the backend generates an order number THEN the system SHALL use a UUID fragment for sufficient uniqueness: `` `ORD-${ymd}-${randomUUID().slice(0,8).toUpperCase()}` ``

**Security**

2.20 WHEN `USE_BACKEND=true` and a customer sends a chat message THEN the system SHALL sanitize the content (strip HTML tags) either on the frontend before sending or on the backend before storing, consistent with the localStorage path's use of `escapeHtml()`

2.21 WHEN `POST /api/orders/:id/payment-proof` is processed THEN the system SHALL only accept the file path as set by `StorageService.save()` server-side; the `proofPath` parameter in `orders.service.js` SHALL never be derived from client-supplied body data

2.22 WHEN `clearSession()` is called THEN the system SHALL use a React Router `navigate` callback or a custom DOM event handled by `AuthContext` instead of `window.location.href`, preserving the SPA navigation model

2.23 WHEN `USE_BACKEND=false` and `seedStaffUsers()` is called THEN the system SHALL include a prominent `// DEVELOPMENT ONLY` comment and the call site in `App.jsx` SHALL be guarded so it is never executed when `USE_BACKEND=true`

**Performance**

2.24 WHEN `analyticsService.js` computes revenue metrics THEN the system SHALL use the backend analytics endpoints (already implemented) when `USE_BACKEND=true` and only fall back to the `listAllOrders()` approach in localStorage mode

2.25 WHEN `getOrderById` is called in `server/src/services/orders.service.js` THEN the system SHALL run the three SELECT queries in parallel using `Promise.all([ordersQuery, itemsQuery, historyQuery])` to reduce latency

**UX/UI**

2.26 WHEN a user submits the login or register form THEN the system SHALL disable the submit button and show a loading indicator during submission to prevent double-submission

2.27 WHEN `USE_BACKEND=true` and a logged-in user hard-refreshes `/my-orders` THEN the system SHALL show nothing (or a skeleton) while `loading` is `true` in `AuthContext`, preventing the flash redirect to `/register`

2.28 WHEN `USE_BACKEND=true` and a new message arrives via Socket.io THEN the system SHALL listen for the `gala:message-new` DOM event in `ChatWidget`'s `useEffect` and call `loadMessages()` so new messages appear in real time

2.29 WHEN a logged-in customer visits the order tracking page THEN the system SHALL allow tracking by `orderNumber` alone (without requiring `phone`) for authenticated users

2.30 WHEN `handlePaymentSubmit` in `CheckoutPage` encounters a network error THEN the system SHALL wrap the call in `try/catch` and call `setFormAlert(errorMessage)` so the user sees a meaningful error instead of a silent failure

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `USE_BACKEND=false` and a customer submits checkout THEN the system SHALL CONTINUE TO create the order synchronously in localStorage and attach the payment proof to localStorage as before

3.2 WHEN `USE_BACKEND=false` and `MyOrdersPage` loads THEN the system SHALL CONTINUE TO call `listOrdersByCustomer` synchronously and render orders from localStorage

3.3 WHEN `USE_BACKEND=false` and the `ChatWidget` sends a message THEN the system SHALL CONTINUE TO call `sendMessage` synchronously, apply `escapeHtml`, and update localStorage

3.4 WHEN `USE_BACKEND=false` and `App.jsx` initialises THEN the system SHALL CONTINUE TO call `seedStaffUsers()` to seed staff accounts in localStorage

3.5 WHEN an order has any status other than `Cancelled` THEN the system SHALL CONTINUE TO render the correct badge, icon, and timeline step as before

3.6 WHEN a logged-in user navigates to a protected page without a hard refresh THEN the system SHALL CONTINUE TO render the page immediately without any loading delay

3.7 WHEN a client sends a valid `POST /api/cart/items` request with correct fields THEN the system SHALL CONTINUE TO add the item to the cart and return 201

3.8 WHEN a client sends a valid `POST /api/orders` request with a non-empty items array and correct subtotal THEN the system SHALL CONTINUE TO create the order and return 201

3.9 WHEN the frontend sends a valid status update THEN the system SHALL CONTINUE TO advance the order status and return the updated order

3.10 WHEN `CartContext` receives a valid cart response from the backend THEN the system SHALL CONTINUE TO populate `items` correctly and render the cart

3.11 WHEN `USE_BACKEND=true` and a customer logs in THEN the system SHALL CONTINUE TO sync the localStorage cart to the server via `POST /api/cart/sync`

3.12 WHEN `USE_BACKEND=true` and a customer sends a file message in the `ChatWidget` THEN the system SHALL CONTINUE TO validate the file type and size before sending

3.13 WHEN `USE_BACKEND=false` and `analyticsService.js` computes revenue metrics THEN the system SHALL CONTINUE TO derive metrics from `listAllOrders()` in localStorage

3.14 WHEN `getOrderById` returns an order THEN the system SHALL CONTINUE TO include `items` and `history` arrays in the response

3.15 WHEN `clearSession()` is called after a failed token refresh THEN the system SHALL CONTINUE TO clear the in-memory access token and redirect the user to the login/register page

3.16 WHEN a customer submits a valid payment proof file THEN the system SHALL CONTINUE TO upload the file via `POST /api/orders/:id/payment-proof` and notify staff via Socket.io

3.17 WHEN `USE_BACKEND=false` and chat messages are sent THEN the system SHALL CONTINUE TO apply `escapeHtml` to text content before storing

3.18 WHEN `USE_BACKEND=true` and a customer sends a cart sync request with items that have no `designDataUrl` THEN the system SHALL CONTINUE TO sync those items normally

3.19 WHEN an order number is generated THEN the system SHALL CONTINUE TO include the date component (`ORD-YYYYMMDD-...`) for human readability

3.20 WHEN a guest (not logged in) opens the `ChatWidget` THEN the system SHALL CONTINUE TO show the login prompt and disable the input area
