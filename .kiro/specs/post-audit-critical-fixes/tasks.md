# Implementation Plan

- [x] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - Ten Post-Audit Defects
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms each bug exists
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope each property to the concrete failing case(s) to ensure reproducibility
  - Create `server/src/tests/postAuditBugCondition.property.test.js`
  - **C1/C7/W5 — Items missing from list queries**: Call `listOrdersByCustomer` for a customer with known orders that have items; assert `result[0].items.length > 0`. Call `listOrders({ page: 1, limit: 10 })` with seeded data; assert each returned order has a non-empty `items` array. *(Expected: FAIL — items array is always `[]` on unfixed code)*
  - **C2 — Payment proof failure not shown**: Mock `attachPaymentProof` to return `{ ok: false, message: 'Test error' }`; render `MyOrdersPage`, trigger `handlePaymentSubmit`; assert an error message containing 'Test error' is visible and the modal is still open. *(Expected: FAIL — modal closes silently)*
  - **C5/W4 — Design upload failure not surfaced**: Mock the design upload API to reject; call `createOrderFromCart` with an item that has a `designDataUrl`; assert `result.warnings` is a non-empty array. *(Expected: FAIL — `warnings` is undefined)*
  - **C6a — No file cleanup on cancellation**: Spy on `StorageService.delete`; call `updateOrderStatus(id, 'Cancelled', ...)` on an order with a non-null `payment_proof_path`; assert `StorageService.delete` was called with that path. *(Expected: FAIL — delete is never called)*
  - **C6b — No file cleanup on proof replacement**: Spy on `StorageService.delete`; call `attachPaymentProof(id, newPath)` on an order that already has a `payment_proof_path`; assert `StorageService.delete` was called with the old path. *(Expected: FAIL — delete is never called)*
  - **C8 — Duplicate order on double-click**: Render `CheckoutPage`, simulate two rapid clicks on "Buat Pesanan"; assert `createOrderFromCart` was called exactly once. *(Expected: FAIL — called twice)*
  - **W2 — Empty dataUrl sends request**: Render `MyOrdersPage`, call `handlePaymentSubmit` with `proof.dataUrl = ''`; assert `attachPaymentProof` was NOT called and an error message is visible. *(Expected: FAIL — request is sent)*
  - **W3 — Silent cart fallback**: Mock `getCart` to throw; render `CartContext`; assert a warning message is visible in the UI. *(Expected: FAIL — no warning shown)*
  - **W6 — Partial order on item insert failure**: Mock `conn.execute` to throw on the second item insert; call `createOrder` with two items; assert no order row exists in the DB after the call. *(Expected: FAIL — order row is left)*
  - **W7 — Duplicate order number under concurrency**: Call `generateOrderNumber` concurrently N=50 times; assert all returned numbers are unique. *(Expected: FAIL under load — duplicate numbers produced)*
  - **W8 — Invalid status accepted**: Attempt `INSERT INTO orders (..., status) VALUES (..., 'invalid_status')`; assert the query throws a constraint violation. *(Expected: FAIL — insert succeeds on unfixed schema)*
  - Run all tests on UNFIXED code
  - **EXPECTED OUTCOME**: All tests FAIL (this is correct — it proves each bug exists)
  - Document counterexamples found (e.g., `listOrdersByCustomer` returns `[{ id: '...', items: [] }]` even when `order_items` rows exist)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13_

- [x] 2. Write preservation property tests (BEFORE implementing any fix)
  - **Property 2: Preservation** - Unaffected Code Paths Unchanged
  - **IMPORTANT**: Follow observation-first methodology — run UNFIXED code with non-buggy inputs, observe outputs, then write tests
  - Create `server/src/tests/postAuditPreservation.property.test.js`
  - **Preservation 1 — Order list metadata preserved**: For any paginated order list result, all existing fields (`id`, `order_number`, `status`, `subtotal`, `created_at`, `customer_name`) MUST be present and unchanged after the batch-fetch fix. Observe field values on unfixed code; write property-based test asserting field preservation for random order sets (N ∈ [0, 50]).
  - **Preservation 2 — Successful payment proof upload unchanged**: When `attachPaymentProof` returns `{ ok: true }`, the modal closes and orders refresh exactly as before. Observe the success flow on unfixed code; write example-based test.
  - **Preservation 3 — All-success design upload unchanged**: When all design uploads succeed, `createOrderFromCart` returns an order with no `warnings` field. Observe on unfixed code; write example-based test.
  - **Preservation 4 — Non-cancelled orders keep files**: When `updateOrderStatus` transitions to any status other than `Cancelled`, `StorageService.delete` is NOT called. Observe each non-Cancelled transition on unfixed code; write example-based tests for each valid transition.
  - **Preservation 5 — Single checkout submit unchanged**: When the button is clicked once and the request succeeds, exactly one order is created and the user navigates to `/my-orders`. Observe on unfixed code; write example-based test.
  - **Preservation 6 — Valid dataUrl proceeds normally**: When `proof.dataUrl` is a valid base64 string, `attachPaymentProof` is called and the upload proceeds. Observe on unfixed code; write example-based test.
  - **Preservation 7 — Successful cart load unchanged**: When `getCart` succeeds, no warning banner is shown and items are set from the server response. Observe on unfixed code; write example-based test.
  - **Preservation 8 — Successful order creation unchanged**: When all item inserts succeed, `createOrder` returns the complete order. Observe on unfixed code; write property-based test with random item arrays of length 1–10.
  - **Preservation 9 — Sequential order numbers unchanged**: Under non-concurrent conditions, order numbers continue to use the `GALA-YYYY/MM/DD-NNNNNN` format and increment monotonically. Observe on unfixed code; write property-based test for N sequential calls.
  - **Preservation 10 — Valid status writes unchanged**: All nine valid status values can be written to `orders.status` without error. Observe on unfixed code; write example-based test for each valid status.
  - **Preservation 11 — Empty customer returns empty array**: `listOrdersByCustomer` for a customer with no orders returns `[]`. Observe on unfixed code; write example-based test.
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: All preservation tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

- [x] 3. Fix C1/C7/W5 — Batch-fetch order items in list queries

  - [x] 3.1 Add `attachItemsToOrders` helper to `orders.service.js`
    - After fetching order rows, collect all order IDs into an array
    - If the array is non-empty, execute a single `SELECT * FROM order_items WHERE order_id IN (?)` query
    - Group returned item rows by `order_id` into a Map
    - Attach grouped items to each order: `order.items = itemsByOrderId.get(order.id) ?? []`
    - Return the enriched orders array
    - _Bug_Condition: `isBugCondition({ caller: 'listOrdersByCustomer' | 'listOrders', orderHasItems: true, result.items: [] })`_
    - _Expected_Behavior: each order in the result has `items` array populated with correct `order_items` rows_
    - _Preservation: `getOrderById` implementation MUST NOT change; all order metadata fields MUST be preserved_
    - _Requirements: 2.1, 2.2, 2.10, 3.1, 3.10, 3.11_

  - [x] 3.2 Apply `attachItemsToOrders` in `listOrdersByCustomer`
    - Call `attachItemsToOrders(rows)` before returning from both the `customerId` and `customerPhone` branches
    - _Requirements: 2.1, 3.10_

  - [x] 3.3 Apply `attachItemsToOrders` in `listOrders`
    - Call `attachItemsToOrders(items)` on the paginated result before returning
    - _Requirements: 2.2, 2.10, 3.11_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Order List Includes Items
    - **IMPORTANT**: Re-run the SAME tests from task 1 (C1/C7/W5 cases) — do NOT write new tests
    - Run `listOrdersByCustomer` and `listOrders` exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms items are now populated)
    - _Requirements: 2.1, 2.2, 2.10_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Order List Metadata Preserved
    - **IMPORTANT**: Re-run the SAME preservation tests from task 2 (Preservation 1 and 11)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in order metadata or empty-customer behavior)

- [x] 4. Fix C2 — Surface payment proof upload failure in MyOrdersPage

  - [x] 4.1 Add `paymentError` state and error display to `MyOrdersPage`
    - Add `const [paymentError, setPaymentError] = useState('')` to component state
    - In `handlePaymentSubmit`, add an `else` branch after `if (res.ok)`: set `paymentError` to `res.message ?? 'Gagal mengunggah bukti pembayaran.'` and do NOT close the modal or reset `selectedOrder`
    - Pass `paymentError` to `PaymentModal` (as a prop or render above the submit button inside the modal)
    - Clear `paymentError` when the modal is closed or a new order is selected
    - _Bug_Condition: `isBugCondition({ caller: 'MyOrdersPage.handlePaymentSubmit', attachPaymentProofResult.ok: false, errorMessageDisplayed: false })`_
    - _Expected_Behavior: visible error message displayed; modal stays open; user can retry_
    - _Preservation: when `attachPaymentProof` returns `{ ok: true }`, modal closes and orders refresh exactly as before_
    - _Requirements: 2.3, 3.2_

  - [x] 4.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Payment Proof Upload Failure Surfaced
    - **IMPORTANT**: Re-run the SAME test from task 1 (C2 case) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms error is shown and modal stays open)
    - _Requirements: 2.3_

  - [x] 4.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful Payment Proof Upload Unchanged
    - **IMPORTANT**: Re-run the SAME preservation test from task 2 (Preservation 2)
    - **EXPECTED OUTCOME**: Test PASSES (confirms success flow is unchanged)

- [x] 5. Fix C5/W4 — Surface design upload failures in createOrderFromCart

  - [x] 5.1 Collect rejected design uploads and attach warnings to order result
    - In `createOrderFromCart` (backend branch in `src/services/orderService.js`), change `Promise.allSettled(uploadPromises)` to collect results
    - After settling, filter for `status === 'rejected'` entries
    - If any rejections exist, attach `order.warnings = ['Satu atau lebih file desain gagal diunggah. Silakan unggah ulang.']` to the returned order object
    - _Bug_Condition: `isBugCondition({ caller: 'createOrderFromCart', atLeastOneDesignUploadFailed: true, userNotified: false })`_
    - _Expected_Behavior: returned order object has non-empty `warnings` array when any upload fails_
    - _Preservation: when all design uploads succeed, returned order has no `warnings` field_
    - _Requirements: 2.4, 3.3_

  - [x] 5.2 Display design upload warning in CheckoutPage
    - In `CheckoutPage.handlePaymentSubmit`, after `createOrderFromCart` resolves, check `order.warnings?.length > 0`
    - If warnings exist, display a non-blocking alert/toast before navigating to `/my-orders`
    - _Requirements: 2.4_

  - [x] 5.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Design Upload Failure Surfaced
    - **IMPORTANT**: Re-run the SAME test from task 1 (C5/W4 case) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms `warnings` array is populated on upload failure)
    - _Requirements: 2.4_

  - [x] 5.4 Verify preservation tests still pass
    - **Property 2: Preservation** - All-Success Design Upload Unchanged
    - **IMPORTANT**: Re-run the SAME preservation test from task 2 (Preservation 3)
    - **EXPECTED OUTCOME**: Test PASSES (confirms no `warnings` on full success)

- [x] 6. Fix C6 — Delete files on order cancellation and proof replacement

  - [x] 6.1 Delete old payment proof on replacement in `attachPaymentProof` (service)
    - In `server/src/services/orders.service.js`, before updating the DB in `attachPaymentProof(id, proofPath)`, fetch the current order to read `payment_proof_path`
    - If `payment_proof_path` is non-null, call `await StorageService.delete(payment_proof_path)`
    - Then update the DB column
    - Import `StorageService` from `../utils/storage.js`
    - _Bug_Condition: `isBugCondition({ event: 'proof-replaced', oldFilePath != null, StorageService.delete NOT called })`_
    - _Expected_Behavior: `StorageService.delete` called with old path before new path is persisted_
    - _Preservation: when no existing proof path, no delete call is made; `StorageService.delete` silently ignores missing files_
    - _Requirements: 2.6, 3.4_

  - [x] 6.2 Delete files on order cancellation in `updateOrderStatus` (service)
    - In `updateOrderStatus`, after validating the transition, check `if (newStatus === 'Cancelled')`
    - Fetch the order's `payment_proof_path` and all `design_file_path` values from `order_items`
    - Call `StorageService.delete` for each non-null path
    - _Bug_Condition: `isBugCondition({ event: 'order-cancelled', oldFilePath != null, StorageService.delete NOT called })`_
    - _Expected_Behavior: `StorageService.delete` called for each non-null payment proof and design file path_
    - _Preservation: when transitioning to any status other than `Cancelled`, `StorageService.delete` is NOT called_
    - _Requirements: 2.5, 3.4_

  - [x] 6.3 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - File Cleanup on Cancellation and Proof Replacement
    - **IMPORTANT**: Re-run the SAME tests from task 1 (C6a and C6b cases) — do NOT write new tests
    - **EXPECTED OUTCOME**: Both tests PASS (confirms `StorageService.delete` is called with correct paths)
    - _Requirements: 2.5, 2.6_

  - [x] 6.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Cancelled Orders Keep Files
    - **IMPORTANT**: Re-run the SAME preservation test from task 2 (Preservation 4)
    - **EXPECTED OUTCOME**: Test PASSES (confirms files are untouched for non-Cancelled transitions)

- [x] 7. Fix C8 — Add submit lock to CheckoutPage

  - [x] 7.1 Add `submitting` state and disable button during submission
    - Add `const [submitting, setSubmitting] = useState(false)` to `CheckoutPage` component state
    - At the start of `handlePaymentSubmit`, add: `if (submitting) return; setSubmitting(true);`
    - Wrap the entire body of `handlePaymentSubmit` in a `try/finally` block; in the `finally` block, call `setSubmitting(false)`
    - Add `disabled={submitting}` to the submit button
    - Optionally update button label: `submitting ? 'Memproses...' : 'Buat Pesanan'`
    - _Bug_Condition: `isBugCondition({ caller: 'CheckoutPage.handleSubmit', concurrentCallCount > 1 })`_
    - _Expected_Behavior: `createOrderFromCart` called exactly once regardless of how many times the button is clicked_
    - _Preservation: when the button is clicked once and the request succeeds, exactly one order is created and user navigates to `/my-orders`_
    - _Requirements: 2.7, 3.5_

  - [x] 7.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Submit Lock Prevents Duplicate Orders
    - **IMPORTANT**: Re-run the SAME test from task 1 (C8 case) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms `createOrderFromCart` called exactly once on double-click)
    - _Requirements: 2.7_

  - [x] 7.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Single Checkout Submit Unchanged
    - **IMPORTANT**: Re-run the SAME preservation test from task 2 (Preservation 5)
    - **EXPECTED OUTCOME**: Test PASSES (confirms single-click success flow is unchanged)

- [x] 8. Fix W2 — Validate dataUrl before payment proof upload

  - [x] 8.1 Add pre-flight dataUrl validation in `MyOrdersPage.handlePaymentSubmit`
    - At the top of `handlePaymentSubmit`, after the `if (!selectedOrder || !result?.proof)` guard, add:
      ```js
      if (!proof.dataUrl) {
        setPaymentError('Tidak ada file yang dipilih. Silakan pilih file bukti pembayaran.');
        return;
      }
      ```
    - This prevents the empty-FormData request from ever being sent
    - _Bug_Condition: `isBugCondition({ caller: 'MyOrdersPage.handlePaymentSubmit', proof.dataUrl: '' | null, requestSent: true })`_
    - _Expected_Behavior: error message displayed; `attachPaymentProof` NOT called when `dataUrl` is absent or empty_
    - _Preservation: when `proof.dataUrl` is a valid base64 string, `attachPaymentProof` is called and upload proceeds normally_
    - _Requirements: 2.8, 3.2_

  - [x] 8.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - dataUrl Validated Before Upload
    - **IMPORTANT**: Re-run the SAME test from task 1 (W2 case) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms `attachPaymentProof` is not called with empty dataUrl)
    - _Requirements: 2.8_

  - [x] 8.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid dataUrl Proceeds Normally
    - **IMPORTANT**: Re-run the SAME preservation test from task 2 (Preservation 6)
    - **EXPECTED OUTCOME**: Test PASSES (confirms valid dataUrl still triggers upload)

- [x] 9. Fix W3 — Notify user on cart load failure

  - [x] 9.1 Add `cartLoadWarning` state and warning banner to `CartContext`
    - Add `const [cartLoadWarning, setCartLoadWarning] = useState('')` to `CartProvider` state
    - In the `catch` block of `loadCart`, set `setCartLoadWarning('Keranjang server tidak dapat dimuat. Menampilkan keranjang lokal.')` in addition to the existing `setItems([])`
    - Expose `cartLoadWarning` and a `clearCartLoadWarning` function through the context value
    - Only set the warning when `USE_BACKEND=true` and the user is logged in (localStorage fallback is expected behavior for guests)
    - _Bug_Condition: `isBugCondition({ caller: 'CartContext.loadCart', getCartThrew: true, userNotified: false })`_
    - _Expected_Behavior: `cartLoadWarning` state is set; non-blocking warning banner is displayed_
    - _Preservation: when `getCart` succeeds, no warning is shown and items are set from server response_
    - _Requirements: 2.9, 3.6_

  - [x] 9.2 Render warning banner in a suitable layout component
    - In `App.jsx` or a cart-aware layout, consume `cartLoadWarning` from `CartContext`
    - Render a dismissible warning banner when `cartLoadWarning` is non-empty
    - Call `clearCartLoadWarning` when the user dismisses the banner
    - _Requirements: 2.9_

  - [x] 9.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Cart Load Failure Notifies User
    - **IMPORTANT**: Re-run the SAME test from task 1 (W3 case) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms warning banner is visible after `getCart` throws)
    - _Requirements: 2.9_

  - [x] 9.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful Cart Load Unchanged
    - **IMPORTANT**: Re-run the SAME preservation test from task 2 (Preservation 7)
    - **EXPECTED OUTCOME**: Test PASSES (confirms no warning on successful cart load)

- [x] 10. Fix W6 — Wrap order creation in a DB transaction

  - [x] 10.1 Refactor `createOrder` to use an explicit connection with `BEGIN`/`COMMIT`/`ROLLBACK`
    - Import `pool` from `../db/connection.js` (already exported)
    - Acquire a connection: `const conn = await pool.getConnection()`
    - Call `await conn.beginTransaction()`
    - Replace all `query(...)` calls inside `createOrder` with `conn.execute(...)`
    - On success, call `await conn.commit()`
    - In a `catch` block, call `await conn.rollback(); throw err`
    - In a `finally` block, call `conn.release()`
    - _Bug_Condition: `isBugCondition({ caller: 'createOrder', itemInsertFailed: true, orderRowLeftInDB: true })`_
    - _Expected_Behavior: when any item insert fails, the entire transaction is rolled back and no order row exists in the DB_
    - _Preservation: when all item inserts succeed, the transaction commits and `createOrder` returns the complete order as before_
    - _Requirements: 2.11, 3.7_

  - [x] 10.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Order Creation is Atomic
    - **IMPORTANT**: Re-run the SAME test from task 1 (W6 case) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms no order row exists after a failed item insert)
    - _Requirements: 2.11_

  - [x] 10.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful Order Creation Unchanged
    - **IMPORTANT**: Re-run the SAME preservation test from task 2 (Preservation 8)
    - **EXPECTED OUTCOME**: Test PASSES (confirms successful creation still returns complete order)

- [x] 11. Fix W7 — Make order number generation atomic

  - [x] 11.1 Replace two-query sequence with `SELECT … FOR UPDATE` inside the transaction
    - Modify `generateOrderNumber` to accept the transaction `conn` as a parameter (passed from `createOrder`)
    - Replace the `UPDATE` + `SELECT` pair with:
      1. `conn.execute('SELECT last_seq FROM order_sequence WHERE id = 1 FOR UPDATE')` — acquires row lock
      2. `newSeq = row.last_seq + 1`
      3. `conn.execute('UPDATE order_sequence SET last_seq = ? WHERE id = 1', [newSeq])`
    - Because `generateOrderNumber` is called inside `createOrder`'s transaction, the `FOR UPDATE` lock is held until commit/rollback, guaranteeing uniqueness
    - Update the call site in `createOrder` to pass `conn`: `const orderNumber = await generateOrderNumber(conn)`
    - _Bug_Condition: `isBugCondition({ caller: 'generateOrderNumber', concurrentCallCount >= 2, duplicateOrderNumberProduced: true })`_
    - _Expected_Behavior: N concurrent calls produce N distinct order numbers_
    - _Preservation: under non-concurrent conditions, order numbers continue to use `GALA-YYYY/MM/DD-NNNNNN` format and increment monotonically_
    - _Requirements: 2.12, 3.8_

  - [x] 11.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Order Number Generation is Unique Under Concurrency
    - **IMPORTANT**: Re-run the SAME test from task 1 (W7 case) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms all N concurrent calls produce distinct order numbers)
    - _Requirements: 2.12_

  - [x] 11.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Sequential Order Numbers Unchanged
    - **IMPORTANT**: Re-run the SAME preservation test from task 2 (Preservation 9)
    - **EXPECTED OUTCOME**: Test PASSES (confirms format and monotonicity under non-concurrent conditions)

- [x] 12. Fix W8 — Add CHECK constraint to orders.status

  - [x] 12.1 Create migration `016_add_status_check_constraint.sql`
    - Create `server/src/db/migrations/016_add_status_check_constraint.sql`
    - Add `ALTER TABLE orders MODIFY COLUMN status VARCHAR(60) NOT NULL DEFAULT 'Waiting for Payment', ADD CONSTRAINT chk_orders_status CHECK (status IN ('Waiting for Payment', 'Payment Accepted', 'Waiting for Design Approval', 'Design Accepted', 'On Progress', 'Quality Checking', 'In Delivery', 'Finished', 'Cancelled'))`
    - Note: MySQL 8.0.16+ enforces CHECK constraints; if the environment uses MySQL 5.7, use ENUM type instead
    - The migration runner (`server/src/db/migrate.js`) will apply this automatically on next startup
    - _Bug_Condition: `isBugCondition({ caller: 'INSERT orders' | 'UPDATE orders SET status', statusValue NOT IN VALID_STATUSES, writeSucceeded: true })`_
    - _Expected_Behavior: any write with an invalid status value is rejected at the database level with a constraint violation error_
    - _Preservation: all nine valid status values can be written to `orders.status` without error_
    - _Requirements: 2.13, 3.9_

  - [x] 12.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Invalid Status Rejected at DB Level
    - **IMPORTANT**: Re-run the SAME test from task 1 (W8 case) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms `INSERT` with `status = 'invalid_status'` throws a constraint violation)
    - _Requirements: 2.13_

  - [x] 12.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Status Writes Unchanged
    - **IMPORTANT**: Re-run the SAME preservation test from task 2 (Preservation 10)
    - **EXPECTED OUTCOME**: Test PASSES (confirms all nine valid statuses are accepted without error)

- [x] 13. Checkpoint — Ensure all tests pass
  - Re-run the full test suite: `cd server && npx vitest --run`
  - Verify all 12 bug condition exploration tests now PASS (all bugs fixed)
  - Verify all 11 preservation tests still PASS (no regressions)
  - Verify all pre-existing tests in `server/src/tests/` continue to pass
  - Confirm the migration `016_add_status_check_constraint.sql` runs cleanly against the database
  - Ensure all tests pass; ask the user if questions arise.
