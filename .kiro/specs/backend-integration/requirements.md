# Requirements Document

## Introduction

This document defines the requirements for integrating a Node.js/Express backend into the Gala Printing web application. The frontend is a React SPA (Vite + React Router v6) that currently stores all data in browser localStorage. The backend will replace localStorage as the authoritative data store, introduce JWT-based authentication, real-time communication via Socket.io, and disk-based file storage — while preserving a safe migration path by exporting all existing localStorage data before any service is switched over.

The backend will run on XAMPP with MySQL 8.0.46 for local development and must be configurable for production deployment without code changes.

---

## Glossary

- **API_Server**: The Node.js/Express HTTP server that exposes the REST API.
- **Auth_Service**: The backend module responsible for authentication and session management.
- **JWT**: JSON Web Token — a signed, stateless token used to authenticate API requests.
- **Access_Token**: A short-lived JWT (15 minutes) sent in the `Authorization: Bearer` header.
- **Refresh_Token**: A long-lived JWT (7 days) stored in an `HttpOnly` cookie, used to obtain new Access_Tokens.
- **Socket_Server**: The Socket.io server instance attached to the same HTTP server as the API_Server.
- **Storage_Service**: The backend module that manages file persistence on local disk via multer.
- **Migration_Tool**: The frontend utility that exports all localStorage data to a JSON file before backend migration.
- **Order**: A customer purchase record with a status that progresses through a defined workflow.
- **Conversation**: A 1-to-1 chat thread between one customer and the admin/CS team.
- **Message**: A single chat entry (text or file attachment) within a Conversation.
- **Role**: One of eight user roles — `customer`, `admin`, `owner`, `cashier`, `cs`, `operational`, `qc`, `offline`.
- **Staff**: Any user whose Role is not `customer`.
- **Design_File**: A file uploaded by a customer as part of an order item (PDF, PNG, JPG, ZIP).
- **Payment_Proof**: An image or PDF uploaded by a customer to confirm payment.
- **Chat_Attachment**: A file sent within a Conversation Message.
- **Upload_Directory**: The local filesystem path where the Storage_Service writes uploaded files.
- **Environment_Config**: The `.env` file that controls runtime behaviour (database credentials, JWT secrets, ports, upload paths, environment name).
- **localStorage_Backup**: A JSON export of all `gala.*` localStorage keys produced by the Migration_Tool.

---

## Requirements

### Requirement 1: localStorage Data Export (Migration Safety)

**User Story:** As an admin, I want to export all existing localStorage data to a JSON file before migrating to the backend, so that no customer, order, product, chat, or review data is lost during the transition.

#### Acceptance Criteria

1. THE Migration_Tool SHALL export all localStorage keys matching the pattern `gala.*` into a single JSON object keyed by localStorage key name.
2. WHEN the admin triggers the export, THE Migration_Tool SHALL prompt the browser to download the export as a file named `gala-backup-{YYYY-MM-DD}.json`.
3. THE Migration_Tool SHALL include the following keys in the export when they are present: `gala.users`, `gala.session`, `gala.products`, `gala.orders`, `gala.chats`, `gala.reviews`, `gala.analytics.visits`, `gala.analytics.productViews`.
4. WHEN a localStorage key is absent or empty, THE Migration_Tool SHALL omit that key from the export without producing an error.
5. THE Migration_Tool SHALL display the count of exported keys and the total serialized byte size to the admin before the download begins.
6. IF the browser blocks the download, THEN THE Migration_Tool SHALL display an error message instructing the admin to allow downloads from the site.

---

### Requirement 2: Environment Configuration

**User Story:** As a developer, I want all environment-specific values (database credentials, secrets, ports, upload paths) to be read from a `.env` file, so that the same codebase runs in local development and production without code changes.

#### Acceptance Criteria

1. THE API_Server SHALL read all configuration values from environment variables at startup and SHALL NOT hard-code any credential, secret, or host address.
2. THE API_Server SHALL support the following environment variables: `NODE_ENV`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `UPLOAD_DIR`, `CLIENT_ORIGIN`, `BCRYPT_ROUNDS`.
3. WHEN `NODE_ENV` is `development`, THE API_Server SHALL enable verbose request logging and detailed error responses.
4. WHEN `NODE_ENV` is `production`, THE API_Server SHALL suppress stack traces from error responses and enable HTTP security headers via helmet.
5. IF a required environment variable (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) is absent at startup, THEN THE API_Server SHALL log a descriptive error message and exit with a non-zero code.
6. THE API_Server SHALL ship a `.env.example` file listing every supported variable with placeholder values and inline comments.

---

### Requirement 3: Database Schema

**User Story:** As a developer, I want a well-structured MySQL 8.0.46 schema that mirrors the existing localStorage data model, so that all existing data can be imported and the application behaves identically after migration.

#### Acceptance Criteria

1. THE API_Server SHALL create and maintain the following tables: `users`, `products`, `categories`, `orders`, `order_items`, `order_history`, `cart_items`, `conversations`, `messages`, `reviews`, `analytics_visits`, `analytics_product_views`.
2. THE API_Server SHALL ship SQL migration files that create all tables in the correct dependency order and are idempotent (safe to run multiple times).
3. THE `users` table SHALL store: `id` (UUID), `role` (ENUM of the 8 roles), `name`, `email` (unique), `phone`, `password_hash`, `created_at`, `updated_at`.
4. THE `orders` table SHALL store: `id` (UUID), `order_number` (unique), `order_type` (`standard` | `custom`), `source` (`online` | `offline` | `custom`), `customer_id` (FK → users, nullable for guest orders), `customer_name`, `customer_phone`, `customer_address`, `status`, `subtotal`, `admin_note`, `tracking_number`, `courier_name`, `payment_proof_path`, `created_at`, `updated_at`.
5. THE `messages` table SHALL store: `id` (UUID), `conversation_id` (FK → conversations), `sender_id` (FK → users), `sender_role`, `type` (`text` | `file`), `content`, `file_path`, `file_name`, `file_size`, `mime_type`, `read_at`, `created_at`.
6. WHEN a foreign key constraint would be violated by a delete operation, THE API_Server SHALL reject the operation and return HTTP 409 with a descriptive error message.

---

### Requirement 4: JWT Authentication

**User Story:** As a user, I want to log in with my email and password and receive a JWT, so that my identity is verified on every API request without storing credentials in the browser.

#### Acceptance Criteria

1. WHEN a user submits valid credentials to `POST /api/auth/login`, THE Auth_Service SHALL return an Access_Token in the JSON response body and set a Refresh_Token in an `HttpOnly`, `SameSite=Strict` cookie.
2. WHEN a user submits invalid credentials to `POST /api/auth/login`, THE Auth_Service SHALL return HTTP 401 with the message "Email atau password salah." and SHALL NOT reveal which field was incorrect.
3. THE Auth_Service SHALL hash all passwords using bcrypt with a configurable number of rounds (default 12, read from `BCRYPT_ROUNDS`).
4. WHEN a client sends a valid Access_Token in the `Authorization: Bearer` header, THE API_Server SHALL attach the decoded user payload to the request context and proceed.
5. WHEN a client sends an expired or invalid Access_Token, THE API_Server SHALL return HTTP 401 with the message "Token tidak valid atau sudah kedaluwarsa."
6. WHEN a client calls `POST /api/auth/refresh` with a valid Refresh_Token cookie, THE Auth_Service SHALL issue a new Access_Token and rotate the Refresh_Token (invalidate old, issue new).
7. WHEN a client calls `POST /api/auth/logout`, THE Auth_Service SHALL invalidate the Refresh_Token and clear the cookie.
8. WHEN a new customer registers via `POST /api/auth/register`, THE Auth_Service SHALL validate that the email is not already registered, hash the password, persist the user, and return an Access_Token and Refresh_Token as described in criterion 1.
9. THE Auth_Service SHALL expose `GET /api/auth/me` which returns the authenticated user's profile (excluding `password_hash`) when a valid Access_Token is provided.
10. IF a Refresh_Token has been used more than once (token reuse detected), THEN THE Auth_Service SHALL invalidate the entire refresh token family and return HTTP 401.

---

### Requirement 5: Role-Based Access Control

**User Story:** As a system administrator, I want every API endpoint to enforce role-based access control, so that staff members can only perform actions permitted by their role.

#### Acceptance Criteria

1. THE API_Server SHALL define the following role hierarchy for access control: `owner` and `admin` have access to all protected endpoints; `cashier`, `cs`, `operational`, `qc`, and `offline` have access only to endpoints relevant to their workflow stage; `customer` has access only to their own data.
2. WHEN a request reaches a protected endpoint without a valid Access_Token, THE API_Server SHALL return HTTP 401.
3. WHEN a request reaches a protected endpoint with a valid Access_Token but an insufficient role, THE API_Server SHALL return HTTP 403 with the message "Akses ditolak."
4. THE API_Server SHALL enforce order status transition rules: `cashier` may advance orders from "Waiting for Payment" to "Payment Accepted"; `cs` may advance from "Payment Accepted" to "Waiting for Design Approval" and from "Waiting for Design Approval" to "Design Accepted"; `operational` may advance from "Design Accepted" to "On Progress"; `qc` may advance from "On Progress" to "Quality Checking", from "Quality Checking" to "In Delivery", and from "In Delivery" to "Finished".
5. WHEN a staff member attempts an order status transition not permitted by their role, THE API_Server SHALL return HTTP 403 with a message identifying the disallowed transition.
6. THE `customer` role SHALL be permitted to read only their own orders, their own conversation and messages, and their own cart.

---

### Requirement 6: Product and Category API

**User Story:** As a customer, I want to browse products with pagination and search, and as an admin I want to manage the product catalogue, so that the product listing is always accurate and performant.

#### Acceptance Criteria

1. THE API_Server SHALL expose `GET /api/products` which returns a paginated list of products supporting `page`, `limit`, `category`, and `search` query parameters.
2. WHEN `search` is provided, THE API_Server SHALL perform a case-insensitive partial match against the product `name` field.
3. WHEN `category` is provided, THE API_Server SHALL filter products to those belonging to the specified category.
4. THE API_Server SHALL expose `GET /api/products/:id` which returns a single product by UUID or HTTP 404 if not found.
5. THE API_Server SHALL expose `POST /api/products`, `PUT /api/products/:id`, and `DELETE /api/products/:id` restricted to the `admin` role.
6. THE API_Server SHALL expose `GET /api/categories` which returns all category names as a flat array.
7. THE API_Server SHALL expose `POST /api/categories` and `DELETE /api/categories/:id` restricted to the `admin` role.
8. WHEN a product is deleted and it has associated order items, THE API_Server SHALL retain the order item records and set the product reference to null rather than cascading the delete.
9. THE API_Server SHALL return paginated responses in the format `{ items, total, page, limit, totalPages }` consistent with the existing `listProductsPaginated` contract.

---

### Requirement 7: Order API

**User Story:** As a customer, I want to place orders and track their status, and as staff I want to manage the order workflow, so that every order moves through the correct stages with a full audit trail.

#### Acceptance Criteria

1. THE API_Server SHALL expose `POST /api/orders` which creates a new standard order from cart items and customer information, returning the created order with its generated `orderNumber`.
2. THE API_Server SHALL expose `GET /api/orders/track` which accepts `orderNumber` and `phone` query parameters and returns the matching order or HTTP 404.
3. THE API_Server SHALL expose `GET /api/orders/my` (authenticated customer) which returns all orders belonging to the authenticated user, sorted newest first.
4. THE API_Server SHALL expose `GET /api/orders` (admin/staff) which returns a paginated, filterable list of all orders supporting `page`, `limit`, and `status` query parameters.
5. THE API_Server SHALL expose `PATCH /api/orders/:id/status` which advances an order to the next status, enforcing the role-based transition rules defined in Requirement 5.
6. WHEN an order status is changed, THE API_Server SHALL append an entry to the `order_history` table recording the previous status, new status, actor user ID, and timestamp.
7. THE API_Server SHALL expose `POST /api/orders/:id/payment-proof` which accepts a multipart file upload and stores the file via the Storage_Service, recording the file path on the order.
8. THE API_Server SHALL expose `PATCH /api/orders/:id/tracking` (restricted to `qc` and `admin`) which sets the `tracking_number` and `courier_name` on an order and automatically advances the status to "In Delivery" if the current status is "Quality Checking".
9. THE API_Server SHALL expose `PATCH /api/orders/:id/note` (restricted to `admin` and `cs`) which updates the `admin_note` field on an order.
10. THE API_Server SHALL expose `POST /api/orders/custom` (restricted to `cs` and `admin`) which creates a custom order starting at "Waiting for Design Approval".
11. THE API_Server SHALL expose `POST /api/orders/offline` (restricted to `offline` and `admin`) which creates an offline walk-in order.
12. WHEN an order is created or its status changes, THE Socket_Server SHALL emit a `order:updated` event to the relevant customer's socket room and to the `staff` room.

---

### Requirement 8: Cart API

**User Story:** As a customer, I want my cart to sync across devices when I am logged in, so that I can add items on one device and check out on another.

#### Acceptance Criteria

1. THE API_Server SHALL expose `GET /api/cart` (authenticated customer) which returns the current cart items for the authenticated user.
2. THE API_Server SHALL expose `POST /api/cart/items` which adds an item to the authenticated user's server-side cart.
3. THE API_Server SHALL expose `PATCH /api/cart/items/:itemId` which updates the quantity of a cart item belonging to the authenticated user.
4. THE API_Server SHALL expose `DELETE /api/cart/items/:itemId` which removes a cart item belonging to the authenticated user.
5. THE API_Server SHALL expose `DELETE /api/cart` which clears all items from the authenticated user's cart.
6. WHEN a user logs in and their server-side cart is empty, THE API_Server SHALL accept a `POST /api/cart/sync` request containing a localStorage cart payload and merge it into the server-side cart.
7. WHERE the user is not authenticated, THE Frontend SHALL fall back to localStorage cart storage without calling the Cart API.

---

### Requirement 9: Chat API and Real-Time Messaging

**User Story:** As a customer, I want to send and receive messages in real time, and as a CS agent I want to see all conversations and reply instantly, so that support interactions feel like a live chat.

#### Acceptance Criteria

1. THE API_Server SHALL expose `GET /api/conversations` (restricted to `admin`, `owner`, `cs`) which returns all conversations enriched with `lastMessage` and `unreadCount`, sorted by `lastAt` descending.
2. THE API_Server SHALL expose `GET /api/conversations/:id/messages` which returns all messages for a conversation sorted oldest to newest, accessible to the conversation's customer and to `admin`/`cs`/`owner`.
3. THE API_Server SHALL expose `POST /api/conversations/:id/messages` which persists a new text message and emits a `message:new` Socket.io event to the conversation room.
4. THE API_Server SHALL expose `POST /api/conversations/:id/messages/file` which accepts a multipart file upload, stores it via the Storage_Service, persists the message record, and emits a `message:new` event.
5. WHEN a customer connects to the Socket_Server with a valid Access_Token, THE Socket_Server SHALL join the client to a room named `conversation:{conversationId}`.
6. WHEN a staff member connects to the Socket_Server with a valid Access_Token and a staff role, THE Socket_Server SHALL join the client to the `staff` room.
7. WHEN a new message is saved, THE Socket_Server SHALL emit `message:new` to the relevant `conversation:{conversationId}` room and to the `staff` room.
8. THE API_Server SHALL expose `PATCH /api/conversations/:id/read` which marks all unread customer messages in the conversation as read and emits a `conversation:read` event.
9. THE API_Server SHALL enforce the file validation rules for Chat_Attachments: allowed MIME types are `application/pdf`, `image/png`, `image/jpeg`, `application/zip`; maximum file size is 5 MB.
10. WHEN a Socket.io connection is established without a valid Access_Token, THE Socket_Server SHALL reject the connection with an `authentication_error` event.

---

### Requirement 10: Review API

**User Story:** As a customer, I want to leave a review for a product, and as an admin I want to moderate reviews, so that the product catalogue reflects genuine customer feedback.

#### Acceptance Criteria

1. THE API_Server SHALL expose `GET /api/reviews` which returns all reviews, optionally filtered by `productId` query parameter.
2. THE API_Server SHALL expose `POST /api/reviews` (authenticated `customer`) which creates a review with `productId`, `rating` (integer 1–5), and `comment`.
3. WHEN a review is submitted with a `rating` outside the range 1–5, THE API_Server SHALL return HTTP 422 with a descriptive validation error.
4. THE API_Server SHALL expose `DELETE /api/reviews/:id` restricted to `admin` and the review's author.
5. WHEN a customer attempts to delete a review they did not author, THE API_Server SHALL return HTTP 403.

---

### Requirement 11: File Upload and Storage

**User Story:** As a developer, I want all uploaded files to be stored on local disk via multer with a clear directory structure, so that files are accessible immediately and can be migrated to cloud storage later without changing the API contract.

#### Acceptance Criteria

1. THE Storage_Service SHALL store uploaded files under the `UPLOAD_DIR` path configured in the Environment_Config, organised into subdirectories: `uploads/designs/`, `uploads/payments/`, `uploads/chat/`.
2. THE Storage_Service SHALL generate a unique filename for each upload using the pattern `{timestamp}-{uuid}.{ext}` to prevent collisions and path traversal.
3. THE API_Server SHALL expose uploaded files at `GET /uploads/{subdir}/{filename}` as static assets.
4. WHEN a file upload exceeds the size limit for its type (Design_File: 20 MB; Payment_Proof: 10 MB; Chat_Attachment: 5 MB), THE Storage_Service SHALL reject the upload with HTTP 413 and a descriptive error message.
5. WHEN a file upload has a MIME type not in the allowed list for its endpoint, THE Storage_Service SHALL reject the upload with HTTP 415.
6. THE Storage_Service SHALL be designed so that replacing the local disk write with an S3 or Cloudinary call requires changes only within the Storage_Service module and does not affect any API route handler.
7. IF the `UPLOAD_DIR` path does not exist at startup, THEN THE API_Server SHALL create it and all required subdirectories automatically.

---

### Requirement 12: Analytics API

**User Story:** As an owner, I want to view revenue metrics, visit statistics, and best-seller data via the dashboard, so that I can make informed business decisions.

#### Acceptance Criteria

1. THE API_Server SHALL expose `GET /api/analytics/revenue` (restricted to `owner` and `admin`) which returns `totalRevenue`, `thisMonth`, `thisYear`, and `byDay` (last 30 days) derived from completed and in-progress orders.
2. THE API_Server SHALL expose `GET /api/analytics/monthly` (restricted to `owner` and `admin`) which returns revenue and order count for each of the past 12 months.
3. THE API_Server SHALL expose `GET /api/analytics/visits` (restricted to `owner` and `admin`) which returns daily visit counts for the last 30 days.
4. THE API_Server SHALL expose `GET /api/analytics/best-sellers` (restricted to `owner` and `admin`) which returns the top 5 products by quantity sold, including `productId`, `name`, `category`, `qty`, and `revenue`.
5. THE API_Server SHALL expose `POST /api/analytics/visit` (unauthenticated) which records a page visit for the current UTC date.
6. THE API_Server SHALL expose `POST /api/analytics/product-view` (unauthenticated) which records a product view for the given `productId`.
7. WHEN `POST /api/analytics/visit` or `POST /api/analytics/product-view` is called more than 60 times per minute from the same IP address, THE API_Server SHALL return HTTP 429 and discard the excess requests.

---

### Requirement 13: User and Staff Management API

**User Story:** As an admin, I want to list customers and manage staff accounts, so that I can onboard new staff and review the customer base.

#### Acceptance Criteria

1. THE API_Server SHALL expose `GET /api/users/customers` (restricted to `admin` and `cs`) which returns a paginated list of users with `role = customer`.
2. THE API_Server SHALL expose `GET /api/users/staff` (restricted to `admin` and `owner`) which returns all users with a non-customer role.
3. THE API_Server SHALL expose `POST /api/users/staff` (restricted to `admin`) which creates a new staff account with a specified role, name, email, and temporary password.
4. THE API_Server SHALL expose `PATCH /api/users/:id/role` (restricted to `admin`) which updates the role of an existing user.
5. WHEN an admin attempts to change their own role, THE API_Server SHALL return HTTP 403 to prevent accidental self-lockout.
6. THE API_Server SHALL expose `DELETE /api/users/:id` (restricted to `admin`) which soft-deletes a user by setting a `deleted_at` timestamp rather than removing the row.
7. WHEN a soft-deleted user attempts to log in, THE Auth_Service SHALL return HTTP 401 with the message "Akun tidak aktif."

---

### Requirement 14: Real-Time Order Status Notifications

**User Story:** As a customer, I want to receive a real-time notification when my order status changes, and as a staff member I want to see a live badge count of pending actions, so that no one needs to refresh the page to stay informed.

#### Acceptance Criteria

1. WHEN an order status changes, THE Socket_Server SHALL emit an `order:status_changed` event containing `{ orderId, orderNumber, previousStatus, newStatus, updatedAt }` to the room `customer:{customerId}` if the customer is connected.
2. WHEN an order status changes, THE Socket_Server SHALL emit an `order:status_changed` event to the `staff` room so all connected staff dashboards update their pending-action counts.
3. WHEN a new order is created, THE Socket_Server SHALL emit an `order:new` event to the `staff` room containing the order summary.
4. WHEN a payment proof is uploaded, THE Socket_Server SHALL emit an `order:payment_proof` event to the `staff` room.
5. WHEN a customer connects to the Socket_Server with a valid Access_Token, THE Socket_Server SHALL join the client to the room `customer:{customerId}`.
6. THE Frontend SHALL display a real-time notification badge on the relevant staff dashboard section when an `order:new` or `order:status_changed` event is received.

---

### Requirement 15: API Error Handling and Validation

**User Story:** As a frontend developer, I want all API errors to follow a consistent JSON format, so that the frontend can display meaningful messages without parsing unpredictable responses.

#### Acceptance Criteria

1. THE API_Server SHALL return all error responses in the format `{ ok: false, message: string, errors?: object }` where `errors` contains field-level validation details when applicable.
2. THE API_Server SHALL return all success responses in the format `{ ok: true, data: any }` or `{ ok: true, ...payload }` for consistency with the existing service layer contract.
3. WHEN a request body fails validation, THE API_Server SHALL return HTTP 422 with the `errors` field populated with per-field messages.
4. WHEN an unhandled exception occurs, THE API_Server SHALL log the full stack trace to the server console and return HTTP 500 with `{ ok: false, message: "Terjadi kesalahan server." }` without exposing internal details.
5. THE API_Server SHALL validate all UUID path parameters and return HTTP 400 with a descriptive message if the format is invalid.
6. THE API_Server SHALL implement rate limiting of 100 requests per minute per IP on all `/api/auth/*` endpoints to mitigate brute-force attacks.

---

### Requirement 16: Frontend Service Layer Migration

**User Story:** As a frontend developer, I want each `src/services/*.js` file to be migrated to call the backend API instead of localStorage, so that the frontend and backend stay in sync without duplicating business logic.

#### Acceptance Criteria

1. THE Frontend SHALL migrate each service file (`authService`, `productService`, `orderService`, `cartService`, `chatService`, `reviewService`, `analyticsService`, `categoryService`) to use `httpClient.js` for all data operations after the corresponding backend endpoint is available.
2. WHEN `USE_MOCK` is `true` in `httpClient.js`, THE Frontend SHALL continue to use localStorage-backed service implementations unchanged.
3. WHEN `USE_MOCK` is `false`, THE Frontend SHALL attach the Access_Token to every API request via the `Authorization: Bearer` header.
4. WHEN the API_Server returns HTTP 401 on any request, THE Frontend SHALL automatically attempt one token refresh via `POST /api/auth/refresh` and retry the original request once.
5. IF the token refresh also fails, THEN THE Frontend SHALL clear the local session and redirect the user to the login page.
6. THE Frontend SHALL initialise a Socket.io client connection after successful login, passing the Access_Token as a handshake query parameter, and disconnect on logout.
7. THE Frontend SHALL handle `order:status_changed` and `message:new` Socket.io events and update the relevant React state without requiring a page reload.
