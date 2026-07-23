/**
 * permissions.js — Single source of truth for all permission keys.
 *
 * Used by:
 *   - Frontend: AccountEditModal (checkbox rendering + role-based filtering)
 *   - Frontend: Dashboard pages (NAV_ITEMS filtering based on user.permissions)
 *   - Backend:  accounts.controller.js (input validation)
 *
 * Structure:
 *   PERMISSIONS[] — ordered list of { key, label, roles[] }
 *     key    = the string stored in user_permissions.permission_key
 *     label  = human-readable display name
 *     roles  = array of role strings that have this menu/feature
 *
 *   PERM_TO_NAV — maps permission keys → sidebar nav item IDs
 *     (permission keys and nav IDs don't always match)
 */

export const PERMISSIONS = [
  // ── Owner + Admin ──────────────────────────────────────────────────
  { key: 'dashboard',          label: 'Dashboard',          roles: ['owner', 'admin'] },
  { key: 'orders',             label: 'Orders',             roles: ['owner', 'admin', 'cashier', 'cs', 'operational', 'qc'] },
  { key: 'products',           label: 'Products',           roles: ['owner', 'admin'] },
  { key: 'categories',         label: 'Categories',         roles: ['owner', 'admin'] },
  { key: 'reviews',            label: 'Reviews',            roles: ['owner', 'admin'] },
  { key: 'chats',              label: 'Chats',              roles: ['owner', 'admin', 'cashier', 'cs', 'operational', 'qc', 'offline'] },
  { key: 'dm',                 label: 'DM',                 roles: ['admin', 'cashier', 'cs', 'operational', 'qc', 'offline'] },
  { key: 'promo',              label: 'Promo',              roles: ['owner', 'admin'] },
  { key: 'homepage',           label: 'Homepage',           roles: ['owner', 'admin'] },

  // ── Owner-only ─────────────────────────────────────────────────────
  { key: 'accounts',           label: 'Account Management', roles: ['owner'] },
  { key: 'revenue',            label: 'Revenue',            roles: ['owner'] },
  { key: 'reports',            label: 'Reports',            roles: ['owner'] },
  { key: 'analytics',          label: 'Analytics',          roles: ['owner'] },

  // ── Admin-only ─────────────────────────────────────────────────────
  { key: 'invoices',           label: 'Invoices',           roles: ['admin'] },
  { key: 'customers',          label: 'Customers',          roles: ['admin'] },

  // ── CS-only ────────────────────────────────────────────────────────
  { key: 'custom_order',       label: 'Custom Order',       roles: ['cs'] },

  // ── Cashier-only ──────────────────────────────────────────────────
  { key: 'order_offline',      label: 'Order Offline',      roles: ['cashier'] },
  { key: 'daily_recap',        label: 'Rekap Harian',       roles: ['cashier'] },

  // ── Offline-only ──────────────────────────────────────────────────
  { key: 'new_order',          label: 'Buat Pesanan Baru',  roles: ['offline'] },
  { key: 'order_list',         label: 'Daftar Pesanan',     roles: ['offline'] },
];

/**
 * All valid role strings (union of all roles mentioned above).
 */
export const ALL_ROLE_VALUES = [
  'customer', 'admin', 'owner', 'cashier', 'cs', 'operational', 'qc', 'offline',
];

/**
 * Return only the permission keys valid for a given role.
 *
 * @param {string} role
 * @returns {Array<{ key: string, label: string }>}
 */
export function getPermissionsForRole(role) {
  return PERMISSIONS.filter((p) => p.roles.includes(role)).map(({ key, label }) => ({ key, label }));
}

/**
 * Return only the permission keys valid for a given role (as a Set of keys).
 *
 * @param {string} role
 * @returns {Set<string>}
 */
export function getPermissionKeysForRole(role) {
  return new Set(PERMISSIONS.filter((p) => p.roles.includes(role)).map((p) => p.key));
}

/**
 * Maps permission keys → sidebar nav item IDs.
 * Only included for keys where the nav ID differs from the permission key.
 * Keys NOT listed here are assumed to map 1:1 (key === navId).
 */
const PERM_TO_NAV = {
  reviews:       'review',
  customers:     'customer',
  custom_order:  'custom-order',
  order_offline: 'offline',
  daily_recap:   'recap',
  new_order:     'new-order',
  order_list:    'order-list',
};

/**
 * Filter an array of nav items based on user permissions.
 *
 * Three states from the backend:
 *   null/undefined  → permissions never set (backward compatible: show all menus)
 *   []              → permissions explicitly cleared (show nothing)
 *   [keys]          → filter: only show items whose perm key is in the array
 *
 * @param {Array<{ id: string }>} navItems
 * @param {string[] | null | undefined} userPermissions
 * @returns {Array<{ id: string }>}
 */
export function filterNavByPermissions(navItems, userPermissions) {
  // null/undefined = never edited → backward compat, show all
  if (userPermissions == null) return navItems;

  // [] = explicitly cleared → show nothing
  if (userPermissions.length === 0) return [];

  // Build reverse map: navId → permissionKey
  const navToPerm = {};
  for (const [permKey, navId] of Object.entries(PERM_TO_NAV)) {
    navToPerm[navId] = permKey;
  }

  const permSet = new Set(userPermissions);

  return navItems.filter((item) => {
    const permKey = navToPerm[item.id] ?? item.id;
    return permSet.has(permKey);
  });
}
