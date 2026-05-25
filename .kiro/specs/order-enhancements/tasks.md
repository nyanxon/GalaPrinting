# Implementation Plan: Order Enhancements

## Overview

Five incremental enhancements to the Gala Printing order and chat system, implemented in dependency order: database migrations first, then backend services/controllers/routes, then frontend service layer, then UI components. All features support dual-mode (`USE_BACKEND=true` REST API + MySQL; `USE_BACKEND=false` localStorage).

Property-based tests live in `server/src/tests/orderEnhancements.property.test.js` and use the existing Vitest + fast-check setup.

---

## Tasks

- [x] 1. Database migrations (017–021)
  - Create `server/src/db/migrations/017_add_variant_prices_to_products.sql` — `ALTER TABLE products ADD COLUMN variant_prices JSON DEFAULT NULL AFTER materials`
  - Create `server/src/db/migrations/018_create_promo_codes.sql` — full `promo_codes` table with `id`, `code` (UNIQUE), `type` ENUM, `value`, `max_uses`, `usage_count`, `expires_at`, `created_at`
  - Create `server/src/db/migrations/019_add_promo_to_orders.sql` — `ALTER TABLE orders ADD COLUMN promo_code VARCHAR(50) DEFAULT NULL AFTER subtotal, ADD COLUMN discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER promo_code`
  - Create `server/src/db/migrations/020_add_cancellation_reason_to_orders.sql` — `ALTER TABLE orders ADD COLUMN cancellation_reason TEXT DEFAULT NULL AFTER admin_note`
  - Create `server/src/db/migrations/021_add_cancellation_reason_to_order_history.sql` — `ALTER TABLE order_history ADD COLUMN cancellation_reason TEXT DEFAULT NULL`
  - _Requirements: 1.6, 2.7, 5.5, 5.6_

- [x] 2. Feature 1 — Dynamic Pricing: backend
  - [x] 2.1 Update `server/src/services/products.service.js` — `createProduct` and `updateProduct` accept `variantPrices`; serialize to JSON for the `variant_prices` column; `getProductById` returns the column automatically once the migration runs
    - In `createProduct`: add `variant_prices` to the INSERT statement, `JSON.stringify(variantPrices) || null`
    - In `updateProduct`: add `variant_prices` to the allowed/json field mapping
    - _Requirements: 1.6_
  - [x] 2.2 Update `server/src/controllers/products.controller.js` — pass `variantPrices` from `req.body` through to the service in both `createProduct` and `updateProduct`
    - _Requirements: 1.6_

- [x] 3. Feature 1 — Dynamic Pricing: frontend helper and UI
  - [x] 3.1 Add `resolveVariantPrice(product, color, size, material)` helper to `src/services/productService.js`
    - Build variant key: `` `${color ?? ''}|${size ?? ''}|${material ?? ''}` ``
    - Parse `product.variant_prices` or `product.variantPrices` (handle JSON string or object)
    - Return `variantPrices[key]` if found, else `product.price`
    - Export the helper so it can be imported by `CatalogProductPage.jsx` and tested
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 3.2 Write property test — Property 1: Variant price lookup correctness
    - **Property 1: For any product with a non-empty `variantPrices` map and any key present in that map, `resolveVariantPrice` returns the exact stored price**
    - **Validates: Requirements 1.2, 1.3, 1.4**
    - Use `fc.record` to generate random color/size/material strings and prices; build the map; assert exact match
    - Tag: `// Feature: order-enhancements, Property 1: Variant price lookup correctness`
  - [x] 3.3 Write property test — Property 2: Variant price fallback to base price
    - **Property 2: For any product and any variant key NOT present in `variantPrices` (or when map is null/empty), `resolveVariantPrice` returns `product.price`**
    - **Validates: Requirements 1.5**
    - Tag: `// Feature: order-enhancements, Property 2: Variant price fallback to base price`
  - [x] 3.4 Write property test — Property 3: Variant prices round-trip persistence
    - **Property 3: Any valid `variantPrices` JSON object saved to a product and retrieved from the DB is deeply equal to what was saved**
    - **Validates: Requirements 1.6**
    - Use `fc.dictionary(fc.string(), fc.float({ min: 0, max: 1e6 }))` to generate maps; call `createProduct` then `getProductById`; deep-equal assert
    - Tag: `// Feature: order-enhancements, Property 3: Variant prices round-trip persistence`
  - [x] 3.5 Wire `resolveVariantPrice` into `src/components/pages/public/CatalogProductPage.jsx`
    - Import `resolveVariantPrice` from `productService.js`
    - Parse `product.variantPrices` from the raw product (handle JSON string from backend)
    - Add a `displayPrice` derived value: `resolveVariantPrice(product, selectedColor, selectedSize, selectedMaterial)`
    - Render `displayPrice` in the price display area (add a `<p className="product-info-price">` element if not present)
    - Pass `displayPrice` as `price` to `addItem(...)` instead of `product.price`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 4. Checkpoint — Feature 1 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Feature 2 — Promo Code Bar: backend
  - [x] 5.1 Create `server/src/services/promo.service.js`
    - `validatePromoCode(code, subtotal)` — query `promo_codes` by `code`; check `expires_at`; check `usage_count < max_uses`; compute `discountAmount` (percentage or fixed, clamped so `finalSubtotal >= 0`); return `{ ok, discount, discountAmount, finalSubtotal, promoCodeId }`
    - `incrementUsage(promoCodeId, conn)` — `UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = ?`; accepts an optional connection for use inside a transaction
    - _Requirements: 2.2, 2.3, 2.7, 2.8_
  - [x] 5.2 Write property test — Property 4: Promo code discount calculation correctness
    - **Property 4: For `type='percentage'` and value `v`, `discountAmount = subtotal * (v/100)`; for `type='fixed'`, `discountAmount = min(v, subtotal)` and `finalSubtotal = max(0, subtotal - v)`**
    - **Validates: Requirements 2.2**
    - Use `fc.record({ type: fc.constantFrom('percentage','fixed'), value: fc.float({ min: 0, max: 100 }), subtotal: fc.float({ min: 1, max: 1e7 }) })`
    - Tag: `// Feature: order-enhancements, Property 4: Promo code discount calculation correctness`
  - [x] 5.3 Write property test — Property 5: Invalid/expired promo code rejection
    - **Property 5: Any code that does not exist, is expired, or has `usage_count >= max_uses` returns `{ ok: false }` and applies no discount**
    - **Validates: Requirements 2.3, 2.8**
    - Tag: `// Feature: order-enhancements, Property 5: Invalid/expired promo code rejection`
  - [x] 5.4 Write property test — Property 6: Promo apply-remove round trip
    - **Property 6: Applying then removing a valid promo code restores the displayed subtotal to its original value with no discount remaining**
    - **Validates: Requirements 2.5**
    - Tag: `// Feature: order-enhancements, Property 6: Promo apply-remove round trip`
  - [x] 5.5 Create `server/src/controllers/promo.controller.js`
    - `validatePromoCode` handler: reads `{ code, subtotal }` from `req.body`; validates inputs; calls `svc.validatePromoCode`; returns `{ ok, discount, discountAmount, finalSubtotal }` or 422/404 on failure
    - _Requirements: 2.2, 2.3, 2.9_
  - [x] 5.6 Create `server/src/routes/promo.routes.js` and register in `server/src/app.js`
    - `POST /api/promo/validate` — `authenticate` + `requireRole('customer')` + `ctrl.validatePromoCode`
    - Mount at `/api/promo` in `app.js`
    - _Requirements: 2.9_
  - [x] 5.7 Update `server/src/services/orders.service.js` and `server/src/controllers/orders.controller.js` to persist promo data
    - `createOrder` service: accept `promoCode` and `discountAmount`; include them in the INSERT; call `incrementUsage` inside the same transaction
    - `createOrder` controller: read `promoCode` and `discountAmount` from `req.body`; pass to service
    - _Requirements: 2.6_
  - [x] 5.8 Write property test — Property 7: Promo code persisted on order
    - **Property 7: Any order created with a valid promo code returns `promoCode` equal to the applied code and `discountAmount` equal to the computed discount**
    - **Validates: Requirements 2.6**
    - Tag: `// Feature: order-enhancements, Property 7: Promo code persisted on order`

- [x] 6. Feature 2 — Promo Code Bar: frontend
  - [x] 6.1 Update `src/services/orderService.js`
    - `mapOrder` — add `cancellationReason`, `promoCode`, `discountAmount` fields
    - `createOrderFromCart` — accept `promoCode` and `discountAmount`; pass to API body (backend mode) and to `createOrderFromCartLocal` (localStorage mode)
    - `updateOrderStatus` — accept `cancellationReason`; pass in PATCH body (backend mode) and store in localStorage order (local mode)
    - _Requirements: 2.6, 5.4, 5.5_
  - [x] 6.2 Add promo code UI to `src/components/pages/public/CheckoutPage.jsx`
    - New state: `promoCode`, `promoDiscount` (`{ discountAmount, finalSubtotal }` or null), `promoError`, `promoApplied`
    - New `handleApplyPromo` async function: calls `POST /api/promo/validate` (backend) or local lookup (localStorage mode); on success sets `promoDiscount`; on failure sets `promoError`
    - New `handleRemovePromo` function: clears promo state, restores original subtotal display
    - Render promo input + "Terapkan" button in the summary section; show discount line and "Hapus" button when applied; show `promoError` when invalid
    - Pass `promoCode` and `discountAmount` to `createOrderFromCart` in `handlePaymentSubmit`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 7. Checkpoint — Feature 2 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Feature 3 — Chat Close/Delete: backend
  - [x] 8.1 Add `deleteConversation(conversationId)` to `server/src/services/chat.service.js`
    - Fetch all messages with `type = 'file'` for the conversation; collect `file_path` values
    - `DELETE FROM conversations WHERE id = ?` (cascade deletes messages automatically)
    - Return `{ deletedFilePaths: string[] }`
    - _Requirements: 3.3, 3.4_
  - [x] 8.2 Write property test — Property 8: Conversation deletion removes all messages
    - **Property 8: For any conversation with any number of messages, deleting it results in zero messages remaining with that `conversation_id`**
    - **Validates: Requirements 3.3**
    - Tag: `// Feature: order-enhancements, Property 8: Conversation deletion removes all messages`
  - [x] 8.3 Write property test — Property 9: Conversation deletion cleans up files and localStorage
    - **Property 9: After deletion, all `file_path` values referenced by file messages no longer exist on the server filesystem, and the conversation no longer appears in `gala.chats` localStorage**
    - **Validates: Requirements 3.4, 3.5**
    - Tag: `// Feature: order-enhancements, Property 9: Conversation deletion cleans up files and localStorage`
  - [x] 8.4 Add `deleteConversation` handler to `server/src/controllers/chat.controller.js`
    - Role guard: `admin` only (return 403 for any other role)
    - Call `svc.deleteConversation(id)`; call `StorageService.delete(path)` for each returned file path
    - Return `{ ok: true }` on success; return 404 if conversation not found (treat as success on frontend)
    - _Requirements: 3.3, 3.4, 3.7_
  - [x] 8.5 Write property test — Property 10: Only admin can delete conversations
    - **Property 10: For any role that is not `admin`, `DELETE /api/conversations/:id` returns HTTP 403 and does not delete the conversation**
    - **Validates: Requirements 3.7**
    - Use `fc.constantFrom('customer','cashier','cs','qc','owner','operational')`
    - Tag: `// Feature: order-enhancements, Property 10: Only admin can delete conversations`
  - [x] 8.6 Register `DELETE /:id` route in `server/src/routes/chat.routes.js`
    - `router.delete('/:id', authenticate, requireRole('admin'), ctrl.deleteConversation)`
    - _Requirements: 3.7_

- [x] 9. Feature 3 — Chat Close/Delete: frontend
  - [x] 9.1 Add `deleteConversation(conversationId)` to `src/services/chatService.js`
    - `USE_BACKEND=true`: `DELETE /api/conversations/:id`; return `{ ok: true }` on 200 or 404; return `{ ok: false, message }` on other errors
    - `USE_BACKEND=false`: filter out the conversation and all its messages from `data.conversations` and `data.messages`; call `saveLocal(data)`; return `{ ok: true }`
    - _Requirements: 3.3, 3.5_
  - [x] 9.2 Add "Tutup Chat" button and confirmation flow to `src/components/pages/admin/sections/ChatsSection.jsx`
    - Import `deleteConversation` from `chatService.js`
    - Add "Tutup Chat" button in `chat-main-header` (visible only when `activeConv` is set)
    - On click: show `window.confirm` dialog explaining permanent deletion
    - On confirm: call `deleteConversation(activeConvId)`; on success reload conversation list and clear `activeConvId`; on failure show `setSendError` with the error message
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8_

- [x] 10. Checkpoint — Feature 3 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Feature 4 — Order Source Label
  - [x] 11.1 Add source badge to `src/components/shared/OrderDetailModal.jsx`
    - In the header section, after the `<code className="odm-order-num">` element, add:
      ```jsx
      {order.source === 'custom'  && <span className="odm-source-badge odm-source-badge--custom">Custom Order</span>}
      {order.source === 'offline' && <span className="odm-source-badge odm-source-badge--offline">Offline Order</span>}
      ```
    - No badge rendered when `source === 'online'` or source is absent/undefined
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 11.2 Write property test — Property 11: Order source badge rendering
    - **Property 11: `OrderDetailModal` renders "Custom Order" badge iff `source === 'custom'`, "Offline Order" badge iff `source === 'offline'`, and no source badge for `source === 'online'` or absent**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Use `fc.constantFrom('online','offline','custom',undefined)` to generate source values; render the modal with `@testing-library/react` or assert on the rendered JSX output
    - Tag: `// Feature: order-enhancements, Property 11: Order source badge rendering`

- [x] 12. Feature 5 — Order Cancellation: backend
  - [x] 12.1 Update `TRANSITIONS` in `server/src/services/orders.service.js` — populate `owner` with cancellation rights on all non-terminal statuses
    - ```js
      owner: {
        'Waiting for Payment':         ['Cancelled'],
        'Payment Accepted':            ['Cancelled'],
        'Waiting for Design Approval': ['Cancelled'],
        'Design Accepted':             ['Cancelled'],
        'On Progress':                 ['Cancelled'],
        'Quality Checking':            ['Cancelled'],
        'In Delivery':                 ['Cancelled'],
      }
      ```
    - _Requirements: 5.1, 5.8_
  - [x] 12.2 Write property test — Property 14: Cancellation allowed on all non-terminal statuses
    - **Property 14: For any order status that is not `Finished` or `Cancelled`, `getAllowedNextStatuses(status, 'admin')` and `getAllowedNextStatuses(status, 'owner')` both include `'Cancelled'`; for `Finished` and `Cancelled` they do not**
    - **Validates: Requirements 5.8**
    - Use `fc.constantFrom(...ALL_STATUSES)` where `ALL_STATUSES` is the full 9-status list
    - Tag: `// Feature: order-enhancements, Property 14: Cancellation allowed on all non-terminal statuses`
  - [x] 12.3 Update `updateOrderStatus` in `server/src/services/orders.service.js` to accept and persist `cancellationReason`
    - Accept optional `cancellationReason` parameter
    - When `newStatus === 'Cancelled'`: `UPDATE orders SET status = ?, cancellation_reason = ? WHERE id = ?`
    - Pass `cancellationReason` to `insertHistoryEntry` (update that function signature to accept and store it in `order_history.cancellation_reason`)
    - _Requirements: 5.4, 5.5, 5.6_
  - [x] 12.4 Write property test — Property 12: Empty cancellation reason is rejected
    - **Property 12: Any string composed entirely of whitespace (including empty string) submitted as `cancellationReason` is rejected with HTTP 422 and the order status remains unchanged**
    - **Validates: Requirements 5.3**
    - Use `fc.string().filter(s => s.trim() === '')` to generate blank strings
    - Tag: `// Feature: order-enhancements, Property 12: Empty cancellation reason is rejected`
  - [x] 12.5 Write property test — Property 13: Cancellation stores reason and updates status
    - **Property 13: For any order in a cancellable status and any non-empty `cancellationReason`, confirming cancellation sets `order.status = 'Cancelled'` and `order.cancellationReason` equal to the provided reason**
    - **Validates: Requirements 5.4, 5.5, 5.7**
    - Use `fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)` for reasons; use `fc.constantFrom(...CANCELLABLE_STATUSES)` for statuses
    - Tag: `// Feature: order-enhancements, Property 13: Cancellation stores reason and updates status`
  - [x] 12.6 Update `updateOrderStatus` in `server/src/controllers/orders.controller.js`
    - Read `cancellationReason` from `req.body`
    - If `newStatus === 'Cancelled'` and `!cancellationReason?.trim()`, return 422 `{ ok: false, message: 'Alasan pembatalan wajib diisi.' }`
    - Pass `cancellationReason` to `svc.updateOrderStatus`
    - _Requirements: 5.3, 5.4_

- [x] 13. Feature 5 — Order Cancellation: frontend
  - [x] 13.1 Update `src/services/orderService.js` — `updateOrderStatus` passes `cancellationReason` in the PATCH body; `mapOrder` maps `cancellation_reason` → `cancellationReason`
    - Backend mode: `api.patch('/api/orders/:id/status', { newStatus, cancellationReason })`
    - Local mode: store `cancellationReason` on the order object when `newStatus === 'Cancelled'`
    - `mapOrder`: add `cancellationReason: row.cancellation_reason ?? row.cancellationReason ?? null`
    - _Requirements: 5.4, 5.5_
  - [x] 13.2 Add cancellation reason dialog to `src/components/pages/admin/sections/OrdersSection.jsx`
    - When the status dropdown changes to `'Cancelled'`, intercept the change: show an inline modal/dialog with a `<textarea>` for the reason instead of immediately calling `handleStatusChange`
    - New state: `cancelDialogOpen`, `cancelTargetOrderId`, `cancelReason`, `cancelReasonErr`
    - "Konfirmasi" button: validate `cancelReason.trim()` is non-empty (show `cancelReasonErr` if blank); call `updateOrderStatus(orderId, 'Cancelled', actorRole, cancelReason)`; close dialog on success
    - "Batal" button: close dialog, reset state, do not change order status
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 13.3 Display `cancellationReason` in `src/components/shared/OrderDetailModal.jsx`
    - After the "Catatan Admin" section, add a conditional section:
      ```jsx
      {order.status === 'Cancelled' && (order.cancellationReason || order.cancellation_reason) && (
        <div className="odm-section">
          <div className="odm-section-title">❌ Alasan Pembatalan</div>
          <div className="odm-note-box">{order.cancellationReason || order.cancellation_reason}</div>
        </div>
      )}
      ```
    - _Requirements: 5.7_

- [x] 14. Final checkpoint — All features complete
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests go in `server/src/tests/orderEnhancements.property.test.js` with minimum 100 iterations (`numRuns: 100`)
- Migrations must be run in order (017 → 021) before starting backend tasks
- The `owner` role cancellation (task 12.1) also requires updating the existing `orderTransition.property.test.js` test's `ALLOWED` map to reflect the new `owner` transitions
- `mapOrder` in `src/services/orderService.js` is updated once in task 6.1 to cover both promo and cancellation fields — do not split across tasks
- The `resolveVariantPrice` helper (task 3.1) is a pure function and can be tested without a DB connection
