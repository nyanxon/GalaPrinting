# Codebase Audit Fixes — Implementation Tasks

## Task 1: Critical Async/Await Fixes (Frontend)

Fix all async/await misuse in frontend components that causes silent failures in backend mode.

- [x] 1.1 Fix CheckoutPage handlePaymentSubmit
  - [x] 1.1.1 Make `handlePaymentSubmit` async
  - [x] 1.1.2 Add `await` to `createOrderFromCart` call
  - [x] 1.1.3 Add USE_BACKEND conditional for payment proof attachment
  - [x] 1.1.4 Call `attachPaymentProof` API in backend mode
  - [x] 1.1.5 Keep localStorage block for localStorage mode
  - [x] 1.1.6 Wrap entire function in try/catch with `setFormAlert` error handling
  - [x] 1.1.7 Add imports: `USE_BACKEND`, `attachPaymentProof`

- [x] 1.2 Fix MyOrdersPage async calls
  - [x] 1.2.1 Make load orders useEffect callback async with await
  - [x] 1.2.2 Make `handleOrdersUpdated` event handler async with await
  - [x] 1.2.3 Make `handlePaymentSubmit` async with await for both `attachPaymentProof` and `listOrdersByCustomer`
  - [x] 1.2.4 Check `res.ok` on resolved value before refreshing orders

- [x] 1.3 Fix ChatWidget async calls
  - [x] 1.3.1 Make `loadMessages` async and await `getMessagesByCustomer`
  - [x] 1.3.2 Add null-safety: wrap result in `Array.isArray` check
  - [x] 1.3.3 Make `handleSend` text path async and await `sendMessage`
  - [x] 1.3.4 Check `res.ok` on resolved value before calling `loadMessages`

- [x] 1.4 Add Cancelled status to frontend
  - [x] 1.4.1 Add `"Cancelled"` to `ORDER_STATUSES` array in `orderService.js`
  - [x] 1.4.2 Add `"Cancelled"` to `STANDARD_TIMELINE` array
  - [x] 1.4.3 Add `"Cancelled"` to `CUSTOM_TIMELINE` array
  - [x] 1.4.4 Add `"Cancelled"` entry to `STATUS_CONFIG` with icon "❌" and badge "status--cancelled"
  - [x] 1.4.5 Add CSS rule for `.status--cancelled` in order status styles

- [x] 1.5 Guard seedStaffUsers in App.jsx
  - [x] 1.5.1 Import `USE_BACKEND` from `httpClient.js`
  - [x] 1.5.2 Wrap `seedStaffUsers()` call with `if (!USE_BACKEND)`
  - [x] 1.5.3 Add comment: "DEVELOPMENT ONLY — seeds localStorage staff accounts"

## Task 2: Critical Async/Await Fixes (Backend)

Fix backend API response shape mismatches that cause frontend parsing errors.

- [x] 2.1 Fix listMyOrders response shape
  - [x] 2.1.1 Change `server/src/controllers/orders.controller.js` `listMyOrders` to return `{ ok: true, items: orders }` instead of `{ ok: true, data: orders }`

## Task 3: AuthContext Loading State

Add loading state to prevent race condition redirects on page refresh.

- [x] 3.1 Add loading state to AuthContext
  - [x] 3.1.1 Add `const [loading, setLoading] = useState(true)` to `AuthProvider`
  - [x] 3.1.2 Update useEffect to call `.finally(() => setLoading(false))`
  - [x] 3.1.3 Expose `loading` in context value

- [x] 3.2 Update MyOrdersPage to use loading state
  - [x] 3.2.1 Destructure `loading` from `useContext(AuthContext)`
  - [x] 3.2.2 Update redirect useEffect to check `!loading && user === null`
  - [x] 3.2.3 Add early return: `if (loading) return null;`

- [x] 3.3 Update CheckoutPage to use loading state
  - [x] 3.3.1 Destructure `loading` from `useContext(AuthContext)`
  - [x] 3.3.2 Update auth guard to check `loading` before showing auth-required screen

- [x] 3.4 Update RoleGuard to use loading state
  - [x] 3.4.1 Destructure `loading` from `useContext(AuthContext)`
  - [x] 3.4.2 Return null while loading to prevent flash redirects

## Task 4: Backend Input Validation

Add server-side validation to prevent invalid data from being stored.

- [x] 4.1 Add cart item validation
  - [x] 4.1.1 Validate `name` is non-empty string in `cart.controller.js` `addItem`
  - [x] 4.1.2 Validate `price` is number >= 0
  - [x] 4.1.3 Validate `quantity` is integer >= 1
  - [x] 4.1.4 Return 422 with descriptive message on validation failure

- [x] 4.2 Add order creation validation
  - [x] 4.2.1 Validate `items` is non-empty array in `orders.controller.js` `createOrder`
  - [x] 4.2.2 Compute server-side subtotal from items
  - [x] 4.2.3 Validate client `subtotal` matches computed value (1-unit tolerance)
  - [x] 4.2.4 Return 422 with descriptive message on validation failure
  - [x] 4.2.5 Apply same validation to `createCustomOrder`
  - [x] 4.2.6 Apply same validation to `createOfflineOrder`

- [x] 4.3 Fix updateOrderStatus key mismatch
  - [x] 4.3.1 Change `orders.controller.js` `updateOrderStatus` to read `req.body.newStatus` instead of `req.body.status`
  - [x] 4.3.2 Update validation message check to use `newStatus` variable
  - [x] 4.3.3 Pass `newStatus` to service layer

## Task 5: Frontend Null-Safety Guards

Add defensive null checks to prevent crashes from unexpected API responses.

- [x] 5.1 Add CartContext null-safety
  - [x] 5.1.1 Wrap `loadCart` in try/catch
  - [x] 5.1.2 Add `Array.isArray(result?.items)` check before `setItems`
  - [x] 5.1.3 Default to empty array on error or invalid shape
  - [x] 5.1.4 Add console.error for debugging

## Task 6: Dead Code Elimination

Remove or wire up unused exports to reduce bundle size.

- [x] 6.1 Wire debounce to ProductsPage search
  - [x] 6.1.1 Check if `ProductsPage.jsx` has a search input
  - [x] 6.1.2 If yes: import `debounce` from `helpers.js`
  - [x] 6.1.3 Wrap search onChange with `useMemo(() => debounce(...), [])`
  - [x] 6.1.4 If no search input: remove `debounce` export from `helpers.js`

## Task 7: Chat Service Mode Guards

Add USE_BACKEND guards to localStorage-only chat functions.

- [x] 7.1 Add guard to getConversationByCustomer
  - [x] 7.1.1 Add `if (USE_BACKEND)` check at function start
  - [x] 7.1.2 Log warning and return null in backend mode
  - [x] 7.1.3 Update JSDoc to document localStorage-only usage

- [x] 7.2 Add guard to getConversationById
  - [x] 7.2.1 Add `if (USE_BACKEND)` check at function start
  - [x] 7.2.2 Log warning and return null in backend mode
  - [x] 7.2.3 Update JSDoc to document localStorage-only usage

- [x] 7.3 Verify no components call these functions in backend mode
  - [x] 7.3.1 Search for `getConversationByCustomer` usage in components
  - [x] 7.3.2 Replace with `createOrGetConversation` if found in backend-mode paths

## Task 8: Cart Sync Payload Optimization

Strip base64 design data before syncing to prevent 413 errors.

- [x] 8.1 Strip designDataUrl in syncCartOnLogin
  - [x] 8.1.1 Map over `localItems` to destructure and omit `designDataUrl`
  - [x] 8.1.2 Pass sanitized array to `syncCart`
  - [x] 8.1.3 Add comment explaining 1MB body limit

## Task 9: Order Number Collision Fix

Replace Math.random with UUID fragment for order number generation.

- [x] 9.1 Update generateOrderNumber
  - [x] 9.1.1 Import `randomUUID` from 'crypto' (already imported)
  - [x] 9.1.2 Replace `Math.floor(Math.random() * 9000) + 1000` with `randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()`
  - [x] 9.1.3 Update format to `ORD-${ymd}-${suffix}`
  - [x] 9.1.4 Add comment explaining collision probability

## Task 10: Security Fixes

Address XSS risks, hardcoded credentials, and path validation issues.

- [x] 10.1 Sanitize chat content in backend mode
  - [x] 10.1.1 Import `escapeHtml` in `chatService.js` (already imported)
  - [x] 10.1.2 Apply `escapeHtml` to text content in USE_BACKEND path before sending to API
  - [x] 10.1.3 Verify localStorage path already applies `escapeHtml`

- [x] 10.2 Document payment proof path security
  - [x] 10.2.1 Add JSDoc to `attachPaymentProof` in `orders.service.js`
  - [x] 10.2.2 Document that `proofPath` must come from `StorageService.save()` only
  - [x] 10.2.3 Add "NEVER from client input" warning in JSDoc

- [x] 10.3 Replace clearSession hard redirect with DOM event
  - [x] 10.3.1 Change `httpClient.js` `clearSession` to dispatch `gala:session-expired` event
  - [x] 10.3.2 Remove `window.location.href = '/register'` line
  - [x] 10.3.3 Create `AuthNavigationHandler` component in `AuthContext.jsx`
  - [x] 10.3.4 Add useNavigate hook in handler
  - [x] 10.3.5 Listen for `gala:session-expired` event
  - [x] 10.3.6 Call `navigate('/register', { replace: true })` on event
  - [x] 10.3.7 Render `<AuthNavigationHandler />` inside BrowserRouter in `App.jsx`

- [x] 10.4 Add DEVELOPMENT ONLY comment to seedStaffUsers
  - [x] 10.4.1 Add JSDoc comment to `seedStaffUsers` in `authService.js`
  - [x] 10.4.2 Document localStorage-only usage
  - [x] 10.4.3 Warn about plain text passwords
  - [x] 10.4.4 Note that call-site guard prevents backend mode execution

## Task 11: Performance Optimizations

Reduce database round-trips and unnecessary data fetching.

- [x] 11.1 Parallelize getOrderById queries
  - [x] 11.1.1 Wrap items and history queries in `Promise.all` in `orders.service.js`
  - [x] 11.1.2 Destructure results: `const [[items], [history]] = await Promise.all([...])`
  - [x] 11.1.3 Keep order query sequential (needed for null check)

## Task 12: UX/UI Improvements

Add loading states, real-time updates, and better error handling.

- [x] 12.1 Add loading state to login/register forms
  - [x] 12.1.1 Add `const [submitting, setSubmitting] = useState(false)` to `RegisterPage.jsx`
  - [x] 12.1.2 Set `submitting` to true at start of `handleSubmit`
  - [x] 12.1.3 Set `submitting` to false in finally block
  - [x] 12.1.4 Add `disabled={submitting}` to submit button
  - [x] 12.1.5 Show "Memproses..." text when submitting
  - [x] 12.1.6 Apply same pattern to any login form component

- [x] 12.2 Add real-time chat updates in backend mode
  - [x] 12.2.1 Add useEffect to `ChatWidget.jsx` that listens for `gala:message-new`
  - [x] 12.2.2 Guard with `if (!user || !USE_BACKEND) return`
  - [x] 12.2.3 Call `loadMessages()` on event
  - [x] 12.2.4 Clean up listener on unmount

- [x] 12.3 Allow order tracking without phone for logged-in users
  - [x] 12.3.1 Import `AuthContext` in `StatusOrderPage.jsx`
  - [x] 12.3.2 Get `user` from context
  - [x] 12.3.3 Update `runLookup` to allow empty phone when user is logged in
  - [x] 12.3.4 Update backend `trackOrder` controller to make `phone` optional
  - [x] 12.3.5 Update `findOrder` service to handle null phone (match by orderNumber only)
  - [x] 12.3.6 Verify localStorage `findOrderLocal` already handles optional phone

## Task 13: Testing & Verification

Write property-based tests to verify all fixes.

- [x] 13.1 Write async resolution test (P1)
  - [x] 13.1.1 Test that `createOrderFromCart` in backend mode returns object with string `id`
  - [x] 13.1.2 Verify result is not a Promise

- [x] 13.2 Write status completeness test (P2)
  - [x] 13.2.1 For each status in backend TRANSITIONS, verify STATUS_CONFIG entry exists
  - [x] 13.2.2 Verify icon and badge fields are non-empty

- [x] 13.3 Write cart validation test (P3)
  - [x] 13.3.1 Test POST /api/cart/items with price < 0 returns 422
  - [x] 13.3.2 Test with quantity < 1 returns 422
  - [x] 13.3.3 Test with empty name returns 422

- [x] 13.4 Write order subtotal integrity test (P4)
  - [x] 13.4.1 Test POST /api/orders with mismatched subtotal returns 422
  - [x] 13.4.2 Verify tolerance of 1 unit for rounding

- [x] 13.5 Write status update key consistency test (P5)
  - [x] 13.5.1 Verify frontend sends `{ newStatus }` in PATCH body
  - [x] 13.5.2 Verify backend reads `req.body.newStatus`

- [x] 13.6 Write cart sync payload test (P6)
  - [x] 13.6.1 Test that `syncCartOnLogin` strips `designDataUrl` before sending
  - [x] 13.6.2 Verify payload size is under 1MB

- [x] 13.7 Write session expiry navigation test (P7)
  - [x] 13.7.1 Test that `clearSession()` dispatches `gala:session-expired` event
  - [x] 13.7.2 Verify no `window.location.href` assignment

- [x] 13.8 Write order number uniqueness test (P8)
  - [x] 13.8.1 Generate 1000 order numbers on same day
  - [x] 13.8.2 Verify all are unique (no collisions)

## Task 14: Manual Testing Checklist

Verify all fixes work end-to-end in both modes.

- [ ] 14.1 Test checkout flow in backend mode
  - [ ] 14.1.1 Complete checkout with payment proof
  - [ ] 14.1.2 Verify order created with correct ID
  - [ ] 14.1.3 Verify payment proof attached via API
  - [ ] 14.1.4 Verify redirect to /my-orders works

- [ ] 14.2 Test MyOrdersPage in backend mode
  - [ ] 14.2.1 Hard refresh page while logged in
  - [ ] 14.2.2 Verify no flash redirect to /register
  - [ ] 14.2.3 Verify orders load correctly
  - [ ] 14.2.4 Upload payment proof and verify refresh

- [ ] 14.3 Test ChatWidget in backend mode
  - [ ] 14.3.1 Send text message
  - [ ] 14.3.2 Verify message appears immediately
  - [ ] 14.3.3 Have admin reply via Socket.io
  - [ ] 14.3.4 Verify customer sees reply in real-time

- [ ] 14.4 Test cancelled order rendering
  - [ ] 14.4.1 Have admin cancel an order
  - [ ] 14.4.2 Verify Cancelled badge renders with correct icon and color
  - [ ] 14.4.3 Verify timeline shows Cancelled step

- [ ] 14.5 Test cart validation
  - [ ] 14.5.1 Try adding item with negative price
  - [ ] 14.5.2 Verify 422 error with descriptive message
  - [ ] 14.5.3 Try adding item with quantity 0
  - [ ] 14.5.4 Verify 422 error

- [ ] 14.6 Test order validation
  - [ ] 14.6.1 Try creating order with empty items array
  - [ ] 14.6.2 Verify 422 error
  - [ ] 14.6.3 Try creating order with mismatched subtotal
  - [ ] 14.6.4 Verify 422 error

- [ ] 14.7 Test session expiry
  - [ ] 14.7.1 Trigger token refresh failure
  - [ ] 14.7.2 Verify redirect to /register without full page reload
  - [ ] 14.7.3 Verify unsaved form state is preserved (if on a form page)

- [ ] 14.8 Test order tracking
  - [ ] 14.8.1 Track order as logged-in user without phone
  - [ ] 14.8.2 Verify order found
  - [ ] 14.8.3 Track order as guest with phone
  - [ ] 14.8.4 Verify order found

- [ ] 14.9 Test cart sync
  - [ ] 14.9.1 Add items with design files to localStorage cart
  - [ ] 14.9.2 Login
  - [ ] 14.9.3 Verify cart syncs without 413 error
  - [ ] 14.9.4 Verify items appear in server cart

- [ ] 14.10 Test localStorage mode regression
  - [ ] 14.10.1 Set VITE_USE_BACKEND=false
  - [ ] 14.10.2 Test checkout flow
  - [ ] 14.10.3 Test MyOrdersPage
  - [ ] 14.10.4 Test ChatWidget
  - [ ] 14.10.5 Verify all features work as before
