# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Snake_case Field Mismatch & Missing Normalization
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases to ensure reproducibility
  - Test file: `server/src/tests/chatSystemBugCondition.property.test.js`
  - **Bug Condition C1 — Conversation field mismatch**: Mock `api.get('/api/conversations')` to return objects with snake_case fields (`customer_id`, `customer_name`, `assigned_admin_id`, `last_at`, `unread_count`). Call `getAllConversations()` and assert that each result has `customerId`, `customerName`, `assignedAdminId`, `lastAt`, `unreadCount` defined (not `undefined`). Run on UNFIXED code — expect FAILURE because the raw snake_case fields are returned as-is.
  - **Bug Condition C2 — Message field mismatch**: Mock `api.get('/api/conversations/:id/messages')` to return objects with snake_case fields (`sender_role`, `file_name`, `file_size`, `mime_type`, `file_path`, `read_at`, `created_at`). Call `getMessagesByConversation(convId)` and assert each result has `senderRole`, `fileName`, `fileSize`, `mimeType`, `filePath`, `readAt`, `createdAt` defined. Run on UNFIXED code — expect FAILURE.
  - **Bug Condition C3 — File message missing dataUrl**: Given a message object with `filePath` set and `dataUrl` undefined, assert that `(msg.dataUrl || msg.filePath)` is truthy. On unfixed `MessageBubble` which only checks `msg.dataUrl`, the View/Download block is never rendered — document this counterexample.
  - **Bug Condition C4 — CS role excluded from markAsRead**: Given `user.role = 'cs'`, assert that the markAsRead condition `(user?.role === 'admin' || user?.role === 'owner' || user?.role === 'cs')` is true. On unfixed code the condition is false for `cs` — document this counterexample.
  - **Bug Condition C5 — needsReply absent in backend response**: Given a conversation from the backend with `unread_count: 3` and no `needsReply` field, assert that the unhandled-chat filter `(c.unreadCount ?? 0) > 0` returns true. On unfixed code `c.needsReply === true` is false — document this counterexample.
  - **Bug Condition C7 — empty customerName**: Assert that `getMessagesByCustomer(customerId, customerName)` passes `customerName` (not `""`) to `createOrGetConversation`. On unfixed code the second argument is always `""` — document this counterexample.
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - localStorage Mode and Backend API Contracts Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `server/src/tests/chatSystemPreservation.property.test.js`
  - **P1 — localStorage path unchanged**: When `USE_BACKEND = false`, observe that `getAllConversations()` reads from localStorage and returns objects with camelCase fields already. Write property: for all localStorage conversation objects, `getAllConversations()` returns them with `customerId`, `customerName`, `assignedAdminId` intact (no transformation applied). Verify test PASSES on unfixed code.
  - **P2 — Backend REST API calls preserved**: When `USE_BACKEND = true`, observe that `getAllConversations()` calls `api.get('/api/conversations')` exactly once. Write property: for any mock backend response, the API endpoint is called and the raw data is returned (even if not normalized yet). Verify test PASSES on unfixed code.
  - **P3 — File upload validation preserved**: For all file inputs, observe that files > 5 MB are rejected and unsupported MIME types are rejected. Write property: `validateFile({ size: 6*1024*1024, name: 'x.pdf', type: 'application/pdf' })` returns `{ ok: false }`. Verify test PASSES on unfixed code.
  - **P4 — Text message send flow preserved**: When `USE_BACKEND = true`, observe that `sendMessage({ type: 'text', content: 'hello', ... })` calls `api.post('/api/conversations/:id/messages', ...)`. Write property: for any non-empty text content, the POST endpoint is called with the trimmed content. Verify test PASSES on unfixed code.
  - **P5 — markAsRead API call preserved**: When `USE_BACKEND = true`, observe that `markAsRead(convId, 'admin')` calls `api.patch('/api/conversations/:id/read')`. Write property: for any convId, the PATCH endpoint is called. Verify test PASSES on unfixed code.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Fix chat system snake_case/camelCase mismatch and related bugs

  - [x] 3.1 Normalize conversation fields in `getAllConversations` (chatService.js)
    - In `src/services/chatService.js`, in the `USE_BACKEND` branch of `getAllConversations`, map the raw API array to camelCase before returning
    - Add mapping: `customerId: c.customer_id ?? c.customerId`
    - Add mapping: `customerName: c.customer_name ?? c.customerName`
    - Add mapping: `assignedAdminId: c.assigned_admin_id ?? c.assignedAdminId`
    - Add mapping: `lastAt: c.last_at ?? c.lastAt`
    - Add mapping: `unreadCount: c.unread_count ?? c.unreadCount ?? 0`
    - The localStorage path (`USE_BACKEND = false`) must remain completely unchanged
    - _Bug_Condition: isBugCondition(input) where USE_BACKEND=true AND backend returns snake_case conversation fields_
    - _Expected_Behavior: expectedBehavior(result).customerId = snake_input.customer_id (EB1)_
    - _Preservation: P1 — localStorage path unchanged; P2 — GET /api/conversations still called_
    - _Requirements: 2.1, 2.5, 2.6_

  - [x] 3.2 Normalize message fields in `getMessagesByConversation` (chatService.js)
    - In `src/services/chatService.js`, in the `USE_BACKEND` branch of `getMessagesByConversation`, map the raw API array to camelCase before returning
    - Add mapping: `senderRole: m.sender_role ?? m.senderRole`
    - Add mapping: `fileName: m.file_name ?? m.fileName`
    - Add mapping: `fileSize: m.file_size ?? m.fileSize`
    - Add mapping: `mimeType: m.mime_type ?? m.mimeType`
    - Add mapping: `filePath: m.file_path ?? m.filePath`
    - Add mapping: `readAt: m.read_at ?? m.readAt`
    - Add mapping: `createdAt: m.created_at ?? m.createdAt`
    - The localStorage path must remain completely unchanged
    - _Bug_Condition: isBugCondition(input) where USE_BACKEND=true AND backend returns snake_case message fields_
    - _Expected_Behavior: expectedBehavior(result).senderRole = snake_input.sender_role (EB2)_
    - _Preservation: P1 — localStorage path unchanged; P2 — GET /api/conversations/:id/messages still called_
    - _Requirements: 2.2_

  - [x] 3.3 Use `filePath` as fallback for file message View/Download links (ChatsSection.jsx)
    - In `src/components/pages/admin/sections/ChatsSection.jsx`, in `MessageBubble`, change the condition from `{msg.dataUrl && ...}` to `{(msg.dataUrl || msg.filePath) && ...}`
    - Replace all `href={msg.dataUrl}` with `href={msg.dataUrl || msg.filePath}` inside the file actions block
    - _Bug_Condition: isBugCondition(input) where file message has file_path but no dataUrl (C3)_
    - _Expected_Behavior: expectedBehavior(result) — View/Download links rendered using filePath (EB3)_
    - _Preservation: localStorage file messages still use dataUrl (base64) — no change to that path_
    - _Requirements: 2.3_

  - [x] 3.4 Use `filePath` as fallback for file message View/Download links (ChatWidget.jsx)
    - In `src/components/shared/ChatWidget.jsx`, in `MessageBubble`, apply the same change as 3.3
    - Change `{msg.dataUrl && ...}` to `{(msg.dataUrl || msg.filePath) && ...}`
    - Replace all `href={msg.dataUrl}` with `href={msg.dataUrl || msg.filePath}` inside the file actions block
    - _Bug_Condition: isBugCondition(input) where file message has file_path but no dataUrl (C3)_
    - _Expected_Behavior: expectedBehavior(result) — View/Download links rendered using filePath (EB3)_
    - _Preservation: localStorage file messages still use dataUrl (base64) — no change to that path_
    - _Requirements: 2.3_

  - [x] 3.5 Include `cs` role in markAsRead trigger (ChatsSection.jsx)
    - In `src/components/pages/admin/sections/ChatsSection.jsx`, in `loadMessages`, change the role check from `user?.role === 'admin' || user?.role === 'owner'` to also include `user?.role === 'cs'`
    - New condition: `if (user?.role === 'admin' || user?.role === 'owner' || user?.role === 'cs')`
    - _Bug_Condition: isBugCondition(input) where user.role = 'cs' (C4)_
    - _Expected_Behavior: expectedBehavior(result) — markAsRead called for cs role (EB4)_
    - _Preservation: admin and owner markAsRead behavior unchanged_
    - _Requirements: 2.4_

  - [x] 3.6 Replace `needsReply === true` with `unreadCount > 0` in AdminDashboardPage.jsx
    - In `src/components/pages/admin/AdminDashboardPage.jsx`, in `ActivitySidebar.loadActivity`, change `.filter((c) => c.needsReply === true)` to `.filter((c) => (c.unreadCount ?? 0) > 0)`
    - _Bug_Condition: isBugCondition(input) where backend response has no needsReply field (C5)_
    - _Expected_Behavior: expectedBehavior(result) — unhandled chats filtered by unreadCount > 0 (EB5)_
    - _Preservation: localStorage mode still computes needsReply in getAllConversations — no change_
    - _Requirements: 2.5_

  - [x] 3.7 Replace `needsReply === true` with `unreadCount > 0` in OwnerDashboardPage.jsx
    - In `src/components/pages/owner/OwnerDashboardPage.jsx`, in `ActivitySidebar.loadActivity`, apply the same change as 3.6
    - Change `.filter((c) => c.needsReply === true)` to `.filter((c) => (c.unreadCount ?? 0) > 0)`
    - _Bug_Condition: isBugCondition(input) where backend response has no needsReply field (C5)_
    - _Expected_Behavior: expectedBehavior(result) — unhandled chats filtered by unreadCount > 0 (EB5)_
    - _Preservation: localStorage mode still computes needsReply in getAllConversations — no change_
    - _Requirements: 2.5_

  - [x] 3.8 Pass actual `customerName` in `getMessagesByCustomer` (chatService.js + ChatWidget.jsx)
    - In `src/services/chatService.js`, update `getMessagesByCustomer` signature to accept an optional second parameter: `getMessagesByCustomer(customerId, customerName = "")`
    - In the `USE_BACKEND` branch, change `createOrGetConversation(customerId, "")` to `createOrGetConversation(customerId, customerName || customerId)`
    - In `src/components/shared/ChatWidget.jsx`, update the call site from `getMessagesByCustomer(user.id)` to `getMessagesByCustomer(user.id, user.name)`
    - The localStorage path in `getMessagesByCustomer` must remain completely unchanged
    - _Bug_Condition: isBugCondition(input) where getMessagesByCustomer passes empty customerName (C7)_
    - _Expected_Behavior: expectedBehavior(result) — createOrGetConversation receives actual customerName (EB7)_
    - _Preservation: P1 — localStorage path unchanged_
    - _Requirements: 2.7_

  - [x] 3.9 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Snake_case Field Mismatch & Missing Normalization
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `chatSystemBugCondition.property.test.js` on FIXED code
    - **EXPECTED OUTCOME**: Test PASSES (confirms all 6 bug conditions are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.10 Verify preservation tests still pass
    - **Property 2: Preservation** - localStorage Mode and Backend API Contracts Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `chatSystemPreservation.property.test.js` on FIXED code
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in localStorage mode or API contracts)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite: `cd server && npx vitest --run`
  - Ensure all tests pass, ask the user if questions arise
  - Verify no existing tests were broken by the changes
  - Confirm `chatSystemBugCondition.property.test.js` passes
  - Confirm `chatSystemPreservation.property.test.js` passes
