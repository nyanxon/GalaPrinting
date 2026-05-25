# Design Document — Chat System Fix

## Overview

The customer ↔ admin/subadmin/owner chat system has seven compounding bugs that only manifest when `VITE_USE_BACKEND=true`. The root causes are: (1) a pervasive snake_case/camelCase field name mismatch between backend API responses and frontend components, (2) missing `dataUrl`/`file_path` mapping for file messages, (3) an incomplete role check in the mark-as-read trigger, (4) a `needsReply` field that does not exist in backend responses, (5) `conv.customerId` being `undefined` when sending messages, and (6) `getMessagesByCustomer` passing an empty string as `customerName` to `createOrGetConversation`.

All fixes are confined to the frontend service layer (`chatService.js`) and two dashboard components (`AdminDashboardPage.jsx`, `OwnerDashboardPage.jsx`) plus `ChatsSection.jsx`. The localStorage path (`VITE_USE_BACKEND=false`) is completely unchanged.

---

## Bug Condition

### isBugCondition(input)

A request is in the bug condition when **any** of the following is true:

```
isBugCondition(input) ≡
  (USE_BACKEND = true) AND (
    // C1: Conversation field mismatch
    (input is a conversation object from GET /api/conversations
     AND input has snake_case fields: customer_id, customer_name, assigned_admin_id, last_at
     AND frontend reads camelCase: customerId, customerName, assignedAdminId, lastAt)
    OR
    // C2: Message field mismatch
    (input is a message object from GET /api/conversations/:id/messages
     AND input has snake_case fields: sender_role, file_name, file_size, mime_type, file_path, read_at, created_at
     AND frontend reads camelCase: senderRole, fileName, fileSize, mimeType, filePath, readAt, createdAt)
    OR
    // C3: File message missing dataUrl
    (input is a file message from backend
     AND input.file_path is present
     AND MessageBubble checks msg.dataUrl which is undefined)
    OR
    // C4: CS role excluded from markAsRead
    (input.user.role = 'cs'
     AND ChatsSection only calls markAsRead for 'admin' | 'owner')
    OR
    // C5: needsReply field absent in backend response
    (input is a conversation from GET /api/conversations
     AND ActivitySidebar filters by c.needsReply === true
     AND backend returns unread_count, not needsReply)
    OR
    // C6: conv.customerId undefined when sending
    (input is a send-message call from ChatsSection
     AND conv.customerId is undefined because backend returns customer_id)
    OR
    // C7: empty customerName in createOrGetConversation
    (getMessagesByCustomer is called in backend mode
     AND createOrGetConversation is called with customerName = "")
  )
```

---

## Expected Behavior

### expectedBehavior(result)

```
expectedBehavior(result) ≡
  // EB1: Conversation normalization
  (result.customerId    = snake_input.customer_id)
  AND (result.customerName   = snake_input.customer_name)
  AND (result.assignedAdminId = snake_input.assigned_admin_id)
  AND (result.lastAt         = snake_input.last_at)
  AND (result.unreadCount    = snake_input.unread_count)

  // EB2: Message normalization
  AND (result.senderRole  = snake_input.sender_role)
  AND (result.fileName    = snake_input.file_name)
  AND (result.fileSize    = snake_input.file_size)
  AND (result.mimeType    = snake_input.mime_type)
  AND (result.filePath    = snake_input.file_path)
  AND (result.readAt      = snake_input.read_at)
  AND (result.createdAt   = snake_input.created_at)

  // EB3: File message viewable
  AND (fileMessage.filePath IS NOT NULL → MessageBubble renders View/Download links using filePath)

  // EB4: CS markAsRead
  AND (user.role IN ['admin', 'owner', 'cs'] → markAsRead is called)

  // EB5: Activity sidebar unhandled chats
  AND (ActivitySidebar filters by c.unreadCount > 0, not c.needsReply === true)

  // EB6: sendMessage uses normalized customerId
  AND (ChatsSection.sendMessage passes conv.customerId from normalized conversation)

  // EB7: createOrGetConversation receives actual customerName
  AND (getMessagesByCustomer passes user.name, not "", to createOrGetConversation)
```

---

## Preservation Requirements

### Non-Buggy Inputs (¬C(X))

When `VITE_USE_BACKEND=false` (localStorage mode), none of the above bug conditions apply. The localStorage path must be completely unchanged.

```
preservationCondition(input) ≡
  (USE_BACKEND = false)
  OR (input is a valid localStorage-mode operation)
```

### Preservation Properties

```
P1: localStorage chat operations are unchanged
  For all inputs where USE_BACKEND = false:
    getAllConversations() returns localStorage data unchanged
    sendMessage() writes to localStorage unchanged
    getMessagesByCustomer() reads from localStorage unchanged
    markAsRead() updates localStorage unchanged

P2: Backend REST API calls are preserved
  For all inputs where USE_BACKEND = true:
    POST /api/conversations still called to get/create conversation
    GET /api/conversations still called to list conversations
    GET /api/conversations/:id/messages still called to get messages
    POST /api/conversations/:id/messages still called for text messages
    POST /api/conversations/:id/messages/file still called for file messages
    PATCH /api/conversations/:id/read still called for markAsRead

P3: File upload validation is preserved
  For all file inputs:
    Files > 5 MB are rejected with appropriate error
    Files with unsupported MIME types are rejected with appropriate error

P4: Socket.io real-time events are preserved
  message:new events still dispatched as gala:message-new DOM events
  Socket authentication and room assignment unchanged

P5: Text message send flow is preserved
  For all text messages in backend mode:
    Content is trimmed and HTML-escaped before sending
    Empty messages are rejected
    POST /api/conversations/:id/messages returns 201 with saved message
```

---

## Implementation Plan

### Fix 1 — Normalize conversation fields in `getAllConversations` (chatService.js)

**File:** `src/services/chatService.js`

In the `USE_BACKEND` branch of `getAllConversations`, map the raw API response to camelCase:

```js
export async function getAllConversations() {
  if (USE_BACKEND) {
    const res = await api.get("/api/conversations");
    const raw = res.data.data ?? res.data.items ?? [];
    return raw.map((c) => ({
      ...c,
      customerId:      c.customer_id      ?? c.customerId,
      customerName:    c.customer_name    ?? c.customerName,
      assignedAdminId: c.assigned_admin_id ?? c.assignedAdminId,
      lastAt:          c.last_at          ?? c.lastAt,
      unreadCount:     c.unread_count     ?? c.unreadCount ?? 0,
    }));
  }
  // ... localStorage path unchanged
}
```

**Addresses:** Bug 1.1, 1.5, 1.6 (customerId now defined), 2.1, 2.5, 2.6

---

### Fix 2 — Normalize message fields in `getMessagesByConversation` (chatService.js)

**File:** `src/services/chatService.js`

In the `USE_BACKEND` branch of `getMessagesByConversation`, map the raw API response to camelCase:

```js
export async function getMessagesByConversation(convId) {
  if (USE_BACKEND) {
    const res = await api.get(`/api/conversations/${convId}/messages`);
    const raw = res.data.data ?? res.data.items ?? [];
    return raw.map((m) => ({
      ...m,
      senderRole: m.sender_role ?? m.senderRole,
      fileName:   m.file_name   ?? m.fileName,
      fileSize:   m.file_size   ?? m.fileSize,
      mimeType:   m.mime_type   ?? m.mimeType,
      filePath:   m.file_path   ?? m.filePath,
      readAt:     m.read_at     ?? m.readAt,
      createdAt:  m.created_at  ?? m.createdAt,
    }));
  }
  // ... localStorage path unchanged
}
```

**Addresses:** Bug 1.2, 2.2

---

### Fix 3 — Use `filePath` for file message View/Download links (ChatsSection.jsx + ChatWidget.jsx)

**Files:** `src/components/pages/admin/sections/ChatsSection.jsx`, `src/components/shared/ChatWidget.jsx`

In `MessageBubble`, use `msg.filePath` as fallback when `msg.dataUrl` is absent:

```jsx
// Before:
{msg.dataUrl && (
  <div className="chat-file-actions">
    {isImage && <a href={msg.dataUrl} ...>🔍 Lihat</a>}
    <a href={msg.dataUrl} download={msg.fileName || 'file'}>⬇️ Download</a>
  </div>
)}

// After:
{(msg.dataUrl || msg.filePath) && (
  <div className="chat-file-actions">
    {isImage && <a href={msg.dataUrl || msg.filePath} ...>🔍 Lihat</a>}
    <a href={msg.dataUrl || msg.filePath} download={msg.fileName || 'file'}>⬇️ Download</a>
  </div>
)}
```

**Addresses:** Bug 1.3, 2.3

---

### Fix 4 — Include `cs` role in markAsRead trigger (ChatsSection.jsx)

**File:** `src/components/pages/admin/sections/ChatsSection.jsx`

```jsx
// Before:
if (user?.role === 'admin' || user?.role === 'owner') {
  markAsRead(activeConvId, user.role);
}

// After:
if (user?.role === 'admin' || user?.role === 'owner' || user?.role === 'cs') {
  markAsRead(activeConvId, user.role);
}
```

**Addresses:** Bug 1.4, 2.4

---

### Fix 5 — Replace `needsReply` with `unreadCount > 0` in activity sidebars

**Files:** `src/components/pages/admin/AdminDashboardPage.jsx`, `src/components/pages/owner/OwnerDashboardPage.jsx`

```jsx
// Before:
.filter((c) => c.needsReply === true)

// After:
.filter((c) => (c.unreadCount ?? 0) > 0)
```

**Addresses:** Bug 1.5, 2.5

---

### Fix 6 — Pass actual `customerName` in `getMessagesByCustomer` (chatService.js)

**File:** `src/services/chatService.js`

The `getMessagesByCustomer` function currently calls `createOrGetConversation(customerId, "")` with an empty string. The caller (ChatWidget) has access to `user.name`. The fix is to accept an optional `customerName` parameter:

```js
// Before:
export async function getMessagesByCustomer(customerId) {
  if (USE_BACKEND) {
    const conv = await createOrGetConversation(customerId, "");
    ...
  }
}

// After:
export async function getMessagesByCustomer(customerId, customerName = "") {
  if (USE_BACKEND) {
    const conv = await createOrGetConversation(customerId, customerName || customerId);
    ...
  }
}
```

And update the call site in `ChatWidget.jsx`:

```jsx
// Before:
const msgs = await getMessagesByCustomer(user.id);

// After:
const msgs = await getMessagesByCustomer(user.id, user.name);
```

**Addresses:** Bug 1.7, 2.7

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/chatService.js` | Normalize conversation fields (Fix 1), normalize message fields (Fix 2), add `customerName` param to `getMessagesByCustomer` (Fix 6) |
| `src/components/pages/admin/sections/ChatsSection.jsx` | Use `filePath` fallback in `MessageBubble` (Fix 3), add `cs` to markAsRead trigger (Fix 4) |
| `src/components/shared/ChatWidget.jsx` | Use `filePath` fallback in `MessageBubble` (Fix 3), pass `user.name` to `getMessagesByCustomer` (Fix 6) |
| `src/components/pages/admin/AdminDashboardPage.jsx` | Replace `needsReply === true` with `unreadCount > 0` (Fix 5) |
| `src/components/pages/owner/OwnerDashboardPage.jsx` | Replace `needsReply === true` with `unreadCount > 0` (Fix 5) |
