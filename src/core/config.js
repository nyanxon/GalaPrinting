export const APP = {
  name: "Gala Printing",
  locale: "id-ID",
  currency: "IDR",
  apiBase: "/api",
};

/**
 * All 8 staff roles and their display names.
 * "admin" = super-admin (sees everything, can do everything)
 * "owner" = owner (analytics + all admin)
 * Sub-roles each handle one stage of the order flow.
 */
export const STAFF_ROLES = {
  admin:       { label: "Super Admin",        color: "#785E40" },
  owner:       { label: "Owner",              color: "#1e40af" },
  cashier:     { label: "Kasir",              color: "#16a34a" },
  cs:          { label: "Customer Service",   color: "#9333ea" },
  operational: { label: "Operasional",        color: "#ea580c" },
  qc:          { label: "Quality Control",    color: "#0891b2" },
  offline:     { label: "Offline Admin",      color: "#be185d" },
};

