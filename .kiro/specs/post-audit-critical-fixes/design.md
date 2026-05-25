# Post-Audit Critical Fixes � Bugfix Design


## Overview

This document formalizes the fix strategy for ten issues identified during a data-flow audit of the Gala Printing application. The issues are grouped into two severity tiers:

**Critical (C)** — visible data loss, silent failures, or duplicate-submission vulnerabilities:
- **C1/C7/W5** — `listOrdersByCustomer` and `listOrders` return orders without `order_items`; every order card shows "—" for product names.
- **C2** — Payment proof upload failure is silently swallowed in `MyOrdersPage`; the user sees no error.
- **C5/W4** — Design file upload failures inside `createOrderFromCart` are caught by `Promise.allSettled` and logged only to the console; the user is never notified.
- **C6** — Uploaded files (payment proofs, design files) are never deleted when an order is cancelled or a proof is replaced, causing unbounded disk growth.
- **C8** — `CheckoutPage` has no submit lock; rapid double-clicks can create duplicate orders.

**Warning (W)** — fragile patterns that silently degrade data integrity or UX:
- **W2** — `attachPaymentProof` in `MyOrdersPage` does not validate `proof.dataUrl` before building `FormData`; an empty dataUrl sends an empty request body.
- **W3** — `CartContext` silently falls back to the localStorage cart on a network error with no user notification.
- **W6** — `createOrder` in `orders.service.js` inserts the order row and item rows sequentially outside a transaction; a mid-flight item-insert failure leaves a partial order in the database.
- **W7** — Order number generation uses two non-atomic queries (`UPDATE` then `SELECT`); concurrent requests can read the same `last_seq` value and produce duplicate order numbers.
- **W8** — `orders.status` is `VARCHAR(60)` with no database-level constraint; any string can be persisted silently.

The fix approach is minimal and targeted: each change is scoped to the smallest surface area that eliminates the defect without altering unaffected code paths.


## Glossary

- **Bug_Condition (C)**: The set of inputs or system states that trigger a defect — the condition `isBugCondition(input)` returns `true`.
- **Property (P)**: The desired correct behavior that the fixed code must exhibit for all inputs where `C` holds.
- **Preservation**: All behaviors that must remain unchanged for inputs where `C` does **not** hold.
- **`listOrdersByCustomer`**: Server-side function in `server/src/services/orders.service.js` that queries orders for a given customer but currently omits `order_items`.
- **`listOrders`**: Server-side paginated order list function in the same file; same omission.
- **`getOrderById`**: The one existing function that correctly fetches items and history in parallel — used as the reference implementation for the batch-fetch fix.
- **`createOrder`**: Server-side function that inserts an order row and its item rows; currently runs outside a transaction.
- **`generateOrderNumber`**: Server-side helper that increments `order_sequence.last_seq` and reads it back in two separate queries.
- **`attachPaymentProof` (controller)**: `uploadPaymentProof` in `orders.controller.js` — saves the uploaded file and updates `payment_proof_path`.
- **`attachPaymentProof` (service)**: `attachPaymentProof` in `orders.service.js` — updates the DB column.
- **`StorageService.delete`**: Utility in `server/src/utils/storage.js` that deletes a file by relative path, silently ignoring missing files.
- **`handlePaymentSubmit` (MyOrdersPage)**: The async handler in `MyOrdersPage.jsx` that calls `attachPaymentProof` and currently ignores `{ ok: false }` responses.
- **`handlePaymentSubmit` (CheckoutPage)**: The async handler in `CheckoutPage.jsx` that calls `createOrderFromCart`; currently has no submit lock.
- **`CartContext.loadCart`**: The `useEffect` in `CartContext.jsx` that calls `getCart`; currently swallows network errors silently.
- **`submitting` state**: A boolean React state variable used to disable the submit button and prevent concurrent submissions.
- **`SELECT … FOR UPDATE`**: A MySQL row-level lock that prevents concurrent transactions from reading the same row until the lock is released, enabling atomic read-modify-write on `order_sequence`.


## Bug Details

### Bug Condition

The ten defects share a common pattern: a code path either omits a required operation (fetching items, deleting files, locking a row, wrapping a transaction) or omits user-facing feedback when an operation fails.

**Formal Specification — composite bug condition:**

```
FUNCTION isBugCondition(input)
  INPUT: input — one of the following discriminated union cases
  OUTPUT: boolean

  CASE "list-orders":
    RETURN input.caller IN ['listOrdersByCustomer', 'listOrders']
           AND input.orderHasItems = true
           AND input.result.items = []          -- items array is empty

  CASE "payment-proof-upload-failure":
    RETURN input.caller = 'MyOrdersPage.handlePaymentSubmit'
           AND input.attachPaymentProofResult.ok = false
           AND input.errorMessageDisplayed = false  -- no error shown

  CASE "design-upload-failure":
    RETURN input.caller = 'createOrderFromCart'
           AND input.atLeastOneDesignUploadFailed = true
           AND input.userNotified = false        -- no warning surfaced

  CASE "no-file-cleanup":
    RETURN (input.event IN ['order-cancelled', 'proof-replaced'])
           AND input.oldFilePath != NULL
           AND StorageService.delete NOT called with input.oldFilePath

  CASE "no-submit-lock":
    RETURN input.caller = 'CheckoutPage.handleSubmit'
           AND input.concurrentCallCount > 1    -- button clicked twice

  CASE "empty-dataurl":
    RETURN input.caller = 'MyOrdersPage.handlePaymentSubmit'
           AND (input.proof.dataUrl = NULL OR input.proof.dataUrl = '')
           AND input.requestSent = true         -- empty FormData sent anyway

  CASE "silent-cart-fallback":
    RETURN input.caller = 'CartContext.loadCart'
           AND input.getCartThrew = true
           AND input.userNotified = false

  CASE "no-transaction":
    RETURN input.caller = 'createOrder'
           AND input.itemInsertFailed = true
           AND input.orderRowLeftInDB = true    -- partial order persisted

  CASE "non-atomic-seq":
    RETURN input.caller = 'generateOrderNumber'
           AND input.concurrentCallCount >= 2
           AND input.duplicateOrderNumberProduced = true

  CASE "unconstrained-status":
    RETURN input.caller IN ['INSERT orders', 'UPDATE orders SET status']
           AND input.statusValue NOT IN VALID_STATUSES
           AND input.writeSucceeded = true      -- invalid value accepted

END FUNCTION
```

### Examples

**C1/C7/W5 — Missing items:**
- Customer places an order for "Spanduk 3×1m" and "Stiker A4". `GET /api/orders/my` returns `[{ id: "...", items: [] }]`. `MyOrdersPage` renders "—" in the items summary.
- Admin opens the Orders section; every row shows empty product chips because `listOrders` also returns `items: []`.

**C2 — Silent payment proof failure:**
- User selects a 15 MB file that exceeds the multer size limit. The server returns `{ ok: false, message: "File terlalu besar." }`. The modal closes, the user sees nothing, and assumes the upload succeeded.

**C5/W4 — Silent design upload failure:**
- User adds a product with a design file. The order is created successfully, but the design upload returns a 500. The user sees the order confirmation page with no indication that the design was not attached.

**C6 — Orphaned files:**
- User uploads proof A (`payments/1234-abc.png`). Admin rejects and asks for a new proof. User uploads proof B (`payments/5678-def.png`). The DB now points to B, but A remains on disk forever.
- Admin cancels an order that had a design file. The design file remains on disk.

**C8 — Duplicate order:**
- User double-clicks "Buat Pesanan" on a slow connection. Two `POST /api/orders` requests are sent. Two orders with different order numbers but identical contents appear in the database.

**W2 — Empty FormData:**
- `PaymentModal` fails to read the file as a dataUrl (e.g., FileReader error). `proof.dataUrl` is `""`. `attachPaymentProof` builds a `FormData` with no `file` field and sends it. The server returns `422 File bukti pembayaran wajib diunggah.` — but the client never checks `res.ok`.

**W3 — Silent cart fallback:**
- The API server is temporarily unreachable. `getCart` throws. `CartContext` catches the error, sets `items = []`, and renders an empty cart. The user thinks their cart is empty and re-adds items, not knowing the server cart is intact.

**W6 — Partial order:**
- `createOrder` inserts the order row, then inserts item 1 successfully, then item 2 fails (e.g., `name` is null). The order row exists in the DB with no items. The customer sees an error but the admin sees a ghost order.

**W7 — Duplicate order number:**
- Two requests arrive simultaneously. Both execute `UPDATE order_sequence SET last_seq = last_seq + 1`. MySQL serializes the UPDATE, so `last_seq` becomes 42 and 43. But both then execute `SELECT last_seq` — if the pool reuses the same connection or the second SELECT runs before the first commits, both may read 43. Result: two orders with number `GALA-2025/01/15-000043`.

**W8 — Invalid status:**
- A bug in a future migration accidentally calls `UPDATE orders SET status = 'shipped'`. MySQL accepts it. The frontend's `STATUS_CONFIG` has no entry for `"shipped"`, so the badge renders as `○` with no label.


## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- `getOrderById` already fetches items and history correctly — its implementation MUST NOT change.
- When `attachPaymentProof` succeeds (`{ ok: true }`), `MyOrdersPage` MUST continue to refresh the order list and close the modal exactly as today.
- When all design file uploads succeed inside `createOrderFromCart`, the order creation flow MUST continue to return the order object without any warnings.
- When an order is not cancelled and no proof is replaced, all uploaded files MUST remain on disk untouched.
- When the user submits the checkout form once and the request succeeds, exactly one order MUST be created and the user MUST be navigated to `/my-orders`.
- When `getCart` succeeds in backend mode, `CartContext` MUST continue to set items from the server response without any fallback or warning.
- When `createOrder` inserts all items successfully, the transaction MUST commit and return the complete order as before.
- When order numbers are generated under normal (non-concurrent) conditions, they MUST continue to use the `GALA-YYYY/MM/DD-NNNNNN` format.
- When a valid status string is written to `orders.status`, the write MUST succeed without error.
- When `listOrdersByCustomer` is called for a customer with no orders, it MUST continue to return an empty array.
- When the admin orders table is loaded, all existing order metadata (order number, customer, status, subtotal, date) MUST continue to render alongside the product chips.

**Scope:**

All inputs that do NOT match any of the ten bug conditions above are completely unaffected by these fixes. Specifically:
- Successful file uploads (payment proofs, design files)
- Mouse/touch interactions unrelated to the checkout submit button
- Order status transitions, tracking number updates, admin notes
- Authentication, cart sync, product catalog, reviews, analytics


## Hypothesized Root Cause

### C1/C7/W5 — Missing order items in list queries

`listOrdersByCustomer` and `listOrders` execute a single `SELECT * FROM orders` query and return the raw rows. Unlike `getOrderById`, they never run a follow-up `SELECT * FROM order_items WHERE order_id IN (...)` query. The `mapOrder` function on the frontend maps `row.items` to an empty array when the field is absent, so the UI always shows "—".

**Root cause**: The list functions were written without the batch-fetch step that `getOrderById` performs. The fix is to collect all order IDs from the result set, run a single `SELECT * FROM order_items WHERE order_id IN (?)` query, and group the items back onto their parent orders.

### C2 — Payment proof upload failure not shown

`MyOrdersPage.handlePaymentSubmit` calls `attachPaymentProof` and checks `if (res.ok)` to refresh orders, but has no `else` branch. When `res.ok` is `false`, the function falls through to `setPaymentModalOpen(false)` unconditionally, closing the modal silently.

**Root cause**: Missing error-handling branch after the `if (res.ok)` check.

### C5/W4 — Design upload failures silently ignored

`createOrderFromCart` uses `Promise.allSettled` to upload design files, which by design never rejects. Rejected promises are only logged via `console.warn`. The function returns the order object regardless of upload outcomes, and the caller (`CheckoutPage.handlePaymentSubmit`) has no mechanism to surface partial failures.

**Root cause**: `Promise.allSettled` suppresses rejections; no warnings are propagated to the caller or the UI.

### C6 — No file cleanup

`uploadPaymentProof` (controller) calls `StorageService.save` to write the new file and `svc.attachPaymentProof` to update the DB path, but never reads the old `payment_proof_path` to delete it. `updateOrderStatus` (service) does not call `StorageService.delete` when transitioning to `Cancelled`.

**Root cause**: `StorageService.delete` exists and works correctly but is never called in these two code paths.

### C8 — No submit lock

`CheckoutPage` has no `submitting` state. The submit button is always enabled, and `handlePaymentSubmit` has no guard against concurrent invocations.

**Root cause**: Missing `submitting` boolean state and corresponding button `disabled` attribute.

### W2 — Empty dataUrl not validated

`attachPaymentProof` in `orderService.js` has a fallback branch that converts `proof.dataUrl` to a Blob, but if `dataUrl` is empty the `atob` call receives an empty string and produces a zero-byte Blob. The `FormData` then contains a zero-byte file, which the multer middleware may accept or reject depending on configuration. The client-side `MyOrdersPage.handlePaymentSubmit` never validates `proof.dataUrl` before calling `attachPaymentProof`.

**Root cause**: Missing pre-flight validation of `proof.dataUrl` before constructing `FormData`.

### W3 — Silent cart fallback

`CartContext.loadCart` wraps `getCart` in a `try/catch` that sets `items = []` on error. There is no state variable for a cart-load warning, and no UI element to display one.

**Root cause**: The catch block silently recovers without notifying the user.

### W6 — No DB transaction

`createOrder` in `orders.service.js` uses the `query` helper (which calls `pool.execute`) for each insert. `pool.execute` uses auto-commit mode. There is no `BEGIN`/`COMMIT`/`ROLLBACK` wrapping the sequence of inserts.

**Root cause**: The `query` helper does not support transactions; a connection must be acquired from the pool explicitly to use `connection.beginTransaction()`.

### W7 — Non-atomic sequence generation

`generateOrderNumber` runs `UPDATE order_sequence SET last_seq = last_seq + 1` followed by `SELECT last_seq FROM order_sequence`. These are two separate statements on potentially different pool connections. Under concurrent load, two connections can both execute the UPDATE (MySQL serializes row-level writes, so `last_seq` increments correctly to N and N+1), but if both then SELECT before either commits, they may both read the same value.

**Root cause**: The UPDATE and SELECT are not executed within the same transaction with a `SELECT … FOR UPDATE` lock, so the read is not guaranteed to see the result of this connection's own UPDATE exclusively.

### W8 — Unconstrained status column

Migration `004_create_orders.sql` defines `status VARCHAR(60) NOT NULL DEFAULT 'Waiting for Payment'`. There is no `CHECK` constraint or `ENUM` type restricting the allowed values.

**Root cause**: The column type was chosen as `VARCHAR` for flexibility, but no constraint was added to enforce the application-level status enum at the database level.


## Correctness Properties

Property 1: Bug Condition — Order List Includes Items

_For any_ call to `listOrdersByCustomer` or `listOrders` where at least one order in the result set has associated `order_items` rows in the database, the fixed functions SHALL return each order with a non-empty `items` array containing the correct item rows.

**Validates: Requirements 2.1, 2.2, 2.10**

---

Property 2: Bug Condition — Payment Proof Upload Failure Surfaced

_For any_ invocation of `MyOrdersPage.handlePaymentSubmit` where `attachPaymentProof` returns `{ ok: false }`, the fixed handler SHALL display a visible error message to the user and SHALL NOT close the payment modal, allowing the user to retry.

**Validates: Requirements 2.3**

---

Property 3: Bug Condition — Design Upload Failure Surfaced

_For any_ call to `createOrderFromCart` where at least one design file upload fails, the fixed function SHALL return a result that includes a non-empty `warnings` array, and the calling component SHALL display a non-blocking warning notification to the user.

**Validates: Requirements 2.4**

---

Property 4: Bug Condition — File Cleanup on Cancellation and Proof Replacement

_For any_ order cancellation where `payment_proof_path` or any `design_file_path` is non-null, the fixed code SHALL call `StorageService.delete` with each non-null path. _For any_ payment proof replacement where the order already has a non-null `payment_proof_path`, the fixed code SHALL call `StorageService.delete` with the old path before (or immediately after) persisting the new path.

**Validates: Requirements 2.5, 2.6**

---

Property 5: Bug Condition — Submit Lock Prevents Duplicate Orders

_For any_ sequence of N rapid clicks on the "Buat Pesanan" button (N ≥ 2), the fixed `CheckoutPage` SHALL call `createOrderFromCart` exactly once, because the button is disabled and `submitting` is `true` after the first click until the request completes.

**Validates: Requirements 2.7**

---

Property 6: Bug Condition — dataUrl Validated Before Upload

_For any_ invocation of `MyOrdersPage.handlePaymentSubmit` where `proof.dataUrl` is absent or empty, the fixed handler SHALL display an error message indicating no file was selected and SHALL NOT call `attachPaymentProof`.

**Validates: Requirements 2.8**

---

Property 7: Bug Condition — Cart Load Failure Notifies User

_For any_ invocation of `CartContext.loadCart` where `getCart` throws a network error, the fixed context SHALL set a `cartLoadWarning` state that causes a non-blocking warning banner to be displayed, while still rendering the locally cached cart items.

**Validates: Requirements 2.9**

---

Property 8: Bug Condition — Order Creation is Atomic

_For any_ call to `createOrder` where any item insert fails, the fixed function SHALL roll back the entire transaction so that no order row exists in the database after the failure.

**Validates: Requirements 2.11**

---

Property 9: Bug Condition — Order Number Generation is Unique Under Concurrency

_For any_ set of N concurrent calls to `generateOrderNumber` (N ≥ 2), the fixed function SHALL produce N distinct order numbers with no duplicates.

**Validates: Requirements 2.12**

---

Property 10: Bug Condition — Invalid Status Rejected at DB Level

_For any_ attempt to insert or update an order with a `status` value not in the allowed set (`Waiting for Payment`, `Payment Accepted`, `Waiting for Design Approval`, `Design Accepted`, `On Progress`, `Quality Checking`, `In Delivery`, `Finished`, `Cancelled`), the fixed database schema SHALL reject the write with a constraint violation error.

**Validates: Requirements 2.13**

---

Property 11: Preservation — Unaffected Code Paths Unchanged

_For any_ input where none of the ten bug conditions hold (isBugCondition returns false for all cases), the fixed code SHALL produce exactly the same result as the original code, preserving all existing behavior for successful flows, unrelated features, and the localStorage fallback path.

**Validates: Requirements 3.1–3.11**


## Fix Implementation

### Changes Required

#### Fix 1 — Batch-fetch order items in list queries

**File**: `server/src/services/orders.service.js`

**Functions**: `listOrders`, `listOrdersByCustomer`

**Specific Changes**:

1. After fetching the order rows, collect all order IDs into an array.
2. If the array is non-empty, execute a single `SELECT * FROM order_items WHERE order_id IN (?)` query.
3. Group the returned item rows by `order_id` into a `Map<orderId, item[]>`.
4. Attach the grouped items to each order: `order.items = itemsByOrderId.get(order.id) ?? []`.
5. Return the enriched orders array.

```
FUNCTION attachItemsToOrders(orders)
  IF orders.length = 0 THEN RETURN orders

  ids    := orders.map(o => o.id)
  items  := SELECT * FROM order_items WHERE order_id IN (ids)
  byId   := groupBy(items, item => item.order_id)

  FOR EACH order IN orders DO
    order.items := byId.get(order.id) ?? []
  END FOR

  RETURN orders
END FUNCTION
```

---

#### Fix 2 — Surface payment proof upload failure in MyOrdersPage

**File**: `src/components/pages/public/MyOrdersPage.jsx`

**Function**: `handlePaymentSubmit`

**Specific Changes**:

1. Add a `paymentError` state variable (`useState('')`).
2. In `handlePaymentSubmit`, add an `else` branch after `if (res.ok)`:
   - Set `paymentError` to `res.message ?? 'Gagal mengunggah bukti pembayaran.'`
   - Do NOT close the modal or reset `selectedOrder`.
3. Display `paymentError` inside `PaymentModal` (pass as a prop or render above the submit button).
4. Clear `paymentError` when the modal is closed or a new order is selected.

---

#### Fix 3 — Surface design upload failures in createOrderFromCart

**File**: `src/services/orderService.js`

**Function**: `createOrderFromCart` (backend branch)

**Specific Changes**:

1. Change `Promise.allSettled(uploadPromises)` to collect rejected results.
2. After settling, filter for `status === 'rejected'` entries.
3. If any rejections exist, attach a `warnings` array to the returned order object:
   `order.warnings = ['Satu atau lebih file desain gagal diunggah. Silakan unggah ulang.']`
4. In `CheckoutPage.handlePaymentSubmit`, after `createOrderFromCart` resolves, check `order.warnings?.length > 0` and display a toast/alert before navigating.

---

#### Fix 4 — Delete files on order cancellation and proof replacement

**File**: `server/src/services/orders.service.js`

**Functions**: `updateOrderStatus`, `attachPaymentProof`

**Specific Changes**:

1. **Proof replacement** — In `attachPaymentProof(id, proofPath)`:
   - Before updating the DB, fetch the current order to read `payment_proof_path`.
   - If `payment_proof_path` is non-null, call `await StorageService.delete(payment_proof_path)`.
   - Then update the DB column.

2. **Order cancellation** — In `updateOrderStatus(id, newStatus, actorId, actorRole)`:
   - After validating the transition, check `if (newStatus === 'Cancelled')`.
   - Fetch the order's `payment_proof_path` and all `design_file_path` values from `order_items`.
   - Call `StorageService.delete` for each non-null path.

**Note**: `StorageService.delete` already silently ignores missing files, so no additional error handling is needed.

---

#### Fix 5 — Add submit lock to CheckoutPage

**File**: `src/components/pages/public/CheckoutPage.jsx`

**Specific Changes**:

1. Add `const [submitting, setSubmitting] = useState(false)` to the component state.
2. At the start of `handlePaymentSubmit`, add: `if (submitting) return; setSubmitting(true);`
3. Wrap the entire body of `handlePaymentSubmit` in a `try/finally` block; in the `finally` block, call `setSubmitting(false)`.
4. Add `disabled={submitting}` to the submit button.
5. Optionally update the button label to `submitting ? 'Memproses...' : 'Buat Pesanan'`.

---

#### Fix 6 — Validate dataUrl before payment proof upload

**File**: `src/components/pages/public/MyOrdersPage.jsx`

**Function**: `handlePaymentSubmit`

**Specific Changes**:

1. At the top of `handlePaymentSubmit`, after the `if (!selectedOrder || !result?.proof)` guard, add:
   ```
   if (!proof.dataUrl) {
     setPaymentError('Tidak ada file yang dipilih. Silakan pilih file bukti pembayaran.');
     return;
   }
   ```
2. This prevents the empty-FormData request from ever being sent.

---

#### Fix 7 — Notify user on cart load failure

**File**: `src/components/context/CartContext.jsx`

**Specific Changes**:

1. Add `const [cartLoadWarning, setCartLoadWarning] = useState('')` to the provider state.
2. In the `catch` block of `loadCart`, instead of only logging:
   - Set `items` to the localStorage fallback: `setItems(loadLocalCart())` (import `loadLocalCart` or call `getCart` in non-backend mode).
   - Set `setCartLoadWarning('Keranjang server tidak dapat dimuat. Menampilkan keranjang lokal.')`.
3. Expose `cartLoadWarning` and a `clearCartLoadWarning` setter through the context value.
4. In a suitable layout component (e.g., the main `App` or a cart-aware layout), consume `cartLoadWarning` and render a dismissible warning banner.

**Note**: The warning should only appear when `USE_BACKEND=true` and the user is logged in, since the localStorage fallback is the intended behavior for guest users.

---

#### Fix 8 — Wrap order creation in a DB transaction

**File**: `server/src/services/orders.service.js`

**Function**: `createOrder`

**Specific Changes**:

1. Acquire a connection from the pool: `const conn = await pool.getConnection()`.
2. Call `await conn.beginTransaction()`.
3. Replace all `query(...)` calls inside `createOrder` with `conn.execute(...)`.
4. On success, call `await conn.commit()`.
5. In a `catch` block, call `await conn.rollback(); throw err`.
6. In a `finally` block, call `conn.release()`.
7. Import `pool` from `../db/connection.js` (it is already exported).

```
FUNCTION createOrder(opts)
  conn := pool.getConnection()
  conn.beginTransaction()
  TRY
    INSERT INTO orders (...)
    FOR EACH item IN opts.items DO
      INSERT INTO order_items (...)
    END FOR
    INSERT INTO order_history (...)
    conn.commit()
    RETURN getOrderById(id)
  CATCH err
    conn.rollback()
    THROW err
  FINALLY
    conn.release()
  END TRY
END FUNCTION
```

---

#### Fix 9 — Make order number generation atomic

**File**: `server/src/services/orders.service.js`

**Function**: `generateOrderNumber`

**Specific Changes**:

Replace the two-query approach with a single atomic operation using `SELECT … FOR UPDATE` inside a transaction:

```
FUNCTION generateOrderNumber(conn)
  -- conn is the transaction connection from createOrder
  conn.execute('SELECT last_seq FROM order_sequence WHERE id = 1 FOR UPDATE')
  -- row is now locked; no other transaction can read or write it
  newSeq := row.last_seq + 1
  conn.execute('UPDATE order_sequence SET last_seq = ? WHERE id = 1', [newSeq])
  RETURN format('GALA-{yyyy}/{mm}/{dd}-{newSeq padded to 6}')
END FUNCTION
```

Because `generateOrderNumber` is called inside `createOrder`'s transaction, the `FOR UPDATE` lock is held until the transaction commits or rolls back, guaranteeing uniqueness.

---

#### Fix 10 — Add CHECK constraint to orders.status

**File**: `server/src/db/migrations/016_add_status_check_constraint.sql` (new file)

**Specific Changes**:

Create a new migration that adds an `ALTER TABLE` statement:

```sql
ALTER TABLE orders
  MODIFY COLUMN status VARCHAR(60) NOT NULL DEFAULT 'Waiting for Payment',
  ADD CONSTRAINT chk_orders_status CHECK (
    status IN (
      'Waiting for Payment',
      'Payment Accepted',
      'Waiting for Design Approval',
      'Design Accepted',
      'On Progress',
      'Quality Checking',
      'In Delivery',
      'Finished',
      'Cancelled'
    )
  );
```

**Note**: MySQL 8.0.16+ enforces `CHECK` constraints. If the target environment uses MySQL 5.7, the constraint is parsed but not enforced; in that case, an `ENUM` column type should be used instead. The migration runner (`server/src/db/migrate.js`) will apply this automatically on next startup.


## Testing Strategy

### Validation Approach

The testing strategy follows the bug condition methodology in two phases:

1. **Exploratory phase** — Write tests that exercise the bug condition on the *unfixed* code to confirm the root cause analysis. These tests are expected to fail on unfixed code and pass after the fix.
2. **Preservation phase** — Write property-based tests that verify all non-buggy inputs continue to behave identically before and after the fix.

The existing test suite in `server/src/tests/` uses Vitest with fast-check for property-based testing. New tests follow the same conventions.

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug on unfixed code. Confirm or refute the root cause analysis.

**Test Plan**: Write unit/integration tests that call the affected functions with inputs matching the bug condition and assert the expected correct behavior. Run on unfixed code to observe failures.

**Test Cases**:

1. **Items missing from customer list** (C1): Call `listOrdersByCustomer` for a customer with known orders that have items. Assert `result[0].items.length > 0`. *(Will fail on unfixed code — items array is empty.)*

2. **Items missing from admin paginated list** (C7/W5): Call `listOrders({ page: 1, limit: 10 })` when orders with items exist. Assert `result.items[0].items.length > 0`. *(Will fail on unfixed code.)*

3. **Payment proof failure not shown** (C2): Mock `attachPaymentProof` to return `{ ok: false, message: 'Test error' }`. Render `MyOrdersPage`, trigger `handlePaymentSubmit`. Assert that an error message containing 'Test error' is visible and the modal is still open. *(Will fail on unfixed code — modal closes silently.)*

4. **Design upload failure not surfaced** (C5/W4): Mock the design upload API to reject. Call `createOrderFromCart` with an item that has a `designDataUrl`. Assert `result.warnings` is a non-empty array. *(Will fail on unfixed code — `warnings` is undefined.)*

5. **No file cleanup on cancellation** (C6a): Spy on `StorageService.delete`. Call `updateOrderStatus(id, 'Cancelled', ...)` on an order with a non-null `payment_proof_path`. Assert `StorageService.delete` was called with that path. *(Will fail on unfixed code — delete is never called.)*

6. **No file cleanup on proof replacement** (C6b): Spy on `StorageService.delete`. Call `attachPaymentProof(id, newPath)` on an order that already has a `payment_proof_path`. Assert `StorageService.delete` was called with the old path. *(Will fail on unfixed code.)*

7. **Duplicate order on double-click** (C8): Render `CheckoutPage`, simulate two rapid clicks on "Buat Pesanan". Assert `createOrderFromCart` was called exactly once. *(Will fail on unfixed code — called twice.)*

8. **Empty dataUrl sends request** (W2): Render `MyOrdersPage`, call `handlePaymentSubmit` with `proof.dataUrl = ''`. Assert `attachPaymentProof` was NOT called and an error message is visible. *(Will fail on unfixed code — request is sent.)*

9. **Silent cart fallback** (W3): Mock `getCart` to throw. Render `CartContext`. Assert a warning message is visible in the UI. *(Will fail on unfixed code — no warning shown.)*

10. **Partial order on item insert failure** (W6): Mock `conn.execute` to throw on the second item insert. Call `createOrder` with two items. Assert no order row exists in the DB after the call. *(Will fail on unfixed code — order row is left.)*

11. **Duplicate order number under concurrency** (W7): Call `generateOrderNumber` concurrently N=50 times. Assert all returned numbers are unique. *(Will fail on unfixed code under load.)*

12. **Invalid status accepted** (W8): Attempt `INSERT INTO orders (..., status) VALUES (..., 'invalid_status')`. Assert the query throws a constraint violation. *(Will fail on unfixed schema — insert succeeds.)*

**Expected Counterexamples**:
- `listOrdersByCustomer` returns `[{ id: '...', items: [] }]` even when `order_items` rows exist.
- `handlePaymentSubmit` closes the modal without displaying any error text.
- `createOrderFromCart` returns `{ id: '...', items: [...] }` with no `warnings` field.
- `StorageService.delete` call count is 0 after cancellation.
- `createOrderFromCart` is called twice when the button is clicked twice.
- `attachPaymentProof` is called with an empty FormData.
- No warning banner appears after `getCart` throws.
- An order row exists in the DB after a failed item insert.
- Two concurrent `generateOrderNumber` calls return the same string.
- `INSERT` with `status = 'invalid_status'` succeeds.

---

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**

```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

After applying each fix, re-run the exploratory tests above. All 12 tests must pass.

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is used for the server-side fixes (items batch-fetch, transaction, atomic sequence) because these involve data-dependent behavior across many possible inputs. Example-based tests are used for the UI fixes.

**Test Cases**:

1. **Successful order list preserves metadata** (Preservation of C1/C7/W5 fix): For any paginated order list result, all existing fields (`id`, `order_number`, `status`, `subtotal`, `created_at`, `customer_name`) MUST be present and unchanged. *(Property-based: generate random order sets, verify field preservation.)*

2. **Successful payment proof upload unchanged** (Preservation of C2 fix): When `attachPaymentProof` returns `{ ok: true }`, the modal closes and orders refresh exactly as before. *(Example-based.)*

3. **All-success design upload unchanged** (Preservation of C5/W4 fix): When all design uploads succeed, `createOrderFromCart` returns an order with no `warnings` field. *(Example-based.)*

4. **Non-cancelled orders keep files** (Preservation of C6 fix): When `updateOrderStatus` transitions to any status other than `Cancelled`, `StorageService.delete` is NOT called. *(Example-based: test each non-Cancelled transition.)*

5. **Single checkout submit unchanged** (Preservation of C8 fix): When the button is clicked once and the request succeeds, exactly one order is created and the user navigates to `/my-orders`. *(Example-based.)*

6. **Valid dataUrl proceeds normally** (Preservation of W2 fix): When `proof.dataUrl` is a valid base64 string, `attachPaymentProof` is called and the upload proceeds. *(Example-based.)*

7. **Successful cart load unchanged** (Preservation of W3 fix): When `getCart` succeeds, no warning banner is shown and items are set from the server response. *(Example-based.)*

8. **Successful order creation unchanged** (Preservation of W6 fix): When all item inserts succeed, the transaction commits and `createOrder` returns the complete order. *(Property-based: generate random item arrays of length 1–10.)*

9. **Sequential order numbers unchanged** (Preservation of W7 fix): Under non-concurrent conditions, order numbers continue to use the `GALA-YYYY/MM/DD-NNNNNN` format and increment monotonically. *(Property-based: generate N sequential calls, verify format and monotonicity.)*

10. **Valid status writes unchanged** (Preservation of W8 fix): All nine valid status values can be written to `orders.status` without error. *(Example-based: test each valid status.)*

---

### Unit Tests

- Test `attachItemsToOrders` helper in isolation: given a list of orders and a list of items, verify correct grouping.
- Test `generateOrderNumber` format: verify the output matches `GALA-\d{4}/\d{2}/\d{2}-\d{6}`.
- Test `MyOrdersPage.handlePaymentSubmit` with `{ ok: false }` response: verify error state is set and modal stays open.
- Test `MyOrdersPage.handlePaymentSubmit` with empty `dataUrl`: verify `attachPaymentProof` is not called.
- Test `CheckoutPage` submit button: verify `disabled` attribute is set during submission.
- Test `CartContext` with failing `getCart`: verify `cartLoadWarning` is set.
- Test `StorageService.delete` is called with correct paths on cancellation and proof replacement.

### Property-Based Tests

- **Order items batch-fetch** (Property 1): For any array of N orders (N ∈ [0, 50]) each with M items (M ∈ [0, 10]), `attachItemsToOrders` must return each order with exactly M items, all matching the source data.
- **Transaction atomicity** (Property 8): For any `createOrder` call where item insert K fails (K ∈ [1, N]), no order row exists in the DB afterward.
- **Order number uniqueness** (Property 9): For any N concurrent `generateOrderNumber` calls (N ∈ [2, 100]), all returned strings are distinct.
- **Preservation of order metadata** (Property 11): For any order returned by the fixed `listOrders`, all fields present in the original query result are preserved unchanged.

### Integration Tests

- Full checkout flow: submit form → create order → attach payment proof → verify order appears in `listOrdersByCustomer` with items populated.
- Cancellation flow: create order with proof and design files → cancel order → verify files are deleted from disk.
- Proof replacement flow: upload proof A → upload proof B → verify proof A is deleted and proof B is stored.
- Concurrent order creation: fire 10 simultaneous `POST /api/orders` requests → verify 10 distinct order numbers in the DB.
- Invalid status rejection: attempt to set `status = 'bogus'` via direct SQL → verify MySQL rejects with constraint error.
