# Codebase Audit Fixes — Technical Design

## Overview

This document describes the precise code changes required to fix all 30 issues identified in the codebase audit. Changes are grouped by category and ordered by priority. Each fix is scoped to the minimum change needed — no refactors beyond what the bug requires.

The application runs in two modes controlled by `VITE_USE_BACKEND`:
- **localStorage mode** (`USE_BACKEND=false`): all service functions are synchronous and return plain values.
- **backend mode** (`USE_BACKEND=true`): service functions return Promises and call the REST API.

Most critical bugs stem from code written for localStorage mode being called without `await` in backend mode.

---

## Group 1 — Critical: Async/Await Misuse

### Fix 1.1 & 1.2 — CheckoutPage: await createOrderFromCart + use API for payment proof

**File:** `src/components/pages/public/CheckoutPage.jsx`

The `handlePaymentSubmit` function must become `async`. `createOrderFromCart` must be awaited. The localStorage proof-writing block must be replaced with a conditional: in backend mode call `attachPaymentProof(order.id, proof)` from `orderService.js`; in localStorage mode keep the existing `localStorage.setItem` block. The entire function must be wrapped in `try/catch` to surface network errors via `setFormAlert`.

```js
// BEFORE
function handlePaymentSubmit(result) {
  const order = createOrderFromCart({ ... });
  // writes proof to localStorage unconditionally
}

// AFTER
async function handlePaymentSubmit(result) {
  try {
    const order = await createOrderFromCart({ ... });
    const proof = result?.proof;
    if (proof) {
      if (USE_BACKEND) {
        await attachPaymentProof(order.id, proof.file ?? proof);
      } else {
        // existing localStorage block — unchanged
        const orders = JSON.parse(localStorage.getItem('gala.orders') || '[]');
        const stored = orders.find((o) => o.id === order.id);
        if (stored) {
          stored.paymentProof = { ... };
          localStorage.setItem('gala.orders', JSON.stringify(orders));
          window.dispatchEvent(new CustomEvent('gala:orders-updated', { detail: { orders } }));
        }
      }
    }
    clearCart();
    setPaymentModalOpen(false);
    navigate('/my-orders');
  } catch (err) {
    setFormAlert(err?.response?.data?.message ?? 'Gagal membuat pesanan. Silakan coba lagi.');
  }
}
```

Add `import { USE_BACKEND } from '../../../core/httpClient.js'` and `import { attachPaymentProof } from '../../../services/orderService.js'` to the file's imports.

---

### Fix 1.3, 1.4, 1.5 — MyOrdersPage: async useEffect + await all service calls

**File:** `src/components/pages/public/MyOrdersPage.jsx`

Three call sites need `async`/`await`:

**Load orders useEffect** — make the inner callback async:
```js
useEffect(() => {
  if (!user) return;
  async function load() {
    try {
      const result = await listOrdersByCustomer({ customerId: user.id, customerPhone: user.phone });
      setOrders(result);
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  }
  load();
}, [user]);
```

**gala:orders-updated handler** — make the handler async:
```js
async function handleOrdersUpdated() {
  try {
    const fresh = await listOrdersByCustomer({ customerId: user.id, customerPhone: user.phone });
    setOrders(fresh);
  } catch (err) {
    console.error('Failed to refresh orders:', err);
  }
}
```

**handlePaymentSubmit** — make async, await both calls, check `res.ok` on resolved value:
```js
async function handlePaymentSubmit(result) {
  if (!selectedOrder || !result?.proof) return;
  const proof = result.proof;
  const res = await attachPaymentProof(selectedOrder.id, {
    fileName: proof.fileName, fileSize: proof.fileSize,
    mimeType: proof.mimeType, dataUrl: proof.dataUrl,
  });
  if (res.ok) {
    const fresh = await listOrdersByCustomer({ customerId: user.id, customerPhone: user.phone });
    setOrders(fresh);
  }
  setPaymentModalOpen(false);
  setSelectedOrder(null);
}
```

---

### Fix 1.6, 1.7 — ChatWidget: await getMessagesByCustomer + await sendMessage

**File:** `src/components/shared/ChatWidget.jsx`

`loadMessages` must be async and await `getMessagesByCustomer`:
```js
async function loadMessages() {
  if (!user) return;
  const msgs = await getMessagesByCustomer(user.id);
  setMessages(Array.isArray(msgs) ? msgs : []);
}
```

`handleSend` (text path) must await `sendMessage` and check `res.ok` on the resolved value:
```js
// text path inside handleSend
const res = await sendMessage({ ... });
if (res.ok) {
  setInput('');
  await loadMessages();
}
```

---

### Fix 1.8 — listMyOrders controller: return `items` key not `data`

**File:** `server/src/controllers/orders.controller.js`

Change `listMyOrders` to return `items` to match what the frontend reads (`res.data.items`):
```js
// BEFORE
return res.json({ ok: true, data: orders });

// AFTER
return res.json({ ok: true, items: orders });
```

The frontend `orderService.js` already reads `res.data.items ?? res.data.data` — after this fix it will always hit the `items` key. No frontend change needed.

---

### Fix 1.9 — App.jsx: guard seedStaffUsers behind !USE_BACKEND

**File:** `src/App.jsx`

```js
// BEFORE
seedStaffUsers();

// AFTER
// DEVELOPMENT ONLY — seeds localStorage staff accounts; never runs in backend mode
if (!USE_BACKEND) seedStaffUsers();
```

Add `import { USE_BACKEND } from './core/httpClient.js'` to the imports.

---

### Fix 1.10 — Add Cancelled to frontend status config

**File:** `src/services/orderService.js`

Add `"Cancelled"` to `ORDER_STATUSES`, `STANDARD_TIMELINE`, and `STATUS_CONFIG`:

```js
export const ORDER_STATUSES = [
  "Waiting for Payment",
  "Payment Accepted",
  "Waiting for Design Approval",
  "Design Accepted",
  "On Progress",
  "Quality Checking",
  "In Delivery",
  "Finished",
  "Cancelled",   // ← add
];

export const STANDARD_TIMELINE = [
  // existing entries unchanged
  "Cancelled",   // ← add at end
];

export const STATUS_CONFIG = {
  // existing entries unchanged
  "Cancelled": { icon: "❌", badge: "status--cancelled" },  // ← add
};
```

`CUSTOM_TIMELINE` should also include `"Cancelled"` at the end.

Add a CSS rule for `.status--cancelled` in the shared order status styles (e.g. `src/styles/css/shared/orderStatus.css` or wherever the other `status--*` classes are defined):
```css
.status--cancelled {
  background: #fee2e2;
  color: #991b1b;
}
```

---

## Group 2 — Major: Race Conditions & Missing Validation

### Fix 2.11 & 2.17 — AuthContext: add loading state

**File:** `src/components/context/AuthContext.jsx`

Add a `loading` boolean that starts `true` and flips to `false` once `getCurrentUser()` resolves. Expose it in the context value.

```js
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(getCurrentUser())
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  function updateUser(newUser) { setUser(newUser); }

  return (
    <AuthContext.Provider value={{ user, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**File:** `src/components/pages/public/MyOrdersPage.jsx`

Guard the redirect with `loading`:
```js
const { user, loading } = useContext(AuthContext);

useEffect(() => {
  if (!loading && user === null) {
    navigate('/register', { replace: true });
  }
}, [user, loading, navigate]);

if (loading) return null;   // or a skeleton
```

Apply the same `loading` guard to any other page that redirects on `user === null` (e.g. `CheckoutPage`, `RoleGuard`).

---

### Fix 2.12 — Backend cart validation

**File:** `server/src/controllers/cart.controller.js`

Add inline validation to `addItem` before calling the service:
```js
export async function addItem(req, res, next) {
  try {
    const { name, price, quantity } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(422).json({ ok: false, message: 'Nama produk wajib diisi.' });
    }
    if (price === undefined || price === null || Number(price) < 0) {
      return res.status(422).json({ ok: false, message: 'Harga harus berupa angka >= 0.' });
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return res.status(422).json({ ok: false, message: 'Jumlah harus berupa bilangan bulat >= 1.' });
    }
    const item = await svc.addItem(req.user.id, req.body);
    return res.status(201).json({ ok: true, data: item });
  } catch (err) {
    next(err);
  }
}
```

---

### Fix 2.13 — Backend order validation: non-empty items + subtotal check

**File:** `server/src/controllers/orders.controller.js`

Add validation at the top of `createOrder`:
```js
export async function createOrder(req, res, next) {
  try {
    const { items, subtotal, customerName, customerPhone, customerAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ ok: false, message: 'Pesanan harus memiliki minimal 1 item.' });
    }

    const computed = items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0);
    if (Math.abs(computed - Number(subtotal || 0)) > 1) {   // 1-unit tolerance for rounding
      return res.status(422).json({ ok: false, message: 'Subtotal tidak sesuai dengan total item.' });
    }

    // ... rest of existing logic unchanged
  }
}
```

Apply the same `items` array check to `createCustomOrder` and `createOfflineOrder`.

---

### Fix 2.14 — updateOrderStatus key mismatch: controller reads `newStatus`

**File:** `server/src/controllers/orders.controller.js`

The frontend sends `{ newStatus }`. Change the controller to read `req.body.newStatus`:
```js
export async function updateOrderStatus(req, res, next) {
  try {
    const { newStatus } = req.body;   // was: const { status } = req.body
    if (!newStatus) {
      return res.status(422).json({ ok: false, message: 'Status wajib diisi.' });
    }
    // ... rest unchanged, replace `status` variable with `newStatus`
  }
}
```

No frontend change needed — `orderService.js` already sends `{ newStatus }`.

---

### Fix 2.15 — CartContext: null-safety guard on cart load

**File:** `src/components/context/CartContext.jsx`

```js
async function loadCart() {
  try {
    const result = await getCart(user?.id);
    const loaded = Array.isArray(result?.items) ? result.items : [];
    setItems(loaded);
  } catch (err) {
    console.error('[CartContext] Failed to load cart:', err);
    setItems([]);
  }
}
```

---

## Group 3 — Minor: Dead Code & Mode-Guard Gaps

### Fix 3.16 — Remove unused debounce export or wire it to ProductsPage search

**Decision:** Wire `debounce` to the search input in `ProductsPage` to eliminate dead code while improving UX.

**File:** `src/components/pages/public/ProductsPage.jsx`

Import `debounce` from `helpers.js` and wrap the search `onChange` handler:
```js
import { debounce } from '../../../core/helpers.js';

const handleSearchChange = useMemo(
  () => debounce((value) => setSearchQuery(value), 350),
  []
);

// In the input:
onChange={(e) => handleSearchChange(e.target.value)}
```

If `ProductsPage` does not have a search input, remove the `debounce` export from `helpers.js` instead.

---

### Fix 3.17 — chatService: getConversationByCustomer/getConversationById need USE_BACKEND guard

**File:** `src/services/chatService.js`

`getMessagesByCustomer` already has a `USE_BACKEND` branch that calls `createOrGetConversation` (which is backend-aware) and then `getMessagesByConversation`. The bug is that the localStorage path calls `getConversationByCustomer` which is localStorage-only. This is already correct — the `USE_BACKEND` branch does NOT call `getConversationByCustomer`. No change needed to the routing logic.

However, `getConversationByCustomer` and `getConversationById` are exported and could be called directly by other components. Add a guard comment and, if called from any component in backend mode, replace with `createOrGetConversation`:

```js
/**
 * Get a customer's conversation (localStorage mode only).
 * In backend mode, use createOrGetConversation() instead.
 * @param {string} customerId
 */
export function getConversationByCustomer(customerId) {
  if (USE_BACKEND) {
    console.warn('[chatService] getConversationByCustomer called in backend mode — use createOrGetConversation()');
    return null;
  }
  return load().conversations.find((c) => c.customerId === customerId) ?? null;
}
```

Verify no component calls these functions directly in backend mode. If `ChatWidget` calls them, replace with `createOrGetConversation`.

---

### Fix 3.18 — syncCartOnLogin: strip designDataUrl before sending

**File:** `src/services/cartService.js`

In `syncCartOnLogin`, strip `designDataUrl` before calling `syncCart`:
```js
export async function syncCartOnLogin() {
  if (!USE_BACKEND) return;
  const localItems = loadLocalCart();
  if (localItems.length === 0) return;
  // Strip base64 design data — can be megabytes and exceeds the 1 MB body limit
  const sanitized = localItems.map(({ designDataUrl, ...rest }) => rest);
  await syncCart(undefined, sanitized);
}
```

---

### Fix 3.19 — generateOrderNumber: use UUID fragment to eliminate collision risk

**File:** `server/src/services/orders.service.js`

```js
import { randomUUID } from 'crypto';   // already imported

function generateOrderNumber() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  // 8-char UUID fragment gives ~4 billion combinations per day
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `ORD-${ymd}-${suffix}`;
}
```

---

## Group 4 — Security

### Fix 4.20 — Chat: sanitize content in backend mode

**File:** `src/services/chatService.js`

In the `USE_BACKEND` text-message path inside `sendMessage`, apply `escapeHtml` before sending:
```js
if (type === 'text') {
  const trimmed = escapeHtml(String(content || '').trim());   // ← add escapeHtml
  if (!trimmed) return { ok: false, message: 'Pesan tidak boleh kosong.' };
  const res = await api.post(`/api/conversations/${conv.id}/messages`, {
    content: trimmed,
    senderRole,
  });
  return { ok: true, msg: res.data.data };
}
```

`escapeHtml` is already imported from `../core/helpers.js`.

---

### Fix 4.21 — Payment proof path: never accept from client body

**File:** `server/src/services/orders.service.js`

`attachPaymentProof(id, proofPath)` already only accepts a `proofPath` string. The controller (`uploadPaymentProof`) derives this path exclusively from `StorageService.save(req.file, 'payments')` — the client body is never read for the path. This is already correct.

Add a JSDoc note to make the intent explicit:
```js
/**
 * Attach a payment proof file path to an order.
 * @param {string} id  Order UUID
 * @param {string} proofPath  Server-side path from StorageService.save() — NEVER from client input
 */
export async function attachPaymentProof(id, proofPath) { ... }
```

No code change needed — this is a documentation fix only.

---

### Fix 4.22 — clearSession: use DOM event instead of window.location.href

**File:** `src/core/httpClient.js`

Replace the hard redirect with a DOM event that `AuthContext` can handle:
```js
export function clearSession() {
  _accessToken = null;
  window.dispatchEvent(new CustomEvent('gala:session-expired'));
}
```

**File:** `src/components/context/AuthContext.jsx`

Listen for the event and use React Router's `navigate`:
```js
import { useNavigate } from 'react-router-dom';

// Inside AuthProvider, after the existing useEffect:
const navigate = useNavigate();

useEffect(() => {
  function handleSessionExpired() {
    setUser(null);
    navigate('/register', { replace: true });
  }
  window.addEventListener('gala:session-expired', handleSessionExpired);
  return () => window.removeEventListener('gala:session-expired', handleSessionExpired);
}, [navigate]);
```

Note: `AuthProvider` must be rendered inside `BrowserRouter` for `useNavigate` to work. Currently `AuthProvider` wraps `BrowserRouter` in `App.jsx`. The fix requires moving `BrowserRouter` to wrap `AuthProvider`, or creating an inner component that uses `useNavigate`. The cleanest approach is to create an `AuthNavigationHandler` component rendered inside the router:

```jsx
// src/components/context/AuthContext.jsx — add inner handler
function AuthNavigationHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    function handleSessionExpired() {
      navigate('/register', { replace: true });
    }
    window.addEventListener('gala:session-expired', handleSessionExpired);
    return () => window.removeEventListener('gala:session-expired', handleSessionExpired);
  }, [navigate]);
  return null;
}
```

Then in `App.jsx`, render `<AuthNavigationHandler />` inside the `<BrowserRouter>` tree.

---

### Fix 4.23 — seedStaffUsers: add DEVELOPMENT ONLY comment

**File:** `src/services/authService.js`

Add a prominent comment to `seedStaffUsers`:
```js
/**
 * DEVELOPMENT ONLY — Seeds localStorage staff accounts.
 * Never call this when USE_BACKEND=true.
 * Passwords are stored in plain text in localStorage — for local dev only.
 */
export function seedStaffUsers({ ... } = {}) { ... }
```

The call-site guard in `App.jsx` (Fix 1.9) ensures it is never called in backend mode.

---

## Group 5 — Performance

### Fix 5.25 — getOrderById: parallel queries with Promise.all

**File:** `server/src/services/orders.service.js`

```js
export async function getOrderById(id) {
  const [orders] = await query('SELECT * FROM orders WHERE id = ?', [id]);
  if (orders.length === 0) return null;

  const order = orders[0];

  // Run items and history queries in parallel
  const [[items], [history]] = await Promise.all([
    query('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC', [id]),
    query('SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at ASC', [id]),
  ]);

  return { ...order, items, history };
}
```

---

## Group 6 — UX/UI

### Fix 6.26 — Login/Register: loading state on submit button

**File:** `src/components/pages/public/RegisterPage.jsx` (and any login form component)

Add a `submitting` state:
```js
const [submitting, setSubmitting] = useState(false);

async function handleSubmit(e) {
  e.preventDefault();
  setSubmitting(true);
  try {
    const result = await login({ email, password });
    // handle result
  } finally {
    setSubmitting(false);
  }
}

// In JSX:
<button type="submit" disabled={submitting}>
  {submitting ? 'Memproses...' : 'Login'}
</button>
```

---

### Fix 6.28 — ChatWidget: listen for gala:message-new in backend mode

**File:** `src/components/shared/ChatWidget.jsx`

Add a listener for the `gala:message-new` DOM event (dispatched by `chatService.js` when a Socket.io `message:new` event arrives):
```js
useEffect(() => {
  if (!user || !USE_BACKEND) return;
  function handleNewMessage() { loadMessages(); }
  window.addEventListener('gala:message-new', handleNewMessage);
  return () => window.removeEventListener('gala:message-new', handleNewMessage);
}, [user]);
```

---

### Fix 6.29 — StatusOrderPage: allow tracking by orderNumber alone for logged-in users

**File:** `src/components/pages/public/StatusOrderPage.jsx`

**File:** `server/src/controllers/orders.controller.js` (`trackOrder`)

Frontend: remove the phone requirement when the user is logged in:
```js
const { user } = useContext(AuthContext);

function runLookup(num, ph) {
  if (!num.trim()) { setErrorMessage('...'); return; }
  // Allow lookup without phone if user is logged in
  const result = findOrder({ orderNumber: num.trim(), phone: ph.trim() });
  // ...
}
```

Backend `trackOrder` controller: make `phone` optional when the request is authenticated:
```js
export async function trackOrder(req, res, next) {
  try {
    const { orderNumber, phone } = req.query;
    if (!orderNumber) {
      return res.status(400).json({ ok: false, message: 'orderNumber wajib diisi.' });
    }
    // phone is optional — if omitted, findOrder matches by orderNumber only
    const order = await svc.findOrder({ orderNumber, phone: phone || null });
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Pesanan tidak ditemukan.' });
    }
    return res.json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}
```

**File:** `server/src/services/orders.service.js` — update `findOrder` to make phone optional:
```js
export async function findOrder({ orderNumber, phone }) {
  if (phone) {
    const [rows] = await query(
      'SELECT * FROM orders WHERE order_number = ? AND customer_phone = ?',
      [orderNumber, phone]
    );
    return rows[0] || null;
  }
  // No phone — match by order number only
  const [rows] = await query(
    'SELECT * FROM orders WHERE order_number = ?',
    [orderNumber]
  );
  return rows[0] || null;
}
```

Frontend `findOrderLocal` in `orderService.js` — same change:
```js
function findOrderLocal({ orderNumber, phone }) {
  const num = String(orderNumber || '').trim();
  const ph  = String(phone       || '').trim();
  if (!num) return null;
  return load().find((o) => o.orderNumber === num && (!ph || o.customerPhone === ph)) ?? null;
}
```

This is already the existing localStorage implementation — no change needed there.

---

### Fix 6.30 — CheckoutPage: wrap handlePaymentSubmit in try/catch

Already covered in Fix 1.1/1.2 above — the `try/catch` wrapping `handlePaymentSubmit` calls `setFormAlert` on any thrown error.

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/App.jsx` | Guard `seedStaffUsers` with `!USE_BACKEND` |
| `src/components/context/AuthContext.jsx` | Add `loading` state; add `AuthNavigationHandler` for session-expired event |
| `src/components/context/CartContext.jsx` | Null-safety guard on `loadCart`; add error handling |
| `src/components/pages/public/CheckoutPage.jsx` | Async `handlePaymentSubmit`; await `createOrderFromCart`; USE_BACKEND branch for proof; try/catch |
| `src/components/pages/public/MyOrdersPage.jsx` | Async load useEffect; async event handler; async `handlePaymentSubmit`; `loading` guard |
| `src/components/pages/public/StatusOrderPage.jsx` | Allow phone-less lookup for logged-in users |
| `src/components/pages/public/ProductsPage.jsx` | Wire `debounce` to search input |
| `src/components/shared/ChatWidget.jsx` | Await `getMessagesByCustomer`; await `sendMessage`; listen for `gala:message-new` |
| `src/core/httpClient.js` | `clearSession` dispatches DOM event instead of hard redirect |
| `src/services/authService.js` | Add DEVELOPMENT ONLY comment to `seedStaffUsers` |
| `src/services/cartService.js` | Strip `designDataUrl` in `syncCartOnLogin` |
| `src/services/chatService.js` | `escapeHtml` in backend text-message path; USE_BACKEND guard on `getConversationByCustomer` |
| `src/services/orderService.js` | Add `Cancelled` to `ORDER_STATUSES`, `STANDARD_TIMELINE`, `CUSTOM_TIMELINE`, `STATUS_CONFIG` |
| `server/src/controllers/orders.controller.js` | `listMyOrders` returns `items` key; `updateOrderStatus` reads `newStatus`; validate items array + subtotal in `createOrder` |
| `server/src/controllers/cart.controller.js` | Validate `name`, `price`, `quantity` in `addItem` |
| `server/src/services/orders.service.js` | `generateOrderNumber` uses UUID fragment; `getOrderById` uses `Promise.all`; `findOrder` makes phone optional; add JSDoc to `attachPaymentProof` |
| CSS (order status styles) | Add `.status--cancelled` rule |

---

## Property-Based Testing

The following correctness properties should be verified by the existing and new property tests:

**P1 — Async resolution:** For any call to `createOrderFromCart` in backend mode, the resolved value must be a plain object with a string `id` field (not a Promise).

**P2 — Order status completeness:** For every status string returned by the backend `TRANSITIONS` map, `STATUS_CONFIG[status]` must be defined and have non-empty `icon` and `badge` fields.

**P3 — Cart validation:** For any `POST /api/cart/items` request where `price < 0` or `quantity < 1` or `name` is empty, the response status must be 422.

**P4 — Order subtotal integrity:** For any `POST /api/orders` request where `subtotal` differs from `sum(item.price * item.quantity)` by more than 1, the response status must be 422.

**P5 — Status update key consistency:** For any call to `updateOrderStatus` in backend mode, the PATCH body must contain the key `newStatus` and the controller must read `req.body.newStatus`.

**P6 — Cart sync payload size:** For any `syncCartOnLogin` call where local items contain `designDataUrl`, the serialized body sent to `POST /api/cart/sync` must not contain any `designDataUrl` field.

**P7 — Session expiry navigation:** When `clearSession()` is called, a `gala:session-expired` DOM event must be dispatched (not a `window.location.href` assignment).

**P8 — Order number uniqueness:** For any two calls to `generateOrderNumber()` on the same day, the probability of collision must be negligible (UUID fragment provides ~4 billion combinations).
