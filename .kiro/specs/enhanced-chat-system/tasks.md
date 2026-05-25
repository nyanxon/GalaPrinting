# Tasks — Enhanced Chat System

## Task List

- [x] 1. Database Migration
  - [x] 1.1 Create migration file `server/src/db/migrations/022_enhance_conversations_for_dm.sql`
  - [x] 1.2 Make `customer_id` nullable in the `conversations` table (required for DM rows)
  - [x] 1.3 Add `conversation_type` ENUM column with default `customer_chat`
  - [x] 1.4 Add `dm_participant_a` and `dm_participant_b` CHAR(36) nullable columns
  - [x] 1.5 Backfill all existing rows with `conversation_type = 'customer_chat'`
  - [x] 1.6 Add unique index on `(dm_participant_a, dm_participant_b)` for DM deduplication

- [x] 2. Backend — Chat Service (`server/src/services/chat.service.js`)
  - [x] 2.1 Update `listConversations()` to filter `WHERE conversation_type = 'customer_chat'` so DM rows are excluded from the customer conversation list (Req 1.1)
  - [x] 2.2 Update `getOrCreateConversation()` to explicitly set `conversation_type = 'customer_chat'` on INSERT (Req 4.1)
  - [x] 2.3 Add `listDMConversations(userId)` — queries DM conversations where `dm_participant_a = userId OR dm_participant_b = userId`, joins with `users` table to get other participant's name and role, enriches with `lastMessage` and `unreadCount`, sorted by `last_at DESC` (Req 2.9, 2.11)
  - [x] 2.4 Add `getOrCreateDMConversation(userAId, userBId)` — normalises participant order (`min`/`max` UUID comparison), checks for existing DM, inserts new row if absent, returns conversation row (Req 2.2, 4.3, 4.4)
  - [x] 2.5 Add `markDMAsRead(conversationId, readerId)` — marks all messages in the DM conversation sent by the other participant (not `readerId`) as read (Req 2.10)

- [x] 3. Backend — Users Service (`server/src/services/users.service.js`)
  - [x] 3.1 Update `listCustomers()` to accept optional `q` parameter and filter by `name LIKE %q%` OR `phone LIKE %q%` (case-insensitive) when provided (Req 3.3)
  - [x] 3.2 Update `listStaff()` to accept optional `q` parameter and filter by `name LIKE %q%` (case-insensitive) when provided, and accept optional `excludeUserId` to exclude self from results (Req 2.13, 8.5)

- [x] 4. Backend — Users Controller (`server/src/controllers/users.controller.js`)
  - [x] 4.1 Update `listCustomers` handler to pass `req.query.q` to the service (Req 3.3)
  - [x] 4.2 Update `listStaff` handler to pass `req.query.q` and `req.user.id` to the service (Req 2.13, 8.5)

- [x] 5. Backend — Users Routes (`server/src/routes/users.routes.js`)
  - [x] 5.1 Broaden `GET /customers` role guard to all staff roles: `requireRole('admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline')` (Req 3.2, 5.4)
  - [x] 5.2 Broaden `GET /staff` role guard to all staff roles (Req 5.4)

- [x] 6. Backend — Chat Controller (`server/src/controllers/chat.controller.js`)
  - [x] 6.1 Update `getOrCreateConversation` handler to validate that `customerId` (when provided by staff) belongs to a user with `role = 'customer'`; return HTTP 422 with `"User bukan customer."` otherwise (Req 3.5, 5.5)
  - [x] 6.2 Add `listDMConversations` handler — calls `svc.listDMConversations(req.user.id)`, returns `{ ok: true, data: [...] }` (Req 2.9, 5.3)
  - [x] 6.3 Add `getOrCreateDMConversation` handler — validates both participants are staff (not customer), validates not self-DM, calls `svc.getOrCreateDMConversation(...)`, emits `dm:new` Socket.io event to `staff:{userAId}` and `staff:{userBId}` personal rooms, returns conversation (Req 2.2, 2.4, 2.5, 6.5)
  - [x] 6.4 Update `markAsRead` handler to support both conversation types — for DM conversations, call `svc.markDMAsRead(conversationId, req.user.id)` instead of `svc.markAsRead(conversationId)` (Req 5.8, 2.10)

- [x] 7. Backend — Chat Routes (`server/src/routes/chat.routes.js`)
  - [x] 7.1 Broaden `GET /` role guard to all staff roles: `requireRole('admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline')` (Req 1.1, 5.1)
  - [x] 7.2 Broaden `PATCH /:id/read` role guard to all staff roles (Req 5.8)
  - [x] 7.3 Add `GET /dm` route: `authenticate`, `requireRole(all staff)`, `ctrl.listDMConversations` — must be registered BEFORE `GET /:id` to avoid route conflict (Req 2.9, 5.3)
  - [x] 7.4 Add `POST /dm` route: `authenticate`, `requireRole(all staff)`, `ctrl.getOrCreateDMConversation` (Req 2.2, 5.2)

- [x] 8. Backend — Socket.io (`server/src/socket/index.js`)
  - [x] 8.1 Update the staff connection handler so ALL staff roles (not just `admin`, `owner`, `cs`) join all existing `customer_chat` conversation rooms on connect (Req 1.7)
  - [x] 8.2 Add personal room join: all staff sockets join `staff:{userId}` on connect (Req 6.5)
  - [x] 8.3 Add DM room join on connect: query `conversations` for all `staff_dm` rows where `dm_participant_a = userId OR dm_participant_b = userId` and join each `conversation:{id}` room (Req 2.8, 6.6)
  - [x] 8.4 When a new `customer_chat` conversation is created (in `getOrCreateConversation` controller), emit `conversation:new` to the `staff` room and add all connected staff sockets to the new conversation room (Req 1.8, 3.7, 6.4)

- [x] 9. Backend — Message Validation (`server/src/controllers/chat.controller.js`)
  - [x] 9.1 In `sendMessage` handler, add server-side validation: reject trimmed content length = 0 with HTTP 422 `"Pesan tidak boleh kosong."` (Req 9.1)
  - [x] 9.2 In `sendMessage` handler, add server-side validation: reject trimmed content length > 1000 with HTTP 422 `"Pesan maksimal 1000 karakter."` (Req 9.2)
  - [x] 9.3 In `sendMessage` handler, apply `escapeHtml()` to content before passing to `svc.saveMessage()` (Req 9.5)
  - [x] 9.4 Verify `sendFileMessage` handler already enforces MIME type and size limits via `uploadChat` multer middleware; add explicit 422 response if file is rejected (Req 9.3, 9.4)

- [x] 10. Frontend — Chat Service (`src/services/chatService.js`)
  - [x] 10.1 Add `getDMConversations()` — `GET /api/conversations/dm`, maps snake_case to camelCase (Req 2.9)
  - [x] 10.2 Add `createOrGetDMConversation(recipientId)` — `POST /api/conversations/dm` with `{ recipientId }` body (Req 2.2)
  - [x] 10.3 Add `searchCustomers(query)` — `GET /api/users/customers?q={query}`, returns array of customer objects (Req 3.2, 3.3)
  - [x] 10.4 Add `searchStaff(query)` — `GET /api/users/staff?q={query}`, returns array of staff objects (Req 2.12, 2.13)
  - [x] 10.5 Update `connectSocket` to listen for `dm:new` event and dispatch `gala:dm-new` CustomEvent (Req 8.9, 6.5)

- [x] 11. Frontend — ChatsSection Enhancement (`src/components/pages/admin/sections/ChatsSection.jsx`)
  - [x] 11.1 Add "Mulai Chat Baru" button to the sidebar header, visible to all staff roles (Req 7.1)
  - [x] 11.2 Add customer search panel state: toggle visibility on button click, show text input (Req 7.2)
  - [x] 11.3 Implement customer search: call `searchCustomers(query)` when input length ≥ 2 (debounced 300 ms), display results list with customer name and phone, show "Tidak ada customer ditemukan." on empty results (Req 7.3, 7.5)
  - [x] 11.4 On customer selection: call `createOrGetConversation(customerId, customerName)`, close search panel, open the resulting conversation in the message view (Req 7.4)
  - [x] 11.5 Ensure unread count badge is rendered for all staff roles (remove the `admin/owner/cs` restriction in `loadMessages` that calls `markAsRead`) (Req 7.6, 7.7, 1.3)

- [x] 12. Frontend — DMSection Component (`src/components/pages/admin/sections/DMSection.jsx`)
  - [x] 12.1 Create `DMSection.jsx` with left panel (DM conversation list) and right panel (message thread) layout, mirroring `ChatsSection.jsx` structure (Req 8.1, 8.3)
  - [x] 12.2 Implement DM conversation list: call `getDMConversations()` on mount, display other participant's name, role badge, and unread count badge, sorted by `last_at` DESC (Req 8.1, 8.2, 2.11)
  - [x] 12.3 Implement message thread: on DM conversation select, call `getMessagesByConversation(id)` and render messages using `MessageBubble` in chronological order; call mark-as-read API (Req 8.3, 2.10)
  - [x] 12.4 Implement text input (max 1000 chars) with Enter-to-send, inline validation error "Pesan tidak boleh kosong." for empty submission (Req 8.7, 8.10)
  - [x] 12.5 Implement file attachment input with same MIME type and size validation as ChatsSection (Req 8.7, 9.3, 9.4)
  - [x] 12.6 Add "Pesan Baru" button that opens staff directory search panel (Req 8.4)
  - [x] 12.7 Implement staff directory search: call `searchStaff(query)` when input length ≥ 2 (debounced 300 ms), display results excluding self, show "Tidak ada staff ditemukan." on empty results (Req 8.5, 2.13)
  - [x] 12.8 On staff selection: call `createOrGetDMConversation(recipientId)`, close search panel, open the resulting DM conversation in the message view (Req 8.6, 2.2)
  - [x] 12.9 Listen for `gala:message-new` CustomEvent: refresh DM list and active thread (Req 8.8)
  - [x] 12.10 Listen for `gala:dm-new` CustomEvent: add new DM conversation to the list without full page reload (Req 8.9)

- [x] 13. Frontend — Sub-Admin Dashboard Pages
  - [x] 13.1 Update `CashierDashboardPage.jsx`: add `{ id: 'chat', label: '💬 Chat Customer' }` and `{ id: 'dm', label: '📨 Pesan Staff' }` nav items; add `chat: <ChatsSection />` and `dm: <DMSection />` to SECTIONS (Req 1.4, 2.9)
  - [x] 13.2 Update `OperationalDashboardPage.jsx`: same additions as 13.1 (Req 1.4, 2.9)
  - [x] 13.3 Update `QCDashboardPage.jsx`: same additions as 13.1 (Req 1.4, 2.9)
  - [x] 13.4 Update `CSDashboardPage.jsx`: add `{ id: 'dm', label: '📨 Pesan Staff' }` nav item and `dm: <DMSection />` section (already has ChatsSection) (Req 2.9)
  - [x] 13.5 Update `src/components/pages/offline/OfflineDashboardPage.jsx`: add `{ id: 'chat', label: '💬 Chat Customer' }` and `{ id: 'dm', label: '📨 Pesan Staff' }` nav items; add corresponding section rendering in the `activeNav` switch (Req 1.4, 2.9)
  - [x] 13.6 Update `AdminDashboardPage.jsx`: add `{ id: 'dm', label: 'DM' }` to `ADMIN_NAV`; add `case 'dm': return <DMSection />;` to `renderSection()` (Req 2.9)

- [x] 14. Property-Based Tests (`server/src/tests/enhancedChatSystem.property.test.js`)
  - [x] 14.1 Write property test for P1: Staff role guard — for any staff role, GET /api/conversations returns 200; for customer role, returns 403 (Req 1.1, 5.1)
  - [x] 14.2 Write property test for P2: Message sender_role round-trip — for any staff role, sent message has correct sender_role (Req 1.2)
  - [x] 14.3 Write property test for P3: Mark as read clears unread count — for any N unread messages, after PATCH /read, unread count = 0 (Req 1.3, 2.10)
  - [x] 14.4 Write property test for P4: Conversation creation idempotent — calling POST /conversations twice for same customer returns same ID (Req 2.2, 3.1)
  - [x] 14.5 Write property test for P5: DM participant invariant — created DM has exactly two non-null staff participant IDs (Req 2.1)
  - [x] 14.6 Write property test for P6: DM canonical ordering — dm_participant_a = min(A,B), dm_participant_b = max(A,B) regardless of input order (Req 4.3)
  - [x] 14.7 Write property test for P8: DM endpoint role guard — customer token receives 403 for all DM endpoints (Req 5.2, 5.3, 5.4)
  - [x] 14.8 Write property test for P9: Staff directory search filtering — all results contain query string (case-insensitive) and have non-customer role (Req 2.13)
  - [x] 14.9 Write property test for P10: Customer search filtering — all results are customers with matching name or phone (Req 3.3)
  - [x] 14.10 Write property test for P11: Empty message rejection — whitespace-only strings return 422 with correct message (Req 9.1)
  - [x] 14.11 Write property test for P12: Oversized message rejection — strings > 1000 chars return 422 (Req 9.2)
  - [x] 14.12 Write property test for P13: File MIME type validation — disallowed MIME types return 422 (Req 9.3)
  - [x] 14.13 Write property test for P14: File size validation — files > 5 MB return 422 (Req 9.4)
  - [x] 14.14 Write property test for P15: HTML escaping — messages with HTML special chars are stored escaped (Req 9.5)
  - [x] 14.15 Write property test for P19: Staff search excludes self — search results never include the authenticated user's ID (Req 8.5)
