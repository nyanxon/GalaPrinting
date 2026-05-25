# Requirements Document

## Introduction

The Enhanced Chat System extends the existing Gala Printing chat feature in three directions:

1. **Broadened staff access to customer conversations** — all sub-admin roles (cashier, operational, qc, offline, cs) gain the same ability to view and reply to customer conversations that admin and cs already have.
2. **Staff-to-staff direct messaging (DM)** — any authenticated staff member can open a private 1-on-1 conversation with any other staff member, independent of the customer conversation system.
3. **Staff-initiated customer conversations** — admin and all sub-admin roles can search for a registered customer and start a new conversation on the customer's behalf, removing the current restriction that only customers can initiate chats.

The existing system uses Express + MySQL (`conversations` and `messages` tables), React (`ChatsSection.jsx`, `ChatWidget.jsx`, `chatService.js`), and Socket.io for real-time delivery.

---

## Glossary

- **Chat_System**: The combined backend and frontend responsible for all real-time messaging in the Gala Printing web application.
- **Customer_Conversation**: A conversation record in the `conversations` table that links exactly one registered customer to the staff team (1 customer = 1 conversation, existing constraint preserved).
- **DM_Conversation**: A new conversation record that links exactly two staff members in a private 1-on-1 direct message thread.
- **Staff**: Any authenticated user whose role is one of: `admin`, `owner`, `cashier`, `cs`, `operational`, `qc`, `offline`.
- **Sub_Admin**: A Staff member whose role is one of: `cashier`, `cs`, `operational`, `qc`, `offline`.
- **Admin**: A Staff member whose role is `admin` or `owner`.
- **Customer**: An authenticated user whose role is `customer`.
- **Conversation_Room**: A Socket.io room identified by `conversation:{id}` used to broadcast real-time message events to all participants of that conversation.
- **Staff_Room**: The Socket.io room named `staff` that all connected Staff members join on connection.
- **Message**: A record in the `messages` table representing a single text or file payload sent within a conversation.
- **Unread_Count**: The number of Messages in a conversation sent by the other party that have a `read_at` value of NULL.
- **ChatsSection**: The React component rendered inside staff dashboards that displays the conversation list and message thread.
- **ChatWidget**: The React component rendered in the customer-facing storefront for customer-initiated chat.
- **DM_Section**: A new React component rendered inside staff dashboards for staff-to-staff direct messaging.
- **Conversation_Type**: A discriminator field (`customer_chat` or `staff_dm`) added to the `conversations` table to distinguish Customer_Conversations from DM_Conversations.

---

## Requirements

### Requirement 1: All Sub-Admins Can View and Reply to Customer Conversations

**User Story:** As a sub-admin (cashier, operational, qc, offline, cs), I want to view and reply to customer conversations in my dashboard, so that I can assist customers without needing to escalate every query to a CS or admin.

#### Acceptance Criteria

1. THE Chat_System SHALL expose the customer conversation list to all Staff roles (admin, owner, cashier, cs, operational, qc, offline).
2. WHEN a Staff member sends a message in a Customer_Conversation, THE Chat_System SHALL persist the message with the sender's actual role stored in `sender_role`.
3. WHEN a Staff member opens a Customer_Conversation, THE Chat_System SHALL mark all unread Customer messages in that conversation as read.
4. THE Chat_System SHALL render the ChatsSection component in the dashboard of every Sub_Admin role (cashier, operational, qc, offline) in addition to the existing cs and admin dashboards.
5. WHEN a Sub_Admin accesses the customer conversation list endpoint (`GET /api/conversations`), THE Chat_System SHALL return HTTP 200 with the full conversation list.
6. IF a Sub_Admin attempts to access a Customer_Conversation that belongs to a different customer, THEN THE Chat_System SHALL return HTTP 403.
7. WHEN a Staff member is connected via Socket.io, THE Chat_System SHALL add that Staff member's socket to the Staff_Room and to all existing Conversation_Rooms for Customer_Conversations.
8. WHEN a new Customer_Conversation is created while Staff members are connected, THE Chat_System SHALL add all connected Staff sockets to the new Conversation_Room.

---

### Requirement 2: Staff-to-Staff Direct Messaging

**User Story:** As a staff member, I want to send direct messages to any other staff member, so that I can coordinate internally without using external messaging tools.

#### Acceptance Criteria

1. THE Chat_System SHALL support a DM_Conversation type that links exactly two Staff members identified by their user IDs.
2. WHEN a Staff member initiates a DM with another Staff member, THE Chat_System SHALL create a DM_Conversation if one does not already exist between those two users, or return the existing DM_Conversation if one does.
3. THE Chat_System SHALL enforce that a DM_Conversation contains exactly two participants, both of whom must have a Staff role.
4. IF a user attempts to create a DM_Conversation with a participant whose role is `customer`, THEN THE Chat_System SHALL return HTTP 422 with a descriptive error message.
5. IF a user attempts to create a DM_Conversation with themselves as both participants, THEN THE Chat_System SHALL return HTTP 422 with a descriptive error message.
6. WHEN a Staff member sends a message in a DM_Conversation, THE Chat_System SHALL persist the message and update the conversation's `last_at` timestamp.
7. WHEN a Staff member sends a message in a DM_Conversation, THE Chat_System SHALL emit a `message:new` Socket.io event to the Conversation_Room for that DM_Conversation.
8. WHEN a Staff member connects via Socket.io, THE Chat_System SHALL add that Staff member's socket to all Conversation_Rooms for DM_Conversations in which that Staff member is a participant.
9. THE Chat_System SHALL render a DM_Section component in every Staff dashboard that lists all DM_Conversations for the authenticated Staff member, sorted by `last_at` descending.
10. WHEN a Staff member opens a DM_Conversation in the DM_Section, THE Chat_System SHALL mark all unread messages from the other participant as read.
11. THE DM_Section SHALL display the name and role of the other participant for each DM_Conversation in the list.
12. THE Chat_System SHALL provide a staff directory within the DM_Section that lists all Staff members, so that a Staff member can select a recipient and start a new DM_Conversation.
13. WHEN a Staff member searches the staff directory by name, THE Chat_System SHALL return only Staff members whose names contain the search string (case-insensitive).
14. THE Chat_System SHALL support sending text messages and file attachments (PDF, PNG, JPG, JPEG, ZIP; maximum 5 MB) within DM_Conversations, using the same file validation rules as Customer_Conversations.

---

### Requirement 3: Staff-Initiated Customer Conversations

**User Story:** As an admin or sub-admin, I want to start a new chat with a registered customer who has never initiated a conversation, so that I can proactively reach out to customers about their orders or inquiries.

#### Acceptance Criteria

1. WHEN an Admin or Sub_Admin submits a request to start a conversation with a specific customer, THE Chat_System SHALL create a new Customer_Conversation for that customer if one does not already exist, or return the existing Customer_Conversation if one does.
2. THE Chat_System SHALL provide a customer search interface within the ChatsSection that allows Staff to search registered customers by name or phone number.
3. WHEN a Staff member searches for customers by name or phone number, THE Chat_System SHALL return only users whose role is `customer` and whose name or phone number contains the search string (case-insensitive).
4. WHEN a Staff member selects a customer from the search results and initiates a conversation, THE Chat_System SHALL open the Customer_Conversation in the ChatsSection message view.
5. IF a Staff member attempts to initiate a conversation with a user whose role is not `customer`, THEN THE Chat_System SHALL return HTTP 422 with a descriptive error message.
6. WHEN a Staff member sends the first message in a staff-initiated Customer_Conversation, THE Chat_System SHALL persist the message with the Staff member's role in `sender_role` and emit a `message:new` Socket.io event to the customer's personal Socket.io room (`customer:{customerId}`).
7. WHEN a staff-initiated Customer_Conversation is created, THE Chat_System SHALL add all connected Staff sockets to the new Conversation_Room.
8. WHEN a Customer connects via Socket.io after a staff-initiated conversation has been created for them, THE Chat_System SHALL add that Customer's socket to the corresponding Conversation_Room.

---

### Requirement 4: Database Schema Extension

**User Story:** As a developer, I want the database schema to support both customer conversations and staff DM conversations, so that both conversation types share the same message infrastructure without ambiguity.

#### Acceptance Criteria

1. THE Chat_System SHALL add a `conversation_type` column to the `conversations` table with allowed values `customer_chat` and `staff_dm`, defaulting to `customer_chat`.
2. THE Chat_System SHALL add a `dm_participant_a` column (CHAR(36), nullable) and a `dm_participant_b` column (CHAR(36), nullable) to the `conversations` table to store the two participants of a DM_Conversation.
3. WHEN a DM_Conversation is created, THE Chat_System SHALL store the two participant IDs in `dm_participant_a` and `dm_participant_b` in a canonical order (lower UUID first) to prevent duplicate DM_Conversations.
4. THE Chat_System SHALL enforce a unique constraint on (`dm_participant_a`, `dm_participant_b`) for rows where `conversation_type = 'staff_dm'`, so that at most one DM_Conversation exists between any two Staff members.
5. THE Chat_System SHALL preserve the existing `customer_id` and `assigned_admin_id` columns and their foreign key constraints for backward compatibility with Customer_Conversations.
6. FOR ALL existing conversation records in the database, THE Chat_System SHALL set `conversation_type` to `customer_chat` during migration.

---

### Requirement 5: API Access Control

**User Story:** As a system architect, I want all new and modified API endpoints to enforce role-based access control, so that only authorised users can perform each action.

#### Acceptance Criteria

1. THE Chat_System SHALL restrict the `GET /api/conversations` endpoint to Staff roles only (admin, owner, cashier, cs, operational, qc, offline); Customers SHALL receive HTTP 403.
2. THE Chat_System SHALL restrict the `POST /api/conversations/dm` endpoint (create or get DM_Conversation) to Staff roles only; Customers SHALL receive HTTP 403.
3. THE Chat_System SHALL restrict the `GET /api/conversations/dm` endpoint (list DM_Conversations for the authenticated Staff member) to Staff roles only; Customers SHALL receive HTTP 403.
4. THE Chat_System SHALL restrict the `GET /api/staff` endpoint (staff directory for DM recipient selection) to Staff roles only; Customers SHALL receive HTTP 403.
5. WHEN a Customer calls `POST /api/conversations`, THE Chat_System SHALL create or return the Customer_Conversation for that Customer's own user ID.
6. WHEN a Staff member calls `POST /api/conversations` with a `customerId` body parameter, THE Chat_System SHALL create or return the Customer_Conversation for the specified customer.
7. THE Chat_System SHALL restrict the `DELETE /api/conversations/:id` endpoint to Admin roles only (admin, owner); Sub_Admins SHALL receive HTTP 403.
8. WHEN a Staff member calls `PATCH /api/conversations/:id/read`, THE Chat_System SHALL accept the request for any conversation (Customer_Conversation or DM_Conversation) in which that Staff member is a participant.

---

### Requirement 6: Real-Time Delivery

**User Story:** As a user (staff or customer), I want messages to appear in real time without refreshing the page, so that conversations feel immediate and responsive.

#### Acceptance Criteria

1. WHEN a message is saved to a Customer_Conversation, THE Chat_System SHALL emit a `message:new` Socket.io event to the Conversation_Room and to the Staff_Room within 500 ms of the HTTP response being sent.
2. WHEN a message is saved to a DM_Conversation, THE Chat_System SHALL emit a `message:new` Socket.io event to the Conversation_Room for that DM_Conversation within 500 ms of the HTTP response being sent.
3. WHEN a Staff member marks a conversation as read, THE Chat_System SHALL emit a `conversation:read` Socket.io event to the Conversation_Room containing the `conversationId` and `readAt` timestamp.
4. WHEN a new Customer_Conversation is created by a Staff member, THE Chat_System SHALL emit a `conversation:new` Socket.io event to the Staff_Room so that all connected Staff dashboards can update their conversation list.
5. WHEN a new DM_Conversation is created, THE Chat_System SHALL emit a `dm:new` Socket.io event to the personal rooms of both participants (`staff:{userId}`) so that both parties' DM lists update in real time.
6. WHILE a Staff member's socket is connected, THE Chat_System SHALL maintain that Staff member's socket membership in all Conversation_Rooms for conversations in which that Staff member is a participant.

---

### Requirement 7: Frontend — ChatsSection Enhancements

**User Story:** As a sub-admin, I want the chat panel in my dashboard to let me search for customers and start new conversations, so that I can proactively contact customers without leaving my dashboard.

#### Acceptance Criteria

1. THE ChatsSection SHALL render a "Mulai Chat Baru" (Start New Chat) button visible to all Staff roles.
2. WHEN a Staff member clicks "Mulai Chat Baru", THE ChatsSection SHALL display a customer search input field.
3. WHEN a Staff member types at least 2 characters into the customer search input, THE ChatsSection SHALL call the customer search API and display matching customer names and phone numbers.
4. WHEN a Staff member selects a customer from the search results, THE ChatsSection SHALL call the conversation creation API and open the resulting conversation in the message view.
5. IF the customer search returns no results, THE ChatsSection SHALL display the message "Tidak ada customer ditemukan." in the search results area.
6. THE ChatsSection SHALL display an Unread_Count badge on each conversation list item where the Unread_Count is greater than zero.
7. WHEN a Staff member opens a conversation, THE ChatsSection SHALL call the mark-as-read API and clear the Unread_Count badge for that conversation.
8. WHEN a `message:new` Socket.io event is received, THE ChatsSection SHALL refresh the conversation list and the active message thread without a full page reload.

---

### Requirement 8: Frontend — DM Section

**User Story:** As a staff member, I want a dedicated direct message panel in my dashboard, so that I can communicate privately with colleagues without mixing staff messages into customer conversations.

#### Acceptance Criteria

1. THE DM_Section SHALL render a list of all DM_Conversations for the authenticated Staff member, sorted by `last_at` descending.
2. THE DM_Section SHALL display the name, role, and Unread_Count for each DM_Conversation in the list.
3. WHEN a Staff member clicks a DM_Conversation in the list, THE DM_Section SHALL load and display all messages for that conversation in chronological order.
4. THE DM_Section SHALL render a "Pesan Baru" (New Message) button that opens a staff directory search panel.
5. WHEN a Staff member types at least 2 characters into the staff directory search input, THE DM_Section SHALL display matching staff members by name (excluding the authenticated user).
6. WHEN a Staff member selects a recipient from the staff directory, THE DM_Section SHALL call the DM creation API and open the resulting DM_Conversation in the message view.
7. THE DM_Section SHALL support sending text messages (maximum 1000 characters) and file attachments (PDF, PNG, JPG, JPEG, ZIP; maximum 5 MB) within DM_Conversations.
8. WHEN a `message:new` Socket.io event is received for a DM_Conversation, THE DM_Section SHALL refresh the DM list and the active message thread without a full page reload.
9. WHEN a `dm:new` Socket.io event is received, THE DM_Section SHALL add the new DM_Conversation to the list without a full page reload.
10. IF a Staff member attempts to send an empty text message, THEN THE DM_Section SHALL display the validation error "Pesan tidak boleh kosong." and SHALL NOT submit the message.

---

### Requirement 9: Message and File Validation

**User Story:** As a developer, I want all message inputs to be validated consistently on both client and server, so that invalid data never reaches the database.

#### Acceptance Criteria

1. WHEN a text message is submitted, THE Chat_System SHALL reject messages where the trimmed content length is zero and return HTTP 422 with the message "Pesan tidak boleh kosong."
2. WHEN a text message is submitted, THE Chat_System SHALL reject messages where the trimmed content length exceeds 1000 characters and return HTTP 422 with a descriptive error message.
3. WHEN a file message is submitted, THE Chat_System SHALL reject files whose MIME type is not one of: `application/pdf`, `image/png`, `image/jpeg`, `application/zip`, `application/x-zip-compressed`, and return HTTP 422 with a descriptive error message.
4. WHEN a file message is submitted, THE Chat_System SHALL reject files whose size exceeds 5,242,880 bytes (5 MB) and return HTTP 422 with a descriptive error message.
5. FOR ALL valid text messages, THE Chat_System SHALL store the HTML-escaped content in the `content` column of the `messages` table.
6. THE Chat_System SHALL validate message content on the server regardless of client-side validation results.
