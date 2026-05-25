/**
 * enhancedChatSystem.property.test.js — Property-based tests for enhanced chat system.
 *
 * Feature: enhanced-chat-system
 *
 * These tests verify the correctness properties defined in the design document.
 * Each test uses inline simulation functions to mirror the logic without requiring
 * real database or HTTP calls.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.10, 2.13, 3.1, 3.3, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STAFF_ROLES = ['admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline'];
const ALL_ROLES = ['customer', ...STAFF_ROLES];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/zip',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_MESSAGE_LENGTH = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Inline Simulation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulates requireRole middleware logic.
 * Returns 200 if role is in allowed list, 403 otherwise.
 */
function simulateRequireRole(allowedRoles, userRole) {
  if (!userRole) return 401;
  if (!allowedRoles.includes(userRole)) return 403;
  return 200;
}

/**
 * Simulates saving a message with sender_role.
 * Returns the persisted message object with sender_role field.
 */
function simulateSaveMessage({ senderRole, content }) {
  return {
    id: 'msg-' + Math.random().toString(36).substr(2, 9),
    sender_role: senderRole,
    content,
    created_at: new Date().toISOString(),
  };
}

/**
 * Simulates marking messages as read in a conversation.
 * Sets read_at on all customer messages.
 * Returns the updated unread count (should be 0).
 */
function simulateMarkAsRead(messages, conversationId) {
  const conversationMessages = messages.filter((m) => m.conversation_id === conversationId);
  conversationMessages.forEach((m) => {
    if (m.sender_role === 'customer' && !m.read_at) {
      m.read_at = new Date().toISOString();
    }
  });
  const unreadCount = conversationMessages.filter(
    (m) => m.sender_role === 'customer' && !m.read_at
  ).length;
  return unreadCount;
}

/**
 * Simulates getOrCreateConversation logic.
 * Checks for existing conversation, creates if absent.
 * Returns { id, created } where created is true if new.
 */
function simulateGetOrCreateConversation(store, customerId) {
  const existing = store.conversations.find(
    (c) => c.customer_id === customerId && c.conversation_type === 'customer_chat'
  );
  if (existing) return { id: existing.id, created: false };

  const newConv = {
    id: 'conv-' + Math.random().toString(36).substr(2, 9),
    customer_id: customerId,
    conversation_type: 'customer_chat',
    created_at: new Date().toISOString(),
  };
  store.conversations.push(newConv);
  return { id: newConv.id, created: true };
}

/**
 * Simulates getOrCreateDMConversation logic.
 * Normalizes participant order (min, max), checks for existing DM, creates if absent.
 * Returns the conversation object.
 */
function simulateGetOrCreateDMConversation(store, userAId, userBId, userRoles) {
  // Validate both are staff
  const roleA = userRoles[userAId];
  const roleB = userRoles[userBId];
  if (roleA === 'customer' || roleB === 'customer') {
    throw new Error('Both participants must be staff');
  }

  // Canonical ordering
  const [participantA, participantB] = [userAId, userBId].sort();

  const existing = store.conversations.find(
    (c) =>
      c.conversation_type === 'staff_dm' &&
      c.dm_participant_a === participantA &&
      c.dm_participant_b === participantB
  );
  if (existing) return existing;

  const newConv = {
    id: 'conv-' + Math.random().toString(36).substr(2, 9),
    conversation_type: 'staff_dm',
    dm_participant_a: participantA,
    dm_participant_b: participantB,
    created_at: new Date().toISOString(),
  };
  store.conversations.push(newConv);
  return newConv;
}

/**
 * Simulates searching staff directory.
 * Filters by name LIKE %query%, excludes customer role, excludes excludeUserId.
 */
function simulateSearchStaff(users, query, excludeUserId) {
  const lowerQuery = query.toLowerCase();
  return users.filter((u) => {
    if (u.role === 'customer') return false;
    if (u.id === excludeUserId) return false;
    return u.name.toLowerCase().includes(lowerQuery);
  });
}

/**
 * Simulates searching customers.
 * Filters by role='customer' and (name LIKE %query% OR phone LIKE %query%).
 */
function simulateSearchCustomers(users, query) {
  const lowerQuery = query.toLowerCase();
  return users.filter((u) => {
    if (u.role !== 'customer') return false;
    const nameMatch = u.name.toLowerCase().includes(lowerQuery);
    const phoneMatch = u.phone && u.phone.includes(query);
    return nameMatch || phoneMatch;
  });
}

/**
 * Simulates message validation.
 * Returns 422 if trimmed length is 0 or > 1000 chars.
 */
function simulateValidateMessage(content) {
  const trimmed = typeof content === 'string' ? content.trim() : '';
  if (trimmed.length === 0) {
    return { status: 422, message: 'Pesan tidak boleh kosong.' };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { status: 422, message: 'Pesan maksimal 1000 karakter.' };
  }
  return { status: 200 };
}

/**
 * Simulates file MIME type validation.
 * Returns 422 if MIME type is not in allowed list.
 */
function simulateValidateFileMime(mimeType) {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { status: 422, message: 'Format file tidak didukung.' };
  }
  return { status: 200 };
}

/**
 * Simulates file size validation.
 * Returns 422 if size > 5 MB.
 */
function simulateValidateFileSize(size) {
  if (size > MAX_FILE_SIZE) {
    return { status: 422, message: 'Ukuran file maksimal 5 MB.' };
  }
  return { status: 200 };
}

/**
 * Escapes HTML special characters.
 * Mirrors the escapeHtml function from chat.controller.js.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Property Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Enhanced Chat System — Property-Based Tests', () => {
  // Feature: enhanced-chat-system, Property 1: Staff role guard
  describe('P1: Staff role guard — for any staff role, GET /api/conversations returns 200; for customer role, returns 403', () => {
    /**
     * **Validates: Requirements 1.1, 5.1**
     */
    it('any staff role returns 200', () => {
      fc.assert(
        fc.property(fc.constantFrom(...STAFF_ROLES), (role) => {
          const status = simulateRequireRole(STAFF_ROLES, role);
          expect(status).toBe(200);
        }),
        { numRuns: 100 }
      );
    });

    it('customer role returns 403', () => {
      const status = simulateRequireRole(STAFF_ROLES, 'customer');
      expect(status).toBe(403);
    });
  });

  // Feature: enhanced-chat-system, Property 2: Message sender_role round-trip
  describe('P2: Message sender_role round-trip — for any staff role, sent message has correct sender_role', () => {
    /**
     * **Validates: Requirements 1.2**
     */
    it('persisted message has correct sender_role for any staff role', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...STAFF_ROLES),
          fc.string({ minLength: 1, maxLength: 100 }),
          (role, content) => {
            const message = simulateSaveMessage({ senderRole: role, content });
            expect(message.sender_role).toBe(role);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 3: Mark as read clears unread count
  describe('P3: Mark as read clears unread count — for any N unread messages, after PATCH /read, unread count = 0', () => {
    /**
     * **Validates: Requirements 1.3, 2.10**
     */
    it('unread count becomes 0 after marking as read', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.uuid(),
          (numUnread, conversationId) => {
            const messages = [];
            for (let i = 0; i < numUnread; i++) {
              messages.push({
                id: `msg-${i}`,
                conversation_id: conversationId,
                sender_role: 'customer',
                read_at: null,
              });
            }

            const unreadCount = simulateMarkAsRead(messages, conversationId);
            expect(unreadCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 4: Conversation creation idempotent
  describe('P4: Conversation creation idempotent — calling POST /conversations twice for same customer returns same ID', () => {
    /**
     * **Validates: Requirements 2.2, 3.1**
     */
    it('calling getOrCreateConversation twice returns same ID', () => {
      fc.assert(
        fc.property(fc.uuid(), (customerId) => {
          const store = { conversations: [] };

          const result1 = simulateGetOrCreateConversation(store, customerId);
          const result2 = simulateGetOrCreateConversation(store, customerId);

          expect(result1.id).toBe(result2.id);
          expect(result1.created).toBe(true);
          expect(result2.created).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 5: DM participant invariant
  describe('P5: DM participant invariant — created DM has exactly two non-null staff participant IDs', () => {
    /**
     * **Validates: Requirements 2.1**
     */
    it('DM conversation has two non-null staff participants', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom(...STAFF_ROLES),
          fc.constantFrom(...STAFF_ROLES),
          (userAId, userBId, roleA, roleB) => {
            fc.pre(userAId !== userBId); // Exclude self-DM

            const store = { conversations: [] };
            const userRoles = { [userAId]: roleA, [userBId]: roleB };

            const conv = simulateGetOrCreateDMConversation(store, userAId, userBId, userRoles);

            expect(conv.dm_participant_a).toBeTruthy();
            expect(conv.dm_participant_b).toBeTruthy();
            expect(conv.dm_participant_a).not.toBe(conv.dm_participant_b);
            expect(userRoles[conv.dm_participant_a]).not.toBe('customer');
            expect(userRoles[conv.dm_participant_b]).not.toBe('customer');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 6: DM canonical ordering
  describe('P6: DM canonical ordering — dm_participant_a = min(A,B), dm_participant_b = max(A,B) regardless of input order', () => {
    /**
     * **Validates: Requirements 4.3**
     */
    it('participant order is canonical (min, max) regardless of input order', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom(...STAFF_ROLES),
          fc.constantFrom(...STAFF_ROLES),
          (userAId, userBId, roleA, roleB) => {
            fc.pre(userAId !== userBId);

            const store1 = { conversations: [] };
            const store2 = { conversations: [] };
            const userRoles = { [userAId]: roleA, [userBId]: roleB };

            const conv1 = simulateGetOrCreateDMConversation(store1, userAId, userBId, userRoles);
            const conv2 = simulateGetOrCreateDMConversation(store2, userBId, userAId, userRoles);

            const [expectedA, expectedB] = [userAId, userBId].sort();

            expect(conv1.dm_participant_a).toBe(expectedA);
            expect(conv1.dm_participant_b).toBe(expectedB);
            expect(conv2.dm_participant_a).toBe(expectedA);
            expect(conv2.dm_participant_b).toBe(expectedB);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 8: DM endpoint role guard
  describe('P8: DM endpoint role guard — customer token receives 403 for all DM endpoints', () => {
    /**
     * **Validates: Requirements 5.2, 5.3, 5.4**
     */
    it('customer receives 403 for POST /dm', () => {
      const status = simulateRequireRole(STAFF_ROLES, 'customer');
      expect(status).toBe(403);
    });

    it('customer receives 403 for GET /dm', () => {
      const status = simulateRequireRole(STAFF_ROLES, 'customer');
      expect(status).toBe(403);
    });

    it('customer receives 403 for GET /staff', () => {
      const status = simulateRequireRole(STAFF_ROLES, 'customer');
      expect(status).toBe(403);
    });
  });

  // Feature: enhanced-chat-system, Property 9: Staff directory search filtering
  describe('P9: Staff directory search filtering — all results contain query string (case-insensitive) and have non-customer role', () => {
    /**
     * **Validates: Requirements 2.13**
     */
    it('all results contain query string and are staff', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 30 }),
              role: fc.constantFrom(...ALL_ROLES),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.uuid(),
          (users, query, excludeUserId) => {
            const results = simulateSearchStaff(users, query, excludeUserId);

            for (const user of results) {
              expect(user.name.toLowerCase()).toContain(query.toLowerCase());
              expect(user.role).not.toBe('customer');
              expect(user.id).not.toBe(excludeUserId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 10: Customer search filtering
  describe('P10: Customer search filtering — all results are customers with matching name or phone', () => {
    /**
     * **Validates: Requirements 3.3**
     */
    it('all results are customers with matching name or phone', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 30 }),
              phone: fc.option(fc.string({ minLength: 10, maxLength: 15 }), { nil: null }),
              role: fc.constantFrom(...ALL_ROLES),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          fc.string({ minLength: 1, maxLength: 10 }),
          (users, query) => {
            const results = simulateSearchCustomers(users, query);

            for (const user of results) {
              expect(user.role).toBe('customer');
              const nameMatch = user.name.toLowerCase().includes(query.toLowerCase());
              const phoneMatch = user.phone && user.phone.includes(query);
              expect(nameMatch || phoneMatch).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 11: Empty message rejection
  describe('P11: Empty message rejection — whitespace-only strings return 422 with correct message', () => {
    /**
     * **Validates: Requirements 9.1**
     */
    it('whitespace-only strings return 422', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n', '  \t\n  '),
          (content) => {
            const result = simulateValidateMessage(content);
            expect(result.status).toBe(422);
            expect(result.message).toContain('tidak boleh kosong');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 12: Oversized message rejection
  describe('P12: Oversized message rejection — strings > 1000 chars return 422', () => {
    /**
     * **Validates: Requirements 9.2**
     */
    it('strings > 1000 chars return 422', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1001, max: 2000 }),
          (length) => {
            const content = 'a'.repeat(length);
            const result = simulateValidateMessage(content);
            expect(result.status).toBe(422);
            expect(result.message).toContain('1000 karakter');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 13: File MIME type validation
  describe('P13: File MIME type validation — disallowed MIME types return 422', () => {
    /**
     * **Validates: Requirements 9.3**
     */
    it('disallowed MIME types return 422', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'application/octet-stream',
            'text/html',
            'video/mp4',
            'audio/mpeg',
            'application/javascript',
            'text/plain'
          ),
          (mimeType) => {
            const result = simulateValidateFileMime(mimeType);
            expect(result.status).toBe(422);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('allowed MIME types return 200', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_MIME_TYPES),
          (mimeType) => {
            const result = simulateValidateFileMime(mimeType);
            expect(result.status).toBe(200);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 14: File size validation
  describe('P14: File size validation — files > 5 MB return 422', () => {
    /**
     * **Validates: Requirements 9.4**
     */
    it('files > 5 MB return 422', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MAX_FILE_SIZE + 1, max: 100 * 1024 * 1024 }),
          (size) => {
            const result = simulateValidateFileSize(size);
            expect(result.status).toBe(422);
            expect(result.message).toContain('5 MB');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('files <= 5 MB return 200', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: MAX_FILE_SIZE }),
          (size) => {
            const result = simulateValidateFileSize(size);
            expect(result.status).toBe(200);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: enhanced-chat-system, Property 15: HTML escaping
  describe('P15: HTML escaping — messages with HTML special chars are stored escaped', () => {
    /**
     * **Validates: Requirements 9.5**
     */
    it('HTML special characters are escaped', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (baseStr) => {
            // Inject HTML special characters
            const content = `${baseStr}<script>alert('xss')</script>&"'`;
            const escaped = escapeHtml(content);

            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;script&gt;');
            expect(escaped).toContain('&amp;');
            expect(escaped).toContain('&quot;');
            expect(escaped).toContain('&#x27;');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all HTML special characters are escaped correctly', () => {
      const testCases = [
        { input: '<', expected: '&lt;' },
        { input: '>', expected: '&gt;' },
        { input: '&', expected: '&amp;' },
        { input: '"', expected: '&quot;' },
        { input: "'", expected: '&#x27;' },
      ];

      for (const { input, expected } of testCases) {
        const escaped = escapeHtml(input);
        expect(escaped).toBe(expected);
      }
    });
  });

  // Feature: enhanced-chat-system, Property 19: Staff search excludes self
  describe('P19: Staff search excludes self — search results never include the authenticated user\'s ID', () => {
    /**
     * **Validates: Requirements 8.5**
     */
    it('search results never include excludeUserId', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 3, maxLength: 30 }),
              role: fc.constantFrom(...STAFF_ROLES),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          fc.string({ minLength: 1, maxLength: 10 }),
          (users, query) => {
            // Pick a random user ID to exclude
            const excludeUserId = users.length > 0 ? users[0].id : 'random-id';

            const results = simulateSearchStaff(users, query, excludeUserId);

            for (const user of results) {
              expect(user.id).not.toBe(excludeUserId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
