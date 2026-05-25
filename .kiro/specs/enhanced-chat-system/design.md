# Design Document — Enhanced Chat System

## Overview

The Enhanced Chat System extends the existing Gala Printing real-time messaging infrastructure in three directions:

1. **Broadened staff access** — all sub-admin roles (cashier, operational, qc, offline) gain the same customer conversation access that admin, owner, and cs already have.
2. **Staff-to-staff direct messaging (DM)** — any authenticated staff member can open a private 1-on-1 thread with any other staff member, independent of the customer conversation system.
3. **Staff-initiated customer conversations** — admin and all sub-admin roles can search for a registered customer and start a new conversation on the customer's behalf.

The existing system uses Express + MySQL (`conversations` and `messages` tables), React (`ChatsSection.jsx`, `ChatWidget.jsx`, `chatService.js`), and Socket.io for real-time delivery. This design extends each layer with minimal disruption to existing behaviour.

---

## Architecture

The system follows the existing layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│  React Frontend                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  ChatsSection    │  │  DMSection (new) │  │  ChatWidget   │ │
│  │  (enhanced)      │  │                  │  │  (unchanged)  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘ │
│           │                     │                     │         │
│  ┌────────▼─────────────────────▼─────────────────────▼───────┐ │
│  │  chatService.js (enhanced) + dmService.js (new)            │ │
│  └────────────────────────────┬────────────────────────────────┘ │
│                               │ HTTP + Socket.io                 │
└───────────────────────────────┼─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  Express Backend                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  chat.routes.js (enhanced)  │  users.routes.js (enhanced)│   │
│  └──────────────┬──────────────┴──────────────┬─────────────┘   │
│  ┌──────────────▼──────────────┐  ┌───────────▼─────────────┐   │
│  │  chat.controller.js         │  │  users.controller.js    │   │
│  │  (enhanced)                 │  │  (enhanced)             │   │
│  └──────────────┬──────────────┘  └───────────┬─────────────┘   │
│  ┌──────────────▼──────────────┐  ┌───────────▼─────────────┐   │
│  │  chat.service.js (enhanced) │  │  users.service.js       │   │
│  │                             │  │  (enhanced)             │   │
│  └──────────────┬──────────────┘  └─────────────────────────┘   │
│  ┌──────────────▼──────────────┐                                 │
│  │  socket/index.js (enhanced) │                                 │
│  └──────────────┬──────────────┘                                 │
└─────────────────┼───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│  MySQL                                                           │
│  conversations (enhanced) │ messages (unchanged)                │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**Single `conversations` table for both types**: Rather than creating a separate `dm_conversations` table, a `conversation_type` discriminator column is added to the existing `conversations` table. This allows the existing `messages` table, file upload infrastructure, and Socket.io room naming (`conversation:{id}`) to work unchanged for both conversation types.

**Canonical UUID ordering for DM deduplication**: To enforce the unique constraint on `(dm_participant_a, dm_participant_b)` without needing two rows per pair, participant IDs are stored in lexicographic order (lower UUID in `dm_participant_a`). The service layer always normalises the order before querying or inserting.

**Role guard broadening via array update**: The `requireRole` middleware accepts a variadic list of roles. Broadening access to all staff roles is a one-line change to the role list in `chat.routes.js` and `users.routes.js`.

**Personal staff rooms for DM notifications**: A new Socket.io room `staff:{userId}` is introduced alongside the existing `staff` broadcast room. This allows targeted `dm:new` events to be sent only to the two participants of a new DM, rather than broadcasting to all staff.

---

## Components and Interfaces

### Backend

#### `server/src/db/migrations/022_enhance_conversations_for_dm.sql` (new)
Adds `conversation_type`, `dm_participant_a`, `dm_participant_b` columns and the unique index to the `conversations` table.

#### `server/src/services/chat.service.js` (enhanced)
New exported functions:
- `listDMConversations(userId)` — returns all DM conversations where the user is a participant, enriched with `lastMessage` and `unreadCount`, sorted by `last_at DESC`.
- `getOrCreateDMConversation(userAId, userBId)` — normalises participant order, checks for existing DM, creates if absent. Returns the conversation row.
- `markDMAsRead(conversationId, readerId)` — marks all messages in a DM conversation sent by the other participant as read.

Modified functions:
- `listConversations()` — adds `WHERE conversation_type = 'customer_chat'` filter so DM conversations do not appear in the customer conversation list.
- `getOrCreateConversation(customerId, customerName)` — unchanged logic, but now explicitly sets `conversation_type = 'customer_chat'` on insert.
- `saveMessage(...)` — unchanged; works for both conversation types.

#### `server/src/controllers/chat.controller.js` (enhanced)
New handlers:
- `listDMConversations(req, res, next)` — calls `svc.listDMConversations(req.user.id)`.
- `getOrCreateDMConversation(req, res, next)` — validates that both participants are staff, normalises order, calls `svc.getOrCreateDMConversation(...)`, emits `dm:new` to both personal rooms.

Modified handlers:
- `getOrCreateConversation` — validates that `customerId` (when provided by staff) belongs to a user with role `customer`; returns 422 otherwise.
- `markAsRead` — updated to work for both conversation types (no change needed to logic, but role guard is relaxed).

#### `server/src/routes/chat.routes.js` (enhanced)
Changes:
- `GET /` role guard: `requireRole('admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline')`.
- `PATCH /:id/read` role guard: same broadened list.
- New route: `GET /dm` → `authenticate`, `requireRole(all staff)`, `ctrl.listDMConversations`.
- New route: `POST /dm` → `authenticate`, `requireRole(all staff)`, `ctrl.getOrCreateDMConversation`.

#### `server/src/routes/users.routes.js` (enhanced)
Changes:
- `GET /customers` role guard: broadened to all staff roles (for customer search from ChatsSection).
- `GET /staff` role guard: broadened to all staff roles (for DM recipient search).

#### `server/src/services/users.service.js` (enhanced)
New function:
- `searchCustomers(query)` — returns users with `role = 'customer'` whose `name` or `phone` contains the query string (case-insensitive, `LIKE %query%`).
- `searchStaff(query, excludeUserId)` — returns users with `role != 'customer'` whose `name` contains the query string, excluding `excludeUserId`.

Modified function:
- `listCustomers` — adds optional `q` query parameter support for name/phone search.
- `listStaff` — adds optional `q` query parameter support for name search.

#### `server/src/controllers/users.controller.js` (enhanced)
Modified handlers:
- `listCustomers` — passes `req.query.q` to service for search filtering.
- `listStaff` — passes `req.query.q` and `req.user.id` to service for search filtering with self-exclusion.

#### `server/src/socket/index.js` (enhanced)
Changes in the `connection` handler:
- All staff roles (not just `admin`, `owner`, `cs`) join all existing `customer_chat` conversation rooms on connect.
- All staff roles join their personal room `staff:{userId}` on connect.
- All staff roles join all `staff_dm` conversation rooms where they are a participant on connect.
- New helper `joinDMRooms(socket, userId)` — queries `conversations` for DM rows where `dm_participant_a = userId OR dm_participant_b = userId` and joins each room.

### Frontend

#### `src/services/chatService.js` (enhanced)
New exported functions:
- `getDMConversations()` — `GET /api/conversations/dm`.
- `createOrGetDMConversation(recipientId)` — `POST /api/conversations/dm`.
- `searchCustomers(query)` — `GET /api/users/customers?q={query}`.
- `searchStaff(query)` — `GET /api/users/staff?q={query}`.

Modified functions:
- `connectSocket` — adds listener for `dm:new` event, dispatches `gala:dm-new` CustomEvent.

#### `src/components/pages/admin/sections/ChatsSection.jsx` (enhanced)
New UI elements:
- "Mulai Chat Baru" button in the sidebar header.
- Customer search panel (shown when button is clicked): text input, results list, "Tidak ada customer ditemukan." empty state.
- Unread count badge on each conversation list item (already partially present; ensure it works for all staff roles).
- `markAsRead` called for all staff roles (not just admin/owner/cs).

#### `src/components/pages/admin/sections/DMSection.jsx` (new)
A new React component with the same structural pattern as `ChatsSection.jsx`:
- Left panel: DM conversation list sorted by `last_at` DESC, showing other participant's name, role badge, and unread count badge.
- Right panel: message thread with `MessageBubble` (reused from ChatsSection), text input (max 1000 chars), file attachment input (same validation).
- "Pesan Baru" button → staff directory search panel with text input and results list (excludes self).
- Listens for `gala:message-new` and `gala:dm-new` CustomEvents to refresh without page reload.

#### Sub-admin dashboard pages (enhanced)
The following pages gain a new `chat` nav item pointing to `<ChatsSection />` and a new `dm` nav item pointing to `<DMSection />`:
- `src/components/pages/subadmin/CashierDashboardPage.jsx`
- `src/components/pages/subadmin/OperationalDashboardPage.jsx`
- `src/components/pages/subadmin/QCDashboardPage.jsx`

The `OfflineDashboardPage.jsx` has its own layout (not using `SubAdminLayout`) and must be updated directly to add the two nav items and section entries.

The `CSDashboardPage.jsx` already has `ChatsSection`; it gains the `dm` nav item.

The `AdminDashboardPage.jsx` gains a `DM` nav item in `ADMIN_NAV` pointing to `<DMSection />`.

---

## Data Models

### `conversations` table (after migration)

```sql
ALTER TABLE conversations
  ADD COLUMN conversation_type ENUM('customer_chat', 'staff_dm')
    NOT NULL DEFAULT 'customer_chat'
    AFTER assigned_admin_id,
  ADD COLUMN dm_participant_a CHAR(36) NULL
    AFTER conversation_type,
  ADD COLUMN dm_participant_b CHAR(36) NULL
    AFTER dm_participant_a;

-- Backfill existing rows
UPDATE conversations SET conversation_type = 'customer_chat'
  WHERE conversation_type IS NULL OR conversation_type = '';

-- Unique index for DM deduplication
CREATE UNIQUE INDEX uq_dm_participants
  ON conversations (dm_participant_a, dm_participant_b)
  WHERE conversation_type = 'staff_dm';
-- Note: MySQL does not support partial indexes; use a composite unique index
-- and enforce the staff_dm constraint in the service layer.
-- Alternative: unique index on (dm_participant_a, dm_participant_b) with
-- NULL values excluded by the DB engine (NULLs are not equal in UNIQUE indexes
-- in MySQL, so customer_chat rows with NULL participants will not conflict).
```

> **MySQL NULL behaviour**: In MySQL, a UNIQUE index on `(dm_participant_a, dm_participant_b)` treats NULL values as distinct, so `customer_chat` rows (where both columns are NULL) will not violate the constraint. This is the correct behaviour.

### Conversation row shapes

**Customer conversation** (existing, unchanged):
```json
{
  "id": "uuid",
  "customer_id": "uuid",
  "customer_name": "string",
  "assigned_admin_id": "uuid | null",
  "conversation_type": "customer_chat",
  "dm_participant_a": null,
  "dm_participant_b": null,
  "last_at": "datetime | null",
  "created_at": "datetime"
}
```

**DM conversation** (new):
```json
{
  "id": "uuid",
  "customer_id": null,
  "customer_name": "",
  "assigned_admin_id": null,
  "conversation_type": "staff_dm",
  "dm_participant_a": "uuid (lower)",
  "dm_participant_b": "uuid (higher)",
  "last_at": "datetime | null",
  "created_at": "datetime"
}
```

> **Note**: `customer_id` is `NOT NULL` in the current schema. The migration must either make it nullable or use a sentinel value (e.g., empty string or a system UUID) for DM rows. The recommended approach is to make `customer_id` nullable in the same migration, since DM conversations have no customer.

### `messages` table (unchanged)

The `messages` table works for both conversation types without modification. The `sender_role` column stores the actual role of the sender (e.g., `cashier`, `operational`) for all message types.

### Frontend data shapes

**DM conversation list item** (returned by `GET /api/conversations/dm`):
```json
{
  "id": "uuid",
  "conversation_type": "staff_dm",
  "dm_participant_a": "uuid",
  "dm_participant_b": "uuid",
  "other_participant_id": "uuid",
  "other_participant_name": "string",
  "other_participant_role": "string",
  "last_at": "datetime | null",
  "unread_count": 0,
  "last_message": { ... } | null
}
```

The `other_participant_*` fields are computed server-side by joining with the `users` table, using `req.user.id` to determine which participant is "other".

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Staff role guard for conversation list

*For any* authenticated user whose role is one of `admin`, `owner`, `cashier`, `cs`, `operational`, `qc`, `offline`, calling `GET /api/conversations` SHALL return HTTP 200. For any user whose role is `customer`, the same endpoint SHALL return HTTP 403.

**Validates: Requirements 1.1, 1.5, 5.1**

---

### Property 2: Message sender_role round-trip

*For any* staff role and any valid text message content, when a staff member sends a message to a conversation, the persisted message record SHALL have `sender_role` equal to the sender's actual role.

**Validates: Requirements 1.2, 3.6**

---

### Property 3: Mark as read clears unread count

*For any* conversation containing N unread messages (where N > 0), after calling `PATCH /api/conversations/:id/read`, the unread count for that conversation SHALL be 0.

**Validates: Requirements 1.3, 2.10**

---

### Property 4: Conversation creation is idempotent

*For any* customer ID, calling `POST /api/conversations` multiple times SHALL always return the same conversation ID. *For any* pair of staff user IDs, calling `POST /api/conversations/dm` multiple times SHALL always return the same DM conversation ID.

**Validates: Requirements 2.2, 3.1, 5.5, 5.6**

---

### Property 5: DM participant invariant

*For any* DM conversation created via `POST /api/conversations/dm`, the conversation record SHALL have exactly two non-null participant IDs (`dm_participant_a` and `dm_participant_b`), and both participant IDs SHALL correspond to users with a staff role (not `customer`).

**Validates: Requirements 2.1, 2.3**

---

### Property 6: DM canonical participant ordering

*For any* two staff user IDs A and B, when a DM conversation is created between them, the stored `dm_participant_a` SHALL be `min(A, B)` and `dm_participant_b` SHALL be `max(A, B)` (lexicographic comparison). This SHALL hold regardless of the order in which A and B are passed to the creation endpoint.

**Validates: Requirements 4.3**

---

### Property 7: Migration backward compatibility

*For all* conversation records that existed in the database before the migration, after running migration `022`, the `conversation_type` column SHALL be `customer_chat`.

**Validates: Requirements 4.6**

---

### Property 8: DM endpoint role guard

*For any* authenticated user whose role is `customer`, calling `POST /api/conversations/dm`, `GET /api/conversations/dm`, or `GET /api/staff` SHALL return HTTP 403.

**Validates: Requirements 5.2, 5.3, 5.4**

---

### Property 9: Staff directory search filtering

*For any* search query string Q (with length ≥ 1), all results returned by `GET /api/staff?q=Q` SHALL have a `name` that contains Q (case-insensitive), and none of the results SHALL have `role = 'customer'`.

**Validates: Requirements 2.13**

---

### Property 10: Customer search filtering

*For any* search query string Q (with length ≥ 1), all results returned by `GET /api/users/customers?q=Q` SHALL have `role = 'customer'` and SHALL have a `name` or `phone` that contains Q (case-insensitive).

**Validates: Requirements 3.3**

---

### Property 11: Empty message rejection

*For any* string whose trimmed length is 0 (the empty string, or any string composed entirely of whitespace characters), submitting it as a text message to any conversation endpoint SHALL return HTTP 422 with the message `"Pesan tidak boleh kosong."`.

**Validates: Requirements 9.1**

---

### Property 12: Oversized message rejection

*For any* string whose trimmed length exceeds 1000 characters, submitting it as a text message to any conversation endpoint SHALL return HTTP 422.

**Validates: Requirements 9.2**

---

### Property 13: File MIME type validation

*For any* file whose MIME type is not one of `application/pdf`, `image/png`, `image/jpeg`, `application/zip`, `application/x-zip-compressed`, submitting it as a file message SHALL return HTTP 422.

**Validates: Requirements 9.3**

---

### Property 14: File size validation

*For any* file whose size exceeds 5,242,880 bytes (5 MB), submitting it as a file message SHALL return HTTP 422.

**Validates: Requirements 9.4**

---

### Property 15: HTML escaping of message content

*For any* text message containing HTML special characters (`<`, `>`, `&`, `"`, `'`), the content stored in the `messages` table SHALL have those characters replaced with their HTML entity equivalents (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#x27;`).

**Validates: Requirements 9.5**

---

### Property 16: Unread count badge rendering

*For any* conversation list item where `unreadCount > 0`, the rendered ChatsSection or DMSection list item SHALL include a visible unread count badge element. *For any* conversation list item where `unreadCount = 0`, no unread badge SHALL be rendered.

**Validates: Requirements 7.6, 8.2**

---

### Property 17: DM list sorted by last_at descending

*For any* set of DM conversations with distinct `last_at` values, the DMSection SHALL render them in descending order of `last_at` (most recently active first).

**Validates: Requirements 8.1**

---

### Property 18: Messages displayed in chronological order

*For any* set of messages in a conversation with distinct `created_at` values, the message thread view SHALL display them in ascending order of `created_at` (oldest first).

**Validates: Requirements 8.3**

---

### Property 19: Staff directory search excludes self

*For any* authenticated staff member with user ID U, all results returned by the staff directory search (whether via `GET /api/staff?q=...` or rendered in the DMSection search panel) SHALL NOT include a user with ID equal to U.

**Validates: Requirements 8.5**

---

## Error Handling

### Backend

| Scenario | HTTP Status | Response body |
|---|---|---|
| Customer calls staff-only endpoint | 403 | `{ ok: false, message: "Akses ditolak." }` |
| Staff calls `POST /api/conversations` with non-customer `customerId` | 422 | `{ ok: false, message: "User bukan customer." }` |
| Staff calls `POST /api/conversations/dm` with a customer participant | 422 | `{ ok: false, message: "Peserta DM harus memiliki role staff." }` |
| Staff calls `POST /api/conversations/dm` with self as both participants | 422 | `{ ok: false, message: "Tidak dapat membuat DM dengan diri sendiri." }` |
| Text message with empty/whitespace content | 422 | `{ ok: false, message: "Pesan tidak boleh kosong." }` |
| Text message exceeding 1000 characters | 422 | `{ ok: false, message: "Pesan maksimal 1000 karakter." }` |
| File with invalid MIME type | 422 | `{ ok: false, message: "Format file tidak didukung. Gunakan PDF, PNG, JPG, JPEG, atau ZIP." }` |
| File exceeding 5 MB | 422 | `{ ok: false, message: "Ukuran file maksimal 5 MB." }` |
| Conversation not found | 404 | `{ ok: false, message: "Percakapan tidak ditemukan." }` |
| Customer accessing another customer's conversation | 403 | `{ ok: false, message: "Akses ditolak." }` |
| Sub-admin calling `DELETE /api/conversations/:id` | 403 | `{ ok: false, message: "Akses ditolak. Hanya admin yang dapat menghapus percakapan." }` |

### Frontend

- Customer search: debounce 300 ms; minimum 2 characters before API call; show "Tidak ada customer ditemukan." on empty results.
- Staff directory search: same debounce and minimum character rules; show "Tidak ada staff ditemukan." on empty results.
- Empty message submission: show inline error "Pesan tidak boleh kosong." without API call.
- File validation errors: show inline error message; clear file input.
- API errors: display the `message` field from the response body as an inline error.

---

## Testing Strategy

### Unit Tests (example-based)

- `chat.service.js`: test `getOrCreateDMConversation` with same pair in both orders returns same conversation.
- `chat.service.js`: test `listDMConversations` filters by participant ID correctly.
- `users.service.js`: test `searchCustomers` and `searchStaff` with various query strings.
- `chat.controller.js`: test role validation for DM creation (customer participant → 422, self-DM → 422).
- `ChatsSection.jsx`: render test verifying "Mulai Chat Baru" button is present.
- `DMSection.jsx`: render test verifying "Pesan Baru" button and conversation list are present.

### Property-Based Tests

The project uses **fast-check** (already present in the test suite based on existing property test files). Each property test runs a minimum of 100 iterations.

Property tests are located in `server/src/tests/` (backend) and follow the naming convention `{feature}.property.test.js`.

New test file: `server/src/tests/enhancedChatSystem.property.test.js`

Each test is tagged with a comment:
```js
// Feature: enhanced-chat-system, Property N: <property text>
```

**Properties to implement as property-based tests:**

| Property | Test approach |
|---|---|
| P1: Staff role guard | Generate random staff role from the allowed set; verify 200. Generate customer role; verify 403. |
| P2: Sender_role round-trip | Generate random staff role; send message; read back; verify sender_role matches. |
| P3: Mark as read clears unread | Generate N (1–20) unread messages; call mark-as-read; verify unread count = 0. |
| P4: Conversation creation idempotent | Generate customer ID; call POST /conversations twice; verify same ID returned. |
| P5: DM participant invariant | Generate two staff user IDs; create DM; verify both participants are staff. |
| P6: DM canonical ordering | Generate two UUIDs A, B; create DM; verify participant_a = min(A,B). |
| P7: Migration backward compatibility | Seed N customer_chat rows; run migration; verify all have conversation_type = customer_chat. |
| P8: DM endpoint role guard | Customer token; call each DM endpoint; verify 403. |
| P9: Staff directory search | Generate random search string; verify all results contain string (case-insensitive) and are staff. |
| P10: Customer search | Generate random search string; verify all results are customers with matching name/phone. |
| P11: Empty message rejection | Generate whitespace-only strings; verify 422 with correct message. |
| P12: Oversized message rejection | Generate strings > 1000 chars; verify 422. |
| P13: File MIME type validation | Generate disallowed MIME types; verify 422. |
| P14: File size validation | Generate file sizes > 5 MB; verify 422. |
| P15: HTML escaping | Generate strings with HTML special chars; send message; verify stored content is escaped. |
| P16: Unread badge rendering | Generate conversation list with random unreadCount values; verify badge presence matches unreadCount > 0. |
| P17: DM list sort order | Generate DM conversations with random last_at values; verify rendered order is descending. |
| P18: Message chronological order | Generate messages with random created_at values; verify rendered order is ascending. |
| P19: Staff search excludes self | Generate staff user ID; search staff directory; verify self not in results. |

### Integration Tests

- Socket.io room membership: connect staff socket, verify it joins `staff`, `staff:{userId}`, and all relevant conversation rooms.
- `message:new` event emission: send message via HTTP, verify socket event received in conversation room within 500 ms.
- `dm:new` event emission: create DM via HTTP, verify `dm:new` received in both `staff:{userAId}` and `staff:{userBId}` rooms.
- `conversation:new` event emission: staff creates customer conversation, verify `conversation:new` received in `staff` room.
- End-to-end DM flow: staff A creates DM with staff B, sends message, staff B receives `message:new` event.
