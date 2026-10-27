import { query } from '../db/connection.js';

/**
 * Returns true only when the conversation exists and belongs to the customer.
 * @param {string} customerId
 * @param {string} conversationId
 * @returns {Promise<boolean>}
 */
export async function canCustomerAccessConversation(customerId, conversationId) {
  if (!customerId || !conversationId) return false;
  const [rows] = await query(
    'SELECT id FROM conversations WHERE id = ? AND customer_id = ? LIMIT 1',
    [conversationId, customerId]
  );
  return rows.length > 0;
}
