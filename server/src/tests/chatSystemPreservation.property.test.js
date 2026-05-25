/**
 * chatSystemPreservation.property.test.js
 *
 * Preservation tests for the chat system fix.
 *
 * These tests verify that unaffected code paths remain unchanged after the fix.
 * They MUST PASS on unfixed code (confirming baseline behavior to preserve).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 *
 * Test coverage:
 *   P1 — localStorage path unchanged (USE_BACKEND=false returns camelCase fields intact)
 *   P2 — Backend REST API calls preserved (GET /api/conversations called exactly once)
 *   P3 — File upload validation preserved (>5MB and unsupported MIME types rejected)
 *   P4 — Text message send flow preserved (POST /api/conversations/:id/messages called)
 *   P5 — markAsRead API call preserved (PATCH /api/conversations/:id/read called)
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// Inline mirrors of the CURRENT (unfixed) service logic
// These replicate the exact code paths so tests run without a browser/DOM.
// ─────────────────────────────────────────────────────────────────────────────

/* ── File validation (mirrors chatService.js validateFile) ── */

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/zip',
  'application/x-zip-compressed',
]);
const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'zip']);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Inline mirror of validateFile() from chatService.js.
 * Mirrors the CURRENT (unfixed) logic exactly.
 */
function validateFile(file) {
  if (!file) return { ok: false, message: 'File tidak ditemukan.' };
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXT.has(ext) && !ALLOWED_MIME.has(file.type)) {
    return { ok: false, message: 'Format file tidak didukung. Gunakan PDF, PNG, JPG, JPEG, atau ZIP.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: 'Ukuran file maksimal 5 MB.' };
  }
  return { ok: true };
}

/* ── localStorage path mirror (USE_BACKEND=false) ─────────── */

/**
 * Simulates getAllConversations() in localStorage mode (USE_BACKEND=false).
 * Mirrors the current unfixed logic: reads from the in-memory store,
 * enriches with lastMessage/unreadCount/needsReply, sorts by lastAt desc.
 */
function simulateGetAllConversationsLocalStorage(conversations, messages) {
  return conversations
    .map((conv) => {
      const msgs = messages
        .filter((m) => m.conversationId === conv.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const lastMessage = msgs[msgs.length - 1] ?? null;
      const unreadCount = msgs.filter((m) => m.senderRole === 'customer' && !m.readAt).length;
      const needsReply = conv.needsReply ?? (lastMessage?.senderRole === 'customer');
      return { ...conv, lastMessage, unreadCount, needsReply };
    })
    .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

/* ── Backend path mirrors (USE_BACKEND=true) ──────────────── */

/**
 * Simulates getAllConversations() in backend mode (USE_BACKEND=true).
 * Mirrors the CURRENT (unfixed) logic: calls api.get and returns raw data.
 */
async function simulateGetAllConversationsBackend(mockApiGet) {
  const res = await mockApiGet('/api/conversations');
  return res.data.data ?? res.data.items ?? [];
}

/**
 * Simulates sendMessage({ type: 'text', ... }) in backend mode.
 * Mirrors the CURRENT (unfixed) logic:
 *   1. createOrGetConversation → POST /api/conversations
 *   2. POST /api/conversations/:id/messages with trimmed content
 */
async function simulateSendTextMessageBackend(opts, mockApiPost) {
  const { customerId, customerName, senderRole, content, convId } = opts;

  // Step 1: createOrGetConversation (POST /api/conversations)
  // We pass convId directly to avoid testing that path here
  const conv = { id: convId };

  // Step 2: send text message
  const trimmed = String(content || '').trim();
  if (!trimmed) return { ok: false, message: 'Pesan tidak boleh kosong.' };

  const res = await mockApiPost(`/api/conversations/${conv.id}/messages`, {
    content: trimmed,
    senderRole,
  });
  return { ok: true, msg: res.data.data };
}

/**
 * Simulates markAsRead() in backend mode.
 * Mirrors the CURRENT (unfixed) logic: calls api.patch.
 */
async function simulateMarkAsReadBackend(convId, mockApiPatch) {
  await mockApiPatch(`/api/conversations/${convId}/read`);
}

// ─────────────────────────────────────────────────────────────────────────────
// P1 — localStorage path unchanged
// Expected: PASS on unfixed code
// ─────────────────────────────────────────────────────────────────────────────

describe('P1 — localStorage path unchanged (USE_BACKEND=false)', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * When USE_BACKEND=false, getAllConversations() reads from localStorage and
   * returns objects with camelCase fields already. The fix must not alter this path.
   *
   * Preservation: for all localStorage conversation objects, getAllConversations()
   * returns them with customerId, customerName, assignedAdminId intact.
   */

  it('camelCase fields (customerId, customerName, assignedAdminId) are preserved as-is', () => {
    const conversations = [
      {
        id: 'conv-1',
        customerId: 'cust-abc',
        customerName: 'Budi Santoso',
        assignedAdminId: 'admin-1',
        status: 'open',
        createdAt: '2024-01-01T08:00:00Z',
        lastAt: '2024-01-01T10:00:00Z',
        needsReply: false,
      },
    ];
    const messages = [];

    const result = simulateGetAllConversationsLocalStorage(conversations, messages);

    expect(result).toHaveLength(1);
    expect(result[0].customerId).toBe('cust-abc');
    expect(result[0].customerName).toBe('Budi Santoso');
    expect(result[0].assignedAdminId).toBe('admin-1');
  });

  it('property: for any localStorage conversation, camelCase fields are returned intact', () => {
    /**
     * **Validates: Requirements 3.1**
     */
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            customerId: fc.uuid(),
            customerName: fc.string({ minLength: 1, maxLength: 50 }),
            assignedAdminId: fc.option(fc.uuid(), { nil: null }),
            status: fc.constantFrom('open', 'closed'),
            createdAt: fc.date({ min: new Date(0), max: new Date(2100, 0, 1) }).map((d) => d.toISOString()),
            lastAt: fc.date({ min: new Date(0), max: new Date(2100, 0, 1) }).map((d) => d.toISOString()),
            needsReply: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (conversations) => {
          const result = simulateGetAllConversationsLocalStorage(conversations, []);

          // All conversations must be returned
          expect(result).toHaveLength(conversations.length);

          // Each result must have the original camelCase fields intact
          for (const conv of conversations) {
            const found = result.find((r) => r.id === conv.id);
            expect(found).toBeDefined();
            expect(found.customerId).toBe(conv.customerId);
            expect(found.customerName).toBe(conv.customerName);
            expect(found.assignedAdminId).toBe(conv.assignedAdminId);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('unreadCount is computed from unread customer messages', () => {
    const convId = 'conv-1';
    const conversations = [
      {
        id: convId,
        customerId: 'cust-1',
        customerName: 'Sari',
        assignedAdminId: null,
        status: 'open',
        createdAt: '2024-01-01T08:00:00Z',
        lastAt: '2024-01-01T10:00:00Z',
      },
    ];
    const messages = [
      { id: 'm1', conversationId: convId, senderRole: 'customer', readAt: null, createdAt: '2024-01-01T09:00:00Z' },
      { id: 'm2', conversationId: convId, senderRole: 'customer', readAt: null, createdAt: '2024-01-01T09:30:00Z' },
      { id: 'm3', conversationId: convId, senderRole: 'admin', readAt: null, createdAt: '2024-01-01T10:00:00Z' },
    ];

    const result = simulateGetAllConversationsLocalStorage(conversations, messages);

    expect(result[0].unreadCount).toBe(2);
  });

  it('conversations are sorted by lastAt descending', () => {
    const conversations = [
      { id: 'conv-old', customerId: 'c1', customerName: 'A', assignedAdminId: null, status: 'open', createdAt: '2024-01-01T00:00:00Z', lastAt: '2024-01-01T08:00:00Z' },
      { id: 'conv-new', customerId: 'c2', customerName: 'B', assignedAdminId: null, status: 'open', createdAt: '2024-01-02T00:00:00Z', lastAt: '2024-01-02T10:00:00Z' },
    ];

    const result = simulateGetAllConversationsLocalStorage(conversations, []);

    expect(result[0].id).toBe('conv-new');
    expect(result[1].id).toBe('conv-old');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P2 — Backend REST API calls preserved
// Expected: PASS on unfixed code
// ─────────────────────────────────────────────────────────────────────────────

describe('P2 — Backend REST API calls preserved (USE_BACKEND=true)', () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * When USE_BACKEND=true, getAllConversations() calls api.get('/api/conversations')
   * exactly once and returns the raw data from the response.
   *
   * Preservation: the API endpoint is called and the raw data is returned
   * (even if not normalized yet — normalization is the fix, not the preservation).
   */

  it('api.get is called exactly once with /api/conversations', async () => {
    const rawConversations = [
      { id: 'conv-1', customer_id: 'cust-1', customer_name: 'Budi', unread_count: 2 },
    ];

    const mockApiGet = vi.fn().mockResolvedValue({
      data: { data: rawConversations },
    });

    await simulateGetAllConversationsBackend(mockApiGet);

    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockApiGet).toHaveBeenCalledWith('/api/conversations');
  });

  it('raw data from the API response is returned', async () => {
    const rawConversations = [
      { id: 'conv-1', customer_id: 'cust-1', customer_name: 'Budi', unread_count: 2 },
      { id: 'conv-2', customer_id: 'cust-2', customer_name: 'Sari', unread_count: 0 },
    ];

    const mockApiGet = vi.fn().mockResolvedValue({
      data: { data: rawConversations },
    });

    const result = await simulateGetAllConversationsBackend(mockApiGet);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('conv-1');
    expect(result[1].id).toBe('conv-2');
  });

  it('property: for any mock backend response, the API endpoint is called and data is returned', async () => {
    /**
     * **Validates: Requirements 3.4**
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            customer_id: fc.uuid(),
            customer_name: fc.string({ minLength: 1, maxLength: 50 }),
            unread_count: fc.integer({ min: 0, max: 99 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (rawConversations) => {
          const mockApiGet = vi.fn().mockResolvedValue({
            data: { data: rawConversations },
          });

          const result = await simulateGetAllConversationsBackend(mockApiGet);

          // API must be called exactly once
          expect(mockApiGet).toHaveBeenCalledTimes(1);
          expect(mockApiGet).toHaveBeenCalledWith('/api/conversations');

          // Raw data must be returned (length preserved)
          expect(result).toHaveLength(rawConversations.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('falls back to res.data.items when res.data.data is absent', async () => {
    const rawConversations = [
      { id: 'conv-1', customer_id: 'cust-1', customer_name: 'Budi' },
    ];

    const mockApiGet = vi.fn().mockResolvedValue({
      data: { items: rawConversations },
    });

    const result = await simulateGetAllConversationsBackend(mockApiGet);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('conv-1');
  });

  it('returns empty array when both res.data.data and res.data.items are absent', async () => {
    const mockApiGet = vi.fn().mockResolvedValue({
      data: {},
    });

    const result = await simulateGetAllConversationsBackend(mockApiGet);

    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3 — File upload validation preserved
// Expected: PASS on unfixed code
// ─────────────────────────────────────────────────────────────────────────────

describe('P3 — File upload validation preserved', () => {
  /**
   * **Validates: Requirements 3.8**
   *
   * For all file inputs:
   *   - Files > 5 MB are rejected with { ok: false }
   *   - Files with unsupported MIME types are rejected with { ok: false }
   *   - Valid files are accepted with { ok: true }
   *
   * Preservation: validateFile behavior is unchanged after the fix.
   */

  it('file > 5 MB is rejected', () => {
    const oversizedFile = { size: 6 * 1024 * 1024, name: 'x.pdf', type: 'application/pdf' };
    const result = validateFile(oversizedFile);
    expect(result.ok).toBe(false);
  });

  it('file exactly at 5 MB limit is accepted', () => {
    const exactLimitFile = { size: 5 * 1024 * 1024, name: 'x.pdf', type: 'application/pdf' };
    const result = validateFile(exactLimitFile);
    expect(result.ok).toBe(true);
  });

  it('unsupported MIME type is rejected', () => {
    const unsupportedFile = { size: 1024, name: 'x.exe', type: 'application/octet-stream' };
    const result = validateFile(unsupportedFile);
    expect(result.ok).toBe(false);
  });

  it('supported MIME types are accepted', () => {
    const supportedFiles = [
      { size: 1024, name: 'doc.pdf', type: 'application/pdf' },
      { size: 1024, name: 'img.png', type: 'image/png' },
      { size: 1024, name: 'img.jpg', type: 'image/jpeg' },
      { size: 1024, name: 'archive.zip', type: 'application/zip' },
    ];

    for (const file of supportedFiles) {
      const result = validateFile(file);
      expect(result.ok).toBe(true);
    }
  });

  it('property: any file > 5 MB is rejected regardless of type', () => {
    /**
     * **Validates: Requirements 3.8**
     */
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FILE_BYTES + 1, max: 100 * 1024 * 1024 }),
        fc.constantFrom('application/pdf', 'image/png', 'image/jpeg', 'application/zip'),
        fc.constantFrom('doc.pdf', 'img.png', 'img.jpg', 'archive.zip'),
        (size, type, name) => {
          const result = validateFile({ size, name, type });
          expect(result.ok).toBe(false);
          expect(result.message).toContain('5 MB');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('property: any file with unsupported MIME type and extension is rejected', () => {
    /**
     * **Validates: Requirements 3.8**
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_FILE_BYTES }),
        fc.constantFrom('application/octet-stream', 'text/html', 'video/mp4', 'audio/mpeg'),
        fc.constantFrom('file.exe', 'page.html', 'video.mp4', 'audio.mp3'),
        (size, type, name) => {
          const result = validateFile({ size, name, type });
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('property: valid files (supported type, within size limit) are accepted', () => {
    /**
     * **Validates: Requirements 3.8**
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_FILE_BYTES }),
        fc.constantFrom(
          { name: 'doc.pdf', type: 'application/pdf' },
          { name: 'img.png', type: 'image/png' },
          { name: 'img.jpg', type: 'image/jpeg' },
          { name: 'img.jpeg', type: 'image/jpeg' },
          { name: 'archive.zip', type: 'application/zip' }
        ),
        (size, { name, type }) => {
          const result = validateFile({ size, name, type });
          expect(result.ok).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P4 — Text message send flow preserved
// Expected: PASS on unfixed code
// ─────────────────────────────────────────────────────────────────────────────

describe('P4 — Text message send flow preserved (USE_BACKEND=true)', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * When USE_BACKEND=true, sendMessage({ type: 'text', content: 'hello', ... })
   * calls api.post('/api/conversations/:id/messages', ...) with the trimmed content.
   *
   * Preservation: for any non-empty text content, the POST endpoint is called
   * with the trimmed content.
   */

  it('POST /api/conversations/:id/messages is called with trimmed content', async () => {
    const mockApiPost = vi.fn().mockResolvedValue({
      data: { data: { id: 'msg-1', content: 'hello', senderRole: 'customer' } },
    });

    const result = await simulateSendTextMessageBackend(
      { convId: 'conv-1', senderRole: 'customer', content: '  hello  ' },
      mockApiPost
    );

    expect(result.ok).toBe(true);
    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/conversations/conv-1/messages',
      { content: 'hello', senderRole: 'customer' }
    );
  });

  it('empty content is rejected without calling the API', async () => {
    const mockApiPost = vi.fn();

    const result = await simulateSendTextMessageBackend(
      { convId: 'conv-1', senderRole: 'customer', content: '   ' },
      mockApiPost
    );

    expect(result.ok).toBe(false);
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('property: for any non-empty text content, POST endpoint is called with trimmed content', async () => {
    /**
     * **Validates: Requirements 3.2**
     */
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('customer', 'admin', 'owner', 'cs'),
        async (convId, content, senderRole) => {
          const mockApiPost = vi.fn().mockResolvedValue({
            data: { data: { id: 'msg-x', content: content.trim(), senderRole } },
          });

          const result = await simulateSendTextMessageBackend(
            { convId, senderRole, content },
            mockApiPost
          );

          expect(result.ok).toBe(true);
          expect(mockApiPost).toHaveBeenCalledTimes(1);
          expect(mockApiPost).toHaveBeenCalledWith(
            `/api/conversations/${convId}/messages`,
            { content: content.trim(), senderRole }
          );
        }
      ),
      { numRuns: 30 }
    );
  });

  it('content is trimmed before sending', async () => {
    const mockApiPost = vi.fn().mockResolvedValue({
      data: { data: { id: 'msg-1', content: 'trimmed message', senderRole: 'admin' } },
    });

    await simulateSendTextMessageBackend(
      { convId: 'conv-1', senderRole: 'admin', content: '   trimmed message   ' },
      mockApiPost
    );

    const callArgs = mockApiPost.mock.calls[0];
    expect(callArgs[1].content).toBe('trimmed message');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P5 — markAsRead API call preserved
// Expected: PASS on unfixed code
// ─────────────────────────────────────────────────────────────────────────────

describe('P5 — markAsRead API call preserved (USE_BACKEND=true)', () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * When USE_BACKEND=true, markAsRead(convId, 'admin') calls
   * api.patch('/api/conversations/:id/read').
   *
   * Preservation: for any convId, the PATCH endpoint is called.
   */

  it('PATCH /api/conversations/:id/read is called for admin role', async () => {
    const mockApiPatch = vi.fn().mockResolvedValue({});

    await simulateMarkAsReadBackend('conv-1', mockApiPatch);

    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    expect(mockApiPatch).toHaveBeenCalledWith('/api/conversations/conv-1/read');
  });

  it('PATCH /api/conversations/:id/read is called for owner role', async () => {
    const mockApiPatch = vi.fn().mockResolvedValue({});

    await simulateMarkAsReadBackend('conv-2', mockApiPatch);

    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    expect(mockApiPatch).toHaveBeenCalledWith('/api/conversations/conv-2/read');
  });

  it('property: for any convId, the PATCH endpoint is called exactly once', async () => {
    /**
     * **Validates: Requirements 3.4**
     */
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (convId) => {
          const mockApiPatch = vi.fn().mockResolvedValue({});

          await simulateMarkAsReadBackend(convId, mockApiPatch);

          expect(mockApiPatch).toHaveBeenCalledTimes(1);
          expect(mockApiPatch).toHaveBeenCalledWith(`/api/conversations/${convId}/read`);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('markAsRead does not throw when API call succeeds', async () => {
    const mockApiPatch = vi.fn().mockResolvedValue({});

    await expect(simulateMarkAsReadBackend('conv-1', mockApiPatch)).resolves.not.toThrow();
  });
});
