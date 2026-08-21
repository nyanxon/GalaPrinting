/**
 * services/orders.js
 *
 * Improvements in this version:
 *  1. Audit trail  — every mutation appends to order.history[]
 *  2. Owner dashboard cache invalidation (no-op in React)
 *  3. Owner cache invalidation — fires invalidateMetricsCache() on every write
 *  4. Backend integration — when USE_BACKEND=true, all functions call the REST API
 *     instead of localStorage. Existing localStorage implementations are unchanged.
 *
 * Requirements: 16.1
 */

import { readJson, writeJson } from "../core/storage.js";
import { normalizePagination } from "../utils/validate.js";
import { USE_BACKEND, api, resolveApiUrl } from "../core/httpClient.js";

const KEY = "gala.orders";

function load()         { return readJson(KEY, []); }
function save(orders)   { writeJson(KEY, orders); }

/* ── Owner cache invalidation hook ──────────────────────── */
// In the React app the owner dashboard re-fetches data reactively;
// no manual cache invalidation is needed.
function invalidateOwnerCache() {
  // no-op in React context
}

/* ── Audit trail helper ──────────────────────────────────── */
/**
 * Append an entry to order.history[].
 * @param {object} order
 * @param {{ type: string, [key: string]: any }} entry
 */
function pushHistory(order, entry) {
  if (!Array.isArray(order.history)) order.history = [];
  order.history.push({ ...entry, at: new Date().toISOString() });
}

/* ── Order number ────────────────────────────────────────── */

// localStorage sequential counter (resets on page reload — acceptable for dev/offline mode)
let _localSeq = Date.now() % 1000; // start from a pseudo-random offset to avoid obvious collisions

function generateOrderNumber() {
  _localSeq = (_localSeq % 999999) + 1;
  const seq  = String(_localSeq).padStart(6, "0");
  const now  = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const dd   = String(now.getDate()).padStart(2, "0");
  return `GALA-${yyyy}/${mm}/${dd}-${seq}`;
}

/* ── Status transitions ──────────────────────────────────── */

/**
 * Standard 8-step order flow (online/offline orders):
 *   Waiting for Payment → Payment Accepted → Waiting for Design Approval
 *   → Design Accepted → On Progress → Quality Checking → In Delivery → Finished
 *
 * Custom order flow (CS-initiated):
 *   Waiting for Design Approval → Design Accepted → Waiting for Payment
 *   → Payment Accepted → On Progress → Quality Checking → In Delivery → Finished
 *
 * The `orderType` field on the order distinguishes the two flows.
 */
export const ORDER_STATUSES = [
  "Waiting for Payment",
  "Payment Accepted",
  "Waiting for Design Approval",
  "Design Accepted",
  "On Progress",
  "Quality Checking",
  "In Delivery",
  "Finished",
  "Cancelled",
];

/** Timeline steps for standard orders */
export const STANDARD_TIMELINE = [
  "Waiting for Payment",
  "Payment Accepted",
  "Waiting for Design Approval",
  "Design Accepted",
  "On Progress",
  "Quality Checking",
  "In Delivery",
  "Finished",
  "Cancelled",
];

/** Timeline steps for custom orders (CS-first flow) */
export const CUSTOM_TIMELINE = [
  "Waiting for Design Approval",
  "Design Accepted",
  "Waiting for Payment",
  "Payment Accepted",
  "On Progress",
  "Quality Checking",
  "In Delivery",
  "Finished",
  "Cancelled",
];

/** Which roles can advance an order from a given status — standard flow */
export const ALLOWED_TRANSITIONS = {
  "Waiting for Payment":        { next: ["Payment Accepted"],             roles: ["cashier", "admin"] },
  "Payment Accepted":           { next: ["Waiting for Design Approval"],  roles: ["cs", "admin"] },
  "Waiting for Design Approval":{ next: ["Design Accepted"],              roles: ["cs", "admin"] },
  "Design Accepted":            { next: ["On Progress"],                  roles: ["operational", "admin"] },
  "On Progress":                { next: ["Quality Checking"],             roles: ["qc", "admin"] },
  "Quality Checking":           { next: ["In Delivery", "On Progress"],   roles: ["qc", "admin"] }, // QC reject → back to Operational
  "In Delivery":                { next: ["Finished"],                     roles: ["qc", "admin", "courier_api"] },
  "Finished":                   { next: [],                               roles: [] },
};

/** Transitions for custom order flow (CS-first) */
export const CUSTOM_TRANSITIONS = {
  "Waiting for Design Approval":{ next: ["Design Accepted"],              roles: ["cs", "admin"] },
  "Design Accepted":            { next: ["Waiting for Payment"],          roles: ["cs", "admin"] },
  "Waiting for Payment":        { next: ["Payment Accepted"],             roles: ["cashier", "admin"] },
  "Payment Accepted":           { next: ["On Progress"],                  roles: ["operational", "admin"] },
  "On Progress":                { next: ["Quality Checking"],             roles: ["qc", "admin"] },
  "Quality Checking":           { next: ["In Delivery", "On Progress"],   roles: ["qc", "admin"] }, // QC reject → back to Operational
  "In Delivery":                { next: ["Finished"],                     roles: ["qc", "admin", "courier_api"] },
  "Finished":                   { next: [],                               roles: [] },
};

/** Get allowed next statuses for a given current status + actor role + order type */
export function getAllowedNextStatuses(currentStatus, actorRole, orderType = "standard") {
  const transitions = orderType === "custom" ? CUSTOM_TRANSITIONS : ALLOWED_TRANSITIONS;
  const transition  = transitions[currentStatus];
  if (!transition) return [];
  if (actorRole === "admin" || actorRole === "owner") return transition.next;
  return transition.roles.includes(actorRole) ? transition.next : [];
}

/** Status display config (icon + badge color class) */
export const STATUS_CONFIG = {
  'Waiting for Payment':         { icon: '💳', badge: 'status--waiting-payment',  label: 'Menunggu Pembayaran',       color: '#92400e', bg: '#fef3c7' },
  'Payment Accepted':            { icon: '✅', badge: 'status--payment-accepted', label: 'Pembayaran Diterima',       color: '#166534', bg: '#dcfce7' },
  'Waiting for Design Approval': { icon: '🎨', badge: 'status--waiting-design',   label: 'Menunggu Konfirmasi Desain', color: '#5b21b6', bg: '#ede9fe' },
  'Design Accepted':             { icon: '👍', badge: 'status--design-accepted',  label: 'Desain Disetujui',          color: '#1e40af', bg: '#dbeafe' },
  'On Progress':                 { icon: '⚙️', badge: 'status--on-progress',      label: 'Sedang Diproses',           color: '#9a3412', bg: '#ffedd5' },
  'Quality Checking':            { icon: '🔍', badge: 'status--qc',               label: 'Quality Check',             color: '#0369a1', bg: '#e0f2fe' },
  'In Delivery':                 { icon: '🚚', badge: 'status--in-delivery',      label: 'Dalam Pengiriman',          color: '#15803d', bg: '#f0fdf4' },
  'Finished':                    { icon: '🎉', badge: 'status--finished',         label: 'Selesai',                   color: '#166534', bg: '#dcfce7' },
  'Cancelled':                   { icon: '❌', badge: 'status--cancelled',        label: 'Dibatalkan',                color: '#991b1b', bg: '#fee2e2' },
};

/* ══════════════════════════════════════════════════════════
   BACKEND RESPONSE MAPPERS
   ══════════════════════════════════════════════════════════ */

/**
 * Map a backend order row to the shape expected by the frontend.
 * The backend stores snake_case columns; the frontend uses camelCase.
 * @param {object} row  Raw order object from the API
 * @returns {object}    Normalised order object
 */
function mapOrder(row) {
  if (!row) return null;

  function toAbsUrl(p) {
    return resolveApiUrl(p);
  }

  return {
    id:           row.id,
    orderNumber:  row.order_number  ?? row.orderNumber,
    orderType:    row.order_type    ?? row.orderType    ?? "standard",
    source:       row.source        ?? "online",
    customerId:   row.customer_id   ?? row.customerId   ?? null,
    customer: {
      name:         row.customer_name          ?? row.customer?.name         ?? "",
      phone:        row.customer_phone         ?? row.customer?.phone        ?? "",
      address:      row.customer_address       ?? row.customer?.address      ?? "",
      addressTitle: row.customer_address_title ?? row.customer?.addressTitle ?? null,
      email:        row.customer_email         ?? row.customer?.email        ?? "",
    },
    customerPhone: row.customer_phone ?? row.customerPhone ?? "",
    customerEmail: row.customer_email ?? row.customerEmail ?? "",
    status:        row.status,
    subtotal:      Number(row.subtotal ?? 0),
    cancellationReason: row.cancellation_reason ?? row.cancellationReason ?? null,
    promoCode:          row.promo_code          ?? row.promoCode          ?? null,
    discountAmount:     Number(row.discount_amount ?? row.discountAmount ?? 0),
    adminNote:     row.admin_note    ?? row.adminNote    ?? "",
    shippingCost:  Number(row.shipping_cost  ?? row.shippingCost  ?? 0),
    taxAmount:     Number(row.tax_amount     ?? row.taxAmount     ?? 0),
    refundAmount:  Number(row.refund_amount  ?? row.refundAmount  ?? 0),
    paymentMethod: row.payment_method ?? row.paymentMethod ?? null,
    trackingNumber:row.tracking_number ?? row.trackingNumber ?? null,
    courierName:   row.courier_name  ?? row.courierName  ?? null,
    paymentProof:  row.payment_proof_path
      ? { url: toAbsUrl(row.payment_proof_path) }
      : (row.paymentProof ?? null),
    items:    Array.isArray(row.items)   ? row.items.map(mapOrderItem) : [],
    history:  Array.isArray(row.history) ? row.history : [],
    timeline: Array.isArray(row.timeline)? row.timeline : [],
    // timelineMap from backend: { [statusName]: isoTimestamp }
    // Built from actual order_history records — only statuses that were
    // explicitly set by an admin appear here. Never inferred from ordering.
    timelineMap: (row.timelineMap && typeof row.timelineMap === 'object') ? row.timelineMap : {},
    approvals: Array.isArray(row.approvals) ? row.approvals : [],
    deliveryMethod: row.delivery_method ?? row.deliveryMethod ?? 'delivery',
    pickupLocation: row.pickup_location ?? row.pickupLocation ?? null,
    pickupReadyAt:  row.pickup_ready_at  ?? row.pickupReadyAt  ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

/**
 * Parse selected attribute values from a raw order item.
 * Accepts a JSON array string or an already-parsed array of
 * { name, value } objects. Returns [] when empty/invalid.
 */
function parseSelectedAttributes(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const name = String(a.name ?? '').trim();
      const value = String(a.value ?? '').trim();
      if (!name || !value) return null;
      return { name, value };
    })
    .filter(Boolean);
}

/**
 * Map a backend order_item row to the frontend shape.
 * @param {object} item
 * @returns {object}
 */
function mapOrderItem(item) {
  const rawPath = item.design_file_path ?? item.designFileName ?? null;
  const designUrl = resolveApiUrl(rawPath);

  return {
    id:             item.id,
    productId:      item.product_id      ?? item.productId      ?? null,
    name:           item.name,
    price:          Number(item.price    ?? 0),
    quantity:       Number(item.quantity ?? 1),
    attributes:     parseSelectedAttributes(item.attributes),
    notes:          item.notes           ?? null,
    lengthCm:       item.length_cm       ?? item.lengthCm        ?? null,
    widthCm:        item.width_cm        ?? item.widthCm         ?? null,
    designFileName: rawPath,
    designFileUrl:  designUrl,
    designDataUrl:  item.designDataUrl   ?? null,
  };
}

/* ══════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════ */

/**
 * Create an order from cart items + customer info.
 *
 * - USE_BACKEND=true : POST /api/orders → returns Promise<object>
 *   Response shape: { ok: true, data: { ...order } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns object synchronously
 *
 * @param {{ customer: object, items: object[], subtotal: number, orderType?: "standard"|"custom" }} opts
 * @returns {object|Promise<object>} The created order
 */
export async function createOrderFromCart({ customer = {}, items, subtotal, orderType = "standard", promoCode, discountAmount }) {
  if (USE_BACKEND) {
    // Strip designDataUrl from items before sending (too large for JSON body)
    const sanitizedItems = items.map(({ designDataUrl: _ddu, designFile: _df, ...rest }) => rest);
    const order = await api.post("/api/orders", { customer, items: sanitizedItems, subtotal, orderType, promoCode: promoCode || null, discountAmount: Number(discountAmount) || 0 })
      .then((res) => mapOrder(res.data.data));

    // Upload design files for items that have them
    // Use the original index to correctly match cart items to order items
    const uploadPromises = items.map(async (item, originalIdx) => {
      if (!item.designDataUrl && !item.designFile) return;
      const orderItem = order.items[originalIdx];
      if (!orderItem?.id) return;

      let file = item.designFile;
      // If we only have a dataUrl (base64), convert it to a File object
      if (!file && item.designDataUrl) {
        try {
          const res = await fetch(item.designDataUrl);
          const blob = await res.blob();
          const ext = blob.type.split('/')[1] || 'png';
          file = new File([blob], item.designFileName || `design.${ext}`, { type: blob.type });
        } catch {
          return; // skip if conversion fails
        }
      }
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/api/orders/${order.id}/items/${orderItem.id}/design`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });

    const results = await Promise.allSettled(uploadPromises);
    const rejected = results.filter((r) => r.status === 'rejected');
    if (rejected.length > 0) {
      order.warnings = ['Satu atau lebih file desain gagal diunggah. Silakan unggah ulang.'];
    }
    return order;
  }
  return createOrderFromCartLocal({ customer, items, subtotal, orderType, promoCode, discountAmount });
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function createOrderFromCartLocal({ customer = {}, items, subtotal, orderType = "standard", promoCode, discountAmount }) {
  const now         = new Date().toISOString();
  const orderNumber = generateOrderNumber();
  const timeline    = orderType === "custom" ? CUSTOM_TIMELINE : STANDARD_TIMELINE;
  const firstStatus = timeline[0];

  const itemSnapshots = items.map((i) => ({
    id:             i.id,
    productId:      i.productId,
    name:           i.name,
    price:          i.price,
    quantity:       i.quantity,
    notes:          i.notes          || null,
    designFileName: i.designFileName || null,
    designDataUrl:  i.designDataUrl  || null,
  }));

  const order = {
    id: crypto.randomUUID(),
    orderNumber,
    orderType,
    customer: {
      name:    String(customer.name    || "").trim(),
      phone:   String(customer.phone   || "").trim(),
      address: String(customer.address || "").trim(),
    },
    customerPhone: String(customer.phone || "").trim(),
    status:    firstStatus,
    items:     itemSnapshots,
    subtotal,
    promoCode:      promoCode || null,
    discountAmount: Number(discountAmount) || 0,
    adminNote: "",
    createdAt: now,
    updatedAt: now,
    timeline: timeline.map((label, i) => ({
      label,
      at: i === 0 ? now : null,
    })),
    history: [
      { type: "created", status: firstStatus, at: now },
    ],
  };

  const orders = load();
  orders.unshift(order);
  save(orders);

  invalidateOwnerCache();
  window.dispatchEvent(new CustomEvent("gala:orders-updated", { detail: { orders } }));

  return order;
}

/**
 * CS Admin: create a custom order for a registered customer.
 * Flow starts at "Waiting for Design Approval" (CS-first).
 *
 * - USE_BACKEND=true : POST /api/orders/custom → returns Promise<object>
 *   Response shape: { ok: true, data: { ...order } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns object synchronously
 *
 * @param {{ customerId: string, customerName: string, customerPhone: string, customerAddress: string, items: object[], subtotal: number, adminNote?: string }} opts
 */
export function createCustomOrder({ customerId, customerName, customerPhone, customerAddress, items, subtotal, adminNote = "" }) {
  if (USE_BACKEND) {
    return api.post("/api/orders/custom", {
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      items,
      subtotal,
      adminNote,
    }).then((res) => mapOrder(res.data.data));
  }
  return createCustomOrderLocal({ customerId, customerName, customerPhone, customerAddress, items, subtotal, adminNote });
}

/**
 * Delete a custom order by ID (CS/admin only).
 * @param {string} orderId
 */
export function deleteOrder(orderId) {
  if (USE_BACKEND) {
    return api.delete(`/api/orders/${orderId}`).then((res) => res.data);
  }
  // Local fallback
  const key = 'gala_orders';
  const orders = JSON.parse(localStorage.getItem(key) || '[]');
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) throw new Error('Pesanan tidak ditemukan.');
  const order = orders[idx];
  if (order.orderType !== 'custom') throw new Error('Hanya pesanan custom yang bisa dihapus.');
  const paidStatuses = ['Payment Accepted', 'Waiting for Design Approval', 'On Progress', 'Ready to Ship', 'Shipped', 'Completed'];
  if (paidStatuses.includes(order.status)) throw new Error('Pesanan yang sudah diproses tidak bisa dihapus.');
  orders.splice(idx, 1);
  localStorage.setItem(key, JSON.stringify(orders));
  return { ok: true, data: order };
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function createCustomOrderLocal({ customerId, customerName, customerPhone, customerAddress, items, subtotal, adminNote = "" }) {
  const order = createOrderFromCartLocal({
    customer: { name: customerName, phone: customerPhone, address: customerAddress },
    items,
    subtotal,
    orderType: "custom",
  });

  // Tag with customerId + source + note
  const orders = load();
  const stored = orders.find((o) => o.id === order.id);
  if (stored) {
    stored.source     = "custom";
    stored.customerId = customerId;
    stored.adminNote  = String(adminNote || "").trim();
    if (stored.adminNote) pushHistory(stored, { type: "note", value: stored.adminNote });
    save(orders);
  }

  return { ...order, source: "custom", customerId, adminNote: String(adminNote || "").trim() };
}

/**
 * Look up a single order by number + optional phone verification.
 *
 * - USE_BACKEND=true : GET /api/orders/track?orderNumber=&phone= → returns Promise<object|null>
 *   Response shape: { ok: true, data: { ...order } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns object|null synchronously
 *
 * @param {{ orderNumber: string, phone?: string }} opts
 * @returns {object|null|Promise<object|null>}
 */
export function findOrder({ orderNumber, phone }) {
  if (USE_BACKEND) {
    const params = { orderNumber: String(orderNumber || "").trim() };
    if (phone) params.phone = String(phone).trim();
    return api.get("/api/orders/track", { params })
      .then((res) => mapOrder(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404) return null;
        throw err;
      });
  }
  return findOrderLocal({ orderNumber, phone });
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function findOrderLocal({ orderNumber, phone }) {
  const num = String(orderNumber || "").trim();
  const ph  = String(phone       || "").trim();
  if (!num) return null;
  return load().find((o) => o.orderNumber === num && (!ph || o.customerPhone === ph)) ?? null;
}

/**
 * Get all orders belonging to a customer.
 * Matches by customerId (for custom orders) OR customerPhone (for standard orders).
 *
 * - USE_BACKEND=true : GET /api/orders/my → returns Promise<object[]>
 *   Response shape: { ok: true, items: [...] }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns object[] synchronously
 *
 * @param {{ customerId?: string, customerPhone?: string }} opts
 * @returns {object[]|Promise<object[]>} sorted newest first
 */
export function listOrdersByCustomer({ customerId, customerPhone } = {}) {
  if (USE_BACKEND) {
    return api.get("/api/orders/my")
      .then((res) => {
        const raw = res.data.items ?? res.data.data ?? [];
        return raw.map(mapOrder);
      });
  }
  return listOrdersByCustomerLocal({ customerId, customerPhone });
}

/**
 * Alias used by some components — delegates to listOrdersByCustomer.
 * @param {string} customerId
 * @returns {object[]|Promise<object[]>}
 */
export function getMyOrders(customerId) {
  return listOrdersByCustomer({ customerId });
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function listOrdersByCustomerLocal({ customerId, customerPhone } = {}) {
  return load()
    .filter((o) => {
      if (customerId    && o.customerId    === customerId)    return true;
      if (customerPhone && o.customerPhone === customerPhone) return true;
      return false;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Attach payment proof to an existing order (used from My Orders page).
 *
 * - USE_BACKEND=true : POST /api/orders/:id/payment-proof (multipart/form-data) → returns Promise<{ok,order?}>
 *   Response shape: { ok: true, data: { ...order } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns {ok} synchronously
 *
 * @param {string} orderId
 * @param {{ fileName: string, fileSize: number, mimeType: string, dataUrl: string } | File} proof
 *   When USE_BACKEND=true, pass a File object (or FormData-compatible value).
 *   When USE_BACKEND=false, pass the legacy { fileName, fileSize, mimeType, dataUrl } object.
 */
export function attachPaymentProof(orderId, proof) {
  if (USE_BACKEND) {
    const formData = new FormData();
    // proof may be a File (from <input type="file">) or a Blob
    if (proof instanceof File || proof instanceof Blob) {
      formData.append("file", proof);
    } else if (proof?.file instanceof File) {
      formData.append("file", proof.file);
    } else {
      // Fallback: convert dataUrl to Blob
      const dataUrl = proof?.dataUrl ?? "";
      if (dataUrl) {
        const [header, base64] = dataUrl.split(",");
        const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        formData.append("file", blob, proof?.fileName ?? "payment-proof");
      }
    }
    return api.post(`/api/orders/${orderId}/payment-proof`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
      .then((res) => ({ ok: true, order: mapOrder(res.data.data) }))
      .catch((err) => {
        const message = err.response?.data?.message ?? "Gagal mengunggah bukti pembayaran.";
        return { ok: false, message };
      });
  }
  return attachPaymentProofLocal(orderId, proof);
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function attachPaymentProofLocal(orderId, proof) {
  const orders = load();
  const order  = orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, message: "Order tidak ditemukan." };
  order.paymentProof = { ...proof, uploadedAt: new Date().toISOString() };
  order.updatedAt    = new Date().toISOString();
  pushHistory(order, { type: "payment_proof", fileName: proof.fileName });
  save(orders);
  window.dispatchEvent(new CustomEvent("gala:orders-updated", { detail: { orders } }));
  return { ok: true };
}

/**
 * Admin: list all orders (unfiltered).
 *
 * - USE_BACKEND=true : loops every page of GET /api/orders until all orders
 *   are collected (follows totalPages from the response), returns Promise<object[]>
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns object[] synchronously
 *
 * @returns {object[]|Promise<object[]>}
 */
export function listAllOrders() {
  if (USE_BACKEND) {
    return listAllOrdersPaginated();
  }
  return load();
}

/**
 * Fetch every page of /api/orders and flatten into a single array.
 * The backend caps the per-request limit (2000), so a single large request
 * would silently miss orders once the total exceeds that cap — loop instead.
 *
 * @private
 */
async function listAllOrdersPaginated() {
  const PAGE_SIZE = 2000; // matches the backend per-request cap (2000)
  const MAX_PAGES = 20; // safety guard — up to 40k orders, then stop
  const all = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await api.get('/api/orders', { params: { page, limit: PAGE_SIZE } });
    const { items = [], total = 0, totalPages = 1 } = res.data;
    const mapped = (Array.isArray(items) ? items : []).map(mapOrder);
    all.push(...mapped);

    // Stop when: we reached the reported last page, we have everything the
    // API counts, or a page came back short (end of data).
    const done =
      page >= Number(totalPages ?? 1) ||
      all.length >= Number(total ?? 0) ||
      mapped.length < PAGE_SIZE;
    if (done) break;

    if (page === MAX_PAGES) {
      console.warn(
        `[orders] listAllOrders() reached safety cap of ${MAX_PAGES} pages (${all.length} orders). ` +
        `Either pagination is not advancing or there are more than ${MAX_PAGES * PAGE_SIZE} orders.`
      );
    }
  }

  return all;
}

/**
 * Get a single order by its UUID.
 *
 * - USE_BACKEND=true : GET /api/orders/:id → returns Promise<object|null>
 *   Response shape: { ok: true, data: { ...order } }
 * - USE_BACKEND=false: searches localStorage, returns object|null synchronously
 *
 * @param {string} id
 * @returns {object|null|Promise<object|null>}
 */
export function getOrderById(id) {
  if (USE_BACKEND) {
    return api.get(`/api/orders/${id}`)
      .then((res) => mapOrder(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404) return null;
        throw err;
      });
  }
  return load().find((o) => o.id === id) ?? null;
}

/**
 * Admin: paginated + filtered orders.
 *
 * - USE_BACKEND=true : GET /api/orders?page=&limit=&status= → returns Promise<{items,total,page,limit,totalPages}>
 *   Response shape: { ok: true, items, total, page, limit, totalPages }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns object synchronously
 *
 * @param {{ page?: number, limit?: number, status?: string }} opts
 */
export function listOrdersPaginated(opts = {}) {
  if (USE_BACKEND) {
    const { page, limit } = normalizePagination(opts);
    const params = { page, limit };
    if (opts.status) params.status = opts.status;
    return api.get("/api/orders", { params })
      .then((res) => {
        const { items = [], total = 0, totalPages = 1 } = res.data;
        return { items: items.map(mapOrder), total, page, limit, totalPages };
      });
  }
  return listOrdersPaginatedLocal(opts);
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function listOrdersPaginatedLocal(opts = {}) {
  const { page, limit } = normalizePagination(opts);
  let items = load();
  if (opts.status) items = items.filter((o) => o.status === opts.status);

  const total      = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage   = Math.min(page, totalPages);
  const start      = (safePage - 1) * limit;

  return { items: items.slice(start, start + limit), total, page: safePage, limit, totalPages };
}

/**
 * Advance order to the next status.
 * Enforces role-based ALLOWED_TRANSITIONS.
 *
 * - USE_BACKEND=true : PATCH /api/orders/:id/status → returns Promise<{ok,order?}>
 *   Response shape: { ok: true, data: { ...order } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns {ok} synchronously
 *
 * @param {string} orderId
 * @param {string} newStatus
 * @param {string} [actorRole="admin"]  role of the person making the change
 */
export function updateOrderStatus(orderId, newStatus, actorRole = "admin", cancellationReason) {
  if (USE_BACKEND) {
    return api.patch(`/api/orders/${orderId}/status`, { newStatus, cancellationReason: cancellationReason || null })
      .then((res) => ({ ok: true, order: mapOrder(res.data.data) }))
      .catch((err) => {
        const message = err.response?.data?.message ?? "Gagal memperbarui status order.";
        return { ok: false, message };
      });
  }
  return updateOrderStatusLocal(orderId, newStatus, actorRole, cancellationReason);
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function updateOrderStatusLocal(orderId, newStatus, actorRole = "admin", cancellationReason) {
  const orders = load();
  const order  = orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, message: "Order tidak ditemukan." };

  const allowed = getAllowedNextStatuses(order.status, actorRole, order.orderType || "standard");
  if (!allowed.includes(newStatus)) {
    return {
      ok: false,
      message: `Transisi dari "${order.status}" ke "${newStatus}" tidak diizinkan untuk role "${actorRole}".`,
    };
  }

  const prevStatus = order.status;
  const now        = new Date().toISOString();

  order.status    = newStatus;
  order.updatedAt = now;

  if (newStatus === 'Cancelled') {
    order.cancellationReason = cancellationReason || null;
  }

  // Update timeline entry for this status
  order.timeline = order.timeline || [];
  const entry = order.timeline.find((t) => t.label === newStatus);
  if (entry) entry.at = now;
  else order.timeline.push({ label: newStatus, at: now });

  // Audit trail
  pushHistory(order, { type: "status", from: prevStatus, to: newStatus, by: actorRole });

  save(orders);

  invalidateOwnerCache();
  window.dispatchEvent(new CustomEvent("gala:orders-updated", { detail: { orders } }));

  return { ok: true };
}

/**
 * QC: set a courier tracking number on an order.
 * Automatically advances status to "In Delivery" if still at "Quality Checking".
 *
 * - USE_BACKEND=true : PATCH /api/orders/:id/tracking → returns Promise<{ok,order?}>
 *   Response shape: { ok: true, data: { ...order } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns {ok} synchronously
 *
 * @param {string} orderId
 * @param {string} trackingNumber
 * @param {string} [courierName]  e.g. "JNE", "J&T", "SiCepat"
 * @param {string} [actorRole]
 * @returns {{ ok: boolean, message?: string }|Promise<{ ok: boolean, message?: string }>}
 */
export function setTrackingNumber(orderId, trackingNumber, courierName = "", actorRole = "qc") {
  if (USE_BACKEND) {
    return api.patch(`/api/orders/${orderId}/tracking`, { trackingNumber, courierName })
      .then((res) => ({ ok: true, order: mapOrder(res.data.data) }))
      .catch((err) => {
        const message = err.response?.data?.message ?? "Gagal menyimpan nomor resi.";
        return { ok: false, message };
      });
  }
  return setTrackingNumberLocal(orderId, trackingNumber, courierName, actorRole);
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function setTrackingNumberLocal(orderId, trackingNumber, courierName = "", actorRole = "qc") {
  const orders = load();
  const order  = orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, message: "Order tidak ditemukan." };

  const trimmed = String(trackingNumber || "").trim();
  if (!trimmed) return { ok: false, message: "Nomor resi tidak boleh kosong." };

  order.trackingNumber = trimmed;
  order.courierName    = String(courierName || "").trim();
  order.updatedAt      = new Date().toISOString();

  pushHistory(order, { type: "tracking", trackingNumber: trimmed, courierName: order.courierName, by: actorRole });

  // Auto-advance to "In Delivery" if still at Quality Checking
  if (order.status === "Quality Checking") {
    const prevStatus = order.status;
    const now        = new Date().toISOString();
    order.status     = "In Delivery";
    const entry = (order.timeline || []).find((t) => t.label === "In Delivery");
    if (entry) entry.at = now;
    else order.timeline.push({ label: "In Delivery", at: now });
    pushHistory(order, { type: "status", from: prevStatus, to: "In Delivery", by: actorRole });
  }

  save(orders);
  invalidateOwnerCache();
  window.dispatchEvent(new CustomEvent("gala:orders-updated", { detail: { orders } }));

  return { ok: true };
}

/**
 * Mark an "In Delivery" order as Finished (simulates courier delivery confirmation).
 * Used as a manual fallback until real courier webhook is integrated.
 * @param {string} orderId
 * @param {string} [actorRole]
 */
export function markOrderDelivered(orderId, actorRole = "qc") {
  return updateOrderStatus(orderId, "Finished", actorRole);
}

/**
 * Offline Admin: create an order for a walk-in customer.
 * Same as createOrderFromCart but tagged with source: "offline" and supports adminNote.
 *
 * - USE_BACKEND=true : POST /api/orders/offline → returns Promise<object>
 *   Response shape: { ok: true, data: { ...order } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns object synchronously
 *
 * @param {{ customer: object, items: object[], subtotal: number, adminNote?: string, actorId?: string }} opts
 * @returns {object|Promise<object>} The created order
 */
export function createOfflineOrder({ customer, items, subtotal, adminNote = "", actorId: _actorId = "offline" }) {
  if (USE_BACKEND) {
    return api.post("/api/orders/offline", { customer, items, subtotal, adminNote })
      .then((res) => mapOrder(res.data.data));
  }
  return createOfflineOrderLocal({ customer, items, subtotal, adminNote });
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function createOfflineOrderLocal({ customer, items, subtotal, adminNote = "" }) {
  const order = createOrderFromCartLocal({ customer, items, subtotal });
  // Tag as offline + set initial note
  const orders = load();
  const stored = orders.find((o) => o.id === order.id);
  if (stored) {
    stored.source    = "offline";
    stored.adminNote = String(adminNote || "").trim();
    if (stored.adminNote) {
      pushHistory(stored, { type: "note", value: stored.adminNote });
    }
    save(orders);
  }
  return { ...order, source: "offline", adminNote: String(adminNote || "").trim() };
}

/**
 * Admin: set or update a note on an order (visible to customer in tracking).
 *
 * - USE_BACKEND=true : PATCH /api/orders/:id/note → returns Promise<{ok,order?}>
 *   Response shape: { ok: true, data: { ...order } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged), returns {ok} synchronously
 *
 * @param {string} orderId
 * @param {string} note
 */
export function updateAdminNote(orderId, note) {
  if (USE_BACKEND) {
    return api.patch(`/api/orders/${orderId}/note`, { note })
      .then((res) => ({ ok: true, order: mapOrder(res.data.data) }))
      .catch((err) => {
        const message = err.response?.data?.message ?? "Gagal memperbarui catatan admin.";
        return { ok: false, message };
      });
  }
  return updateAdminNoteLocal(orderId, note);
}

/**
 * Original localStorage implementation — kept intact.
 * @private
 */
function updateAdminNoteLocal(orderId, note) {
  const orders = load();
  const order  = orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, message: "Order tidak ditemukan." };

  const trimmed = String(note || "").trim();
  order.adminNote = trimmed;
  order.updatedAt = new Date().toISOString();

  // Audit trail
  pushHistory(order, { type: "note", value: trimmed });

  save(orders);

  // Hook
  window.dispatchEvent(new CustomEvent("gala:orders-updated", { detail: { orders } }));

  return { ok: true };
}

/**
 * Alias: list orders for a specific customer by their ID.
 * Used by components that call `listOrders(filters)` with a customerId filter.
 *
 * - USE_BACKEND=true : GET /api/orders?page=&limit=&status= → returns Promise<{items,...}>
 * - USE_BACKEND=false: delegates to listOrdersPaginated, returns object synchronously
 *
 * @param {{ page?: number, limit?: number, status?: string }} filters
 * @returns {{ items: object[], total: number, page: number, limit: number, totalPages: number }|Promise<...>}
 */
export function listOrders(filters = {}) {
  return listOrdersPaginated(filters);
}
