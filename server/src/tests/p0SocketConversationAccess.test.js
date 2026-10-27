/**
 * P0 socket conversation-ownership regression tests (mocked DB).
 *
 * No database is required. Also verify against a real conversations table in staging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/connection.js', () => ({ query: vi.fn() }));

import { query } from '../db/connection.js';
import { canCustomerAccessConversation } from '../utils/conversationAccess.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('socket join:conversation ownership', () => {
  it('denies a customer when the conversation belongs to another customer', async () => {
    query.mockResolvedValue([[]]);

    const allowed = await canCustomerAccessConversation('customer-a', 'conv-owned-by-b');

    expect(allowed).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('customer_id = ?'),
      ['conv-owned-by-b', 'customer-a']
    );
  });

  it('allows a customer only when the DB returns their conversation row', async () => {
    query.mockResolvedValue([[{ id: 'conv-a' }]]);

    await expect(canCustomerAccessConversation('customer-a', 'conv-a')).resolves.toBe(true);
  });

  it('rejects empty ids without querying', async () => {
    await expect(canCustomerAccessConversation('', 'conv-a')).resolves.toBe(false);
    await expect(canCustomerAccessConversation('customer-a', '')).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
