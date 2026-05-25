# Bugfix Requirements Document

## Introduction

This document captures the requirements for fixing a set of critical and warning issues identified during a data flow audit of the Gala Printing application. The issues span both the frontend (React) and backend (Node.js/MySQL) layers and fall into two categories:

**Critical issues** cause visible data loss, silent failures, or duplicate-submission vulnerabilities that directly affect customers and administrators:
- Orders displayed without their items (C1, C7)
- Payment proof upload failure not surfaced to the user (C2)
- Design file upload failures silently ignored with no user feedback (C5)
- Uploaded files never cleaned up when an order is cancelled or a proof is replaced (C6)
- Duplicate orders possible due to missing submit lock on checkout (C8)

**Warning issues** represent fragile patterns that can silently degrade data integrity or user experience:
- Payment proof upload relies on a fragile base64 conversion that can silently send empty FormData (W2)
- Cart load failure silently falls back to localStorage with no user notification (W3)
- Design upload failures silently ignored via `Promise.allSettled` (W4)
- Admin paginated order list missing items — same root cause as C7 (W5)
- Order creation not wrapped in a database transaction, leaving partial orders on item-insert failure (W6)
- Order number generation uses two non-atomic queries, risking sequence collisions under concurrency (W7)
- `orders.status` column is `VARCHAR` with no database-level constraint preventing invalid values (W8)

---

## Bug Analysis

### Current Behavior (Defect)

**C1 / C7 — Orders returned without items**

1.1 WHEN `listOrdersByCustomer` is called on the server THEN the system returns order rows without fetching `order_items`, so `order.items` is always an empty array and MyOrdersPage shows "—" for every product name

1.2 WHEN `listOrders` (admin paginated list) is called on the server THEN the system returns order rows without fetching `order_items`, so `order.items` is always `[]` and the admin orders table renders no product chips

**C2 — Payment proof upload failure not shown to user**

1.3 WHEN `attachPaymentProof` returns `{ ok: false }` in `MyOrdersPage.handlePaymentSubmit` THEN the system closes the modal and resets state without displaying any error message to the user

**C5 / W4 — Design file upload failures silently ignored**

1.4 WHEN one or more design file uploads fail inside `createOrderFromCart` THEN the system logs a `console.warn` and resolves via `Promise.allSettled`, the order is created with `design_file_path = NULL`, and no error or warning is shown to the user

**C6 — No file cleanup on order cancellation or proof replacement**

1.5 WHEN an order is cancelled THEN the system leaves any previously uploaded payment proof and design files on disk indefinitely without deleting them

1.6 WHEN a new payment proof is uploaded to replace an existing one THEN the system overwrites the database path but leaves the old file on disk indefinitely

**C8 — No submit lock on CheckoutPage**

1.7 WHEN the user clicks "Buat Pesanan" multiple times in quick succession THEN the system calls `handlePaymentSubmit` multiple times concurrently, potentially creating duplicate orders

**W2 — Payment proof relies on fragile dataUrl conversion**

1.8 WHEN `proof.dataUrl` is missing or empty in `MyOrdersPage.handlePaymentSubmit` THEN the system appends nothing to `FormData` and the upload silently sends an empty request body

**W3 — Cart load failure silently falls back to localStorage**

1.9 WHEN a network error occurs during `getCart` in backend mode THEN the system silently falls back to the localStorage cart with no indication to the user that their server-side cart could not be loaded

**W5 — Admin paginated list missing items**

1.10 WHEN `listOrders` returns paginated results THEN the system omits `order_items` from each row, so the admin table always shows empty product chips (same root cause as 1.2)

**W6 — Order creation not wrapped in a DB transaction**

1.11 WHEN `createOrder` inserts order items sequentially and one item insert fails THEN the system leaves the order row in the database without all its items and does not roll back the partial write

**W7 — Order number generation not fully atomic**

1.12 WHEN two concurrent requests both execute the `UPDATE order_sequence … last_seq + 1` and `SELECT last_seq` pair THEN the system may assign the same sequence number to both requests, producing duplicate order numbers

**W8 — `orders.status` is VARCHAR with no DB constraint**

1.13 WHEN any code path inserts or updates an order with an arbitrary string status THEN the system accepts the value without error, allowing invalid statuses to enter the database silently

---

### Expected Behavior (Correct)

**C1 / C7 — Orders returned with items**

2.1 WHEN `listOrdersByCustomer` is called on the server THEN the system SHALL fetch and attach the corresponding `order_items` rows to each order so that `order.items` is a populated array

2.2 WHEN `listOrders` (admin paginated list) is called on the server THEN the system SHALL fetch and attach the corresponding `order_items` rows to each order so that product chips render correctly in the admin table

**C2 — Payment proof upload failure shown to user**

2.3 WHEN `attachPaymentProof` returns `{ ok: false }` in `MyOrdersPage.handlePaymentSubmit` THEN the system SHALL display a visible error message to the user and keep the payment modal open (or re-openable) so the user can retry

**C5 / W4 — Design file upload failures surfaced to user**

2.4 WHEN one or more design file uploads fail inside `createOrderFromCart` THEN the system SHALL notify the user that the order was created but one or more design files could not be uploaded, prompting them to re-upload

**C6 — Old files cleaned up on cancellation or proof replacement**

2.5 WHEN an order is cancelled THEN the system SHALL delete any associated payment proof and design files from disk

2.6 WHEN a new payment proof is uploaded to replace an existing one THEN the system SHALL delete the old file from disk before (or immediately after) saving the new path

**C8 — Submit lock prevents duplicate orders**

2.7 WHEN the user clicks "Buat Pesanan" THEN the system SHALL disable the submit button and set a submitting state for the duration of the request, preventing concurrent duplicate submissions

**W2 — Payment proof upload validates file presence**

2.8 WHEN `proof.dataUrl` is missing or empty in `MyOrdersPage.handlePaymentSubmit` THEN the system SHALL display an error to the user indicating that no file was selected and SHALL NOT send an empty FormData request

**W3 — Cart load failure surfaced to user**

2.9 WHEN a network error occurs during `getCart` in backend mode THEN the system SHALL display a non-blocking warning to the user indicating that the cart could not be loaded from the server and is showing a locally cached version

**W5 — Admin paginated list includes items**

2.10 WHEN `listOrders` returns paginated results THEN the system SHALL include `order_items` for each order so that the admin table renders product chips correctly (same fix as 2.2)

**W6 — Order creation wrapped in a DB transaction**

2.11 WHEN `createOrder` inserts an order and its items THEN the system SHALL wrap all inserts in a single database transaction so that a failure on any item insert rolls back the entire order atomically

**W7 — Order number generation is atomic**

2.12 WHEN two concurrent requests generate order numbers THEN the system SHALL guarantee uniqueness by using a single atomic operation (e.g., `INSERT … ON DUPLICATE KEY UPDATE` with `LAST_INSERT_ID`, or a `SELECT … FOR UPDATE` lock) so that no two orders receive the same sequence number

**W8 — `orders.status` constrained at the database level**

2.13 WHEN any code path attempts to insert or update an order with a status value not in the allowed set THEN the system SHALL reject the write at the database level via an `ENUM` or `CHECK` constraint

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `getOrderById` is called THEN the system SHALL CONTINUE TO return the order with its full `items` and `history` arrays as it does today

3.2 WHEN a valid payment proof file is uploaded successfully THEN the system SHALL CONTINUE TO update `payment_proof_path` and return the updated order

3.3 WHEN design files are all uploaded successfully THEN the system SHALL CONTINUE TO create the order and attach design paths without any change to the success flow

3.4 WHEN an order is not cancelled and no proof is replaced THEN the system SHALL CONTINUE TO leave all uploaded files on disk untouched

3.5 WHEN the user submits the checkout form once and the request succeeds THEN the system SHALL CONTINUE TO create exactly one order and navigate to `/my-orders`

3.6 WHEN `getCart` succeeds in backend mode THEN the system SHALL CONTINUE TO return the server cart items without any fallback or warning

3.7 WHEN `createOrder` inserts all items successfully THEN the system SHALL CONTINUE TO commit the transaction and return the complete order as before

3.8 WHEN order numbers are generated under normal (non-concurrent) conditions THEN the system SHALL CONTINUE TO produce numbers in the `GALA-YYYY/MM/DD-NNNNNN` format

3.9 WHEN a valid status string (one of the defined order statuses) is written to `orders.status` THEN the system SHALL CONTINUE TO accept and persist the value without error

3.10 WHEN `listOrdersByCustomer` is called for a customer with no orders THEN the system SHALL CONTINUE TO return an empty array

3.11 WHEN the admin orders table is loaded with orders that have items THEN the system SHALL CONTINUE TO display all existing order metadata (order number, customer, status, subtotal, date) alongside the product chips
