# Bugfix Requirements Document

## Introduction

The customer ↔ admin/subadmin/owner chat system is broken in backend mode (`VITE_USE_BACKEND=true`). Multiple compounding bugs prevent conversations from loading correctly, messages from rendering with the right data, file messages from being viewable or downloadable, the CS role from marking messages as read, and the activity sidebar from correctly surfacing unhandled chats. The root causes are: a pervasive snake_case/camelCase field name mismatch between the backend API responses and the frontend components, missing `dataUrl`/`file_path` mapping for file messages, an incomplete role check in the mark-as-read trigger, and a `needsReply` field that does not exist in backend responses.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the backend returns a conversation object with fields `customer_id`, `customer_name`, `assigned_admin_id`, `last_at` THEN the system renders the conversation list with blank customer names, missing unread badges, and broken "assigned" status because the frontend reads camelCase fields (`customerId`, `customerName`, `assignedAdminId`) that are `undefined`

1.2 WHEN the backend returns a message object with fields `sender_role`, `file_name`, `file_size`, `mime_type`, `file_path`, `read_at`, `created_at` THEN the system renders message bubbles with no timestamp, no file name, and no file size because the frontend reads camelCase fields (`senderRole`, `fileName`, `fileSize`, `mimeType`, `createdAt`) that are `undefined`

1.3 WHEN a staff user (admin, owner, or CS) views a file message sent in backend mode THEN the system displays the file attachment without any "View" or "Download" link because `MessageBubble` checks `msg.dataUrl` which is never populated from the backend — the server returns `file_path` instead

1.4 WHEN the active conversation is viewed by a CS staff member THEN the system never calls `markAsRead` because the trigger condition only checks for `admin` and `owner` roles, excluding `cs`

1.5 WHEN the activity sidebar loads in backend mode THEN the system always shows "Semua chat sudah ditangani" (no unhandled chats) because it filters by `c.needsReply === true`, a field that does not exist in backend API responses — the backend returns `unread_count` instead

1.6 WHEN `ChatsSection.jsx` calls `sendMessage` with `customerId: conv.customerId` in backend mode THEN the system fails to resolve the conversation because `conv.customerId` is `undefined` (the backend field is `customer_id`), causing the file or text message send to fail silently or create a duplicate conversation with no name

1.7 WHEN `getMessagesByCustomer` is called in backend mode THEN the system calls `createOrGetConversation(customerId, "")` with an empty string as `customerName`, which creates a conversation record in the database with a blank `customer_name`

### Expected Behavior (Correct)

2.1 WHEN the backend returns a conversation object with snake_case fields THEN the system SHALL normalize the response to camelCase (`customer_id` → `customerId`, `customer_name` → `customerName`, `assigned_admin_id` → `assignedAdminId`, `last_at` → `lastAt`) before storing or rendering, so conversation names, unread badges, and assigned status display correctly

2.2 WHEN the backend returns a message object with snake_case fields THEN the system SHALL normalize the response to camelCase (`sender_role` → `senderRole`, `file_name` → `fileName`, `file_size` → `fileSize`, `mime_type` → `mimeType`, `file_path` → `filePath`, `read_at` → `readAt`, `created_at` → `createdAt`) before rendering, so message bubbles display the correct timestamp, sender alignment, file name, and file size

2.3 WHEN a file message is loaded from the backend and `filePath` is present THEN the system SHALL use `filePath` as the `href` for the "View" and "Download" links in `MessageBubble`, so staff and customers can open or download attached files

2.4 WHEN the active conversation is viewed by a staff member with role `cs` THEN the system SHALL call `markAsRead` in the same way it does for `admin` and `owner`, so CS staff can clear unread message counts

2.5 WHEN the activity sidebar loads in backend mode THEN the system SHALL determine unhandled chats by checking `c.unreadCount > 0` (derived from the backend's `unread_count` field after normalization) instead of `c.needsReply === true`, so the sidebar correctly surfaces conversations with unread customer messages

2.6 WHEN `ChatsSection.jsx` calls `sendMessage` in backend mode THEN the system SHALL pass `conv.customerId` using the normalized camelCase field so the conversation is resolved correctly and the message is sent to the right conversation

2.7 WHEN `getMessagesByCustomer` is called in backend mode and the user's name is available THEN the system SHALL pass the actual customer name (not an empty string) to `createOrGetConversation` so the conversation record is created with a valid `customer_name`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `VITE_USE_BACKEND=false` (localStorage mode) THEN the system SHALL CONTINUE TO use the existing localStorage-backed chat implementation without any changes to its behavior

3.2 WHEN a customer sends a text message in backend mode THEN the system SHALL CONTINUE TO post to `POST /api/conversations/:id/messages` and receive a `201` response with the saved message

3.3 WHEN a customer or staff sends a file message in backend mode THEN the system SHALL CONTINUE TO post to `POST /api/conversations/:id/messages/file` with `multipart/form-data` and the file stored under `server/uploads/chat/`

3.4 WHEN a staff member (admin, owner, cs) loads the conversations list THEN the system SHALL CONTINUE TO call `GET /api/conversations` and display all conversations sorted by `last_at` descending

3.5 WHEN a customer opens the chat widget THEN the system SHALL CONTINUE TO call `POST /api/conversations` to get or create their conversation and then load messages via `GET /api/conversations/:id/messages`

3.6 WHEN a new message is saved via the REST API THEN the system SHALL CONTINUE TO emit a `message:new` Socket.io event to the relevant conversation room and the `staff` room for real-time delivery

3.7 WHEN the Socket.io server authenticates a connection THEN the system SHALL CONTINUE TO verify the JWT access token and assign the socket to the correct rooms (`customer:<id>`, `conversation:<id>`, or `staff`)

3.8 WHEN a file larger than 5 MB or of an unsupported MIME type is uploaded THEN the system SHALL CONTINUE TO reject the upload with a `413` or `415` error respectively
