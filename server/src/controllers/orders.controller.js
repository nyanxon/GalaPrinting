/**
 * orders.controller.js — Request handlers for order endpoints.
 *
 * Requirements: 7.1–7.11
 */

import * as svc from '../services/orders.service.js';
import * as productSvc from '../services/products.service.js';
import { StorageService } from '../utils/storage.js';
import { getIO } from '../socket/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function emitOrderNew(order) {
  try {
    getIO().to('staff').emit('order:new', {
      orderId:      order.id,
      orderNumber:  order.order_number,
      customerName: order.customer_name,
      subtotal:     order.subtotal,
      createdAt:    order.created_at,
    });
  } catch { /* Socket.io may not be ready in tests */ }
}

function emitOrderStatusChanged(order, previousStatus) {
  try {
    const io = getIO();
    const payload = {
      orderId:        order.id,
      orderNumber:    order.order_number,
      previousStatus,
      newStatus:      order.status,
      updatedAt:      order.updated_at,
    };
    if (order.customer_id) {
      io.to(`customer:${order.customer_id}`).emit('order:status_changed', payload);
    }
    io.to('staff').emit('order:status_changed', payload);
  } catch { /* ignore */ }
}

/**
 * Parse variant_prices — stored as a JSON string in products.variant_prices,
 * keyed by `{ukuran}|{bahan}`. Returns a plain object.
 */
function parseVariantPrices(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/**
 * Resolve unit price for an offline order item, server-side.
 *
 * Harga dasar mengikuti customer_type (price_customer / price_broker).
 * Jika item memilih ukuran dan/atau bahan dan produk punya variant price
 * untuk kombinasi `{ukuran}|{bahan}`, harga varian menggantikan harga dasar
 * dengan harga yang disesuaikan customer_type:
 *   - format baru: { key: { customer, broker } }
 *   - format lama: { key: number } → sama untuk customer & broker.
 * Warna tidak memengaruhi harga.
 */
function resolveOfflineUnitPrice(product, customerType, size, material) {
  const base = Number(customerType === 'broker' ? product.price_broker : product.price_customer) || 0;
  if (size || material) {
    const key = `${size || ''}|${material || ''}`;
    const raw = parseVariantPrices(product.variant_prices)[key];
    let customer = null;
    let broker = null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      customer = raw;
      broker = raw;
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const c = Number(raw.customer);
      const b = Number(raw.broker);
      customer = Number.isFinite(c) ? c : null;
      broker = Number.isFinite(b) ? b : null;
    }
    const variant = customerType === 'broker' ? broker : customer;
    if (variant !== null && variant >= 0) return variant;
  }
  return base;
}

// ── Controllers ───────────────────────────────────────────────────────────────

export async function createOrder(req, res, next) {
  try {
    // Accept both flat fields (customerName/Phone/Address) and nested customer object
    const {
      items,
      subtotal,
      orderType,
      customer: customerObj,
      customerName,
      customerPhone,
      customerAddress,
      promoCode,
      discountAmount,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ ok: false, message: 'Pesanan harus memiliki minimal 1 item.' });
    }

    const computed = items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0);
    if (Math.abs(computed - Number(subtotal || 0)) > 1) {
      return res.status(422).json({ ok: false, message: 'Subtotal tidak sesuai dengan total item.' });
    }

    const customer = {
      id:           req.user.id,
      name:         customerObj?.name         || customerName    || req.user.name,
      phone:        customerObj?.phone        || customerPhone,
      address:      customerObj?.address      || customerAddress,
      addressTitle: customerObj?.addressTitle || null,
    };
    const order = await svc.createOrder({
      customer,
      items,
      subtotal,
      source: 'online',
      orderType: orderType || 'standard',
      promoCode: promoCode || null,
      discountAmount: Number(discountAmount) || 0,
    });
    emitOrderNew(order);
    return res.status(201).json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function createCustomOrderByCustomer(req, res, next) {
  try {
    const { items, subtotal } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ ok: false, message: 'Pesanan harus memiliki minimal 1 item.' });
    }

    const customer = {
      id:      req.user.id,
      name:    req.user.name,
      phone:   req.user.phone || '',
      address: req.user.address || '',
    };

    const order = await svc.createOrder({
      customer,
      items,
      subtotal: Number(subtotal) || 0,
      source: 'custom',
      orderType: 'custom',
      initialStatus: 'Waiting for Design Approval',
    });
    emitOrderNew(order);
    return res.status(201).json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function createCustomOrder(req, res, next) {
  try {
    const { items, subtotal, customerName, customerPhone, customerAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ ok: false, message: 'Pesanan harus memiliki minimal 1 item.' });
    }

    const computed = items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0);
    if (Math.abs(computed - Number(subtotal || 0)) > 1) {
      return res.status(422).json({ ok: false, message: 'Subtotal tidak sesuai dengan total item.' });
    }

    const customer = { id: req.user.id, name: customerName, phone: customerPhone, address: customerAddress };
    const order = await svc.createOrder({
      customer,
      items,
      subtotal,
      source: 'custom',
      orderType: 'custom',
      initialStatus: 'Waiting for Design Approval',
    });
    emitOrderNew(order);
    return res.status(201).json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function createOfflineOrder(req, res, next) {
  try {
    // Accept both flat fields (customerName/Phone/Address) and nested customer object
    const {
      items,
      customer: customerObj,
      customerName,
      customerPhone,
      customerAddress,
      customerEmail,
      adminNote,
      customerType,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ ok: false, message: 'Pesanan harus memiliki minimal 1 item.' });
    }

    const type = customerType === 'broker' ? 'broker' : 'customer';

    // ── Server-side price resolution ────────────────────────────────────────
    // Harga tidak dipercaya dari client. Untuk item yang punya product_id,
    // harga satuan di-resolve dari tabel products sesuai customer_type.
    // Hasilnya disimpan sebagai snapshot di order_items.price.
    const productIds = [...new Set(
      items.map((i) => i.productId ?? i.product_id ?? null).filter(Boolean)
    )];
    const productsById = new Map();
    if (productIds.length > 0) {
      const prods = await productSvc.getProductsByIds(productIds);
      for (const p of prods) productsById.set(p.id, p);
    }

    const resolvedItems = items.map((item) => {
      const pid = item.productId ?? item.product_id ?? null;
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const notes = item.notes ?? item.keterangan ?? null;

      if (pid) {
        const prod = productsById.get(pid);
        if (!prod) {
          const err = new Error(`Produk tidak ditemukan: ${item.name || pid}`);
          err.status = 422;
          throw err;
        }
        const color = item.color ?? item.warna ?? null;

        // Produk per m²: harga = luas (min. 1 m²) × harga/m², dimensi wajib.
        if (prod.size_type === 'per_m2') {
          const lengthCm = item.lengthCm ?? item.length_cm ?? item.panjang ?? null;
          const widthCm  = item.widthCm  ?? item.width_cm  ?? item.lebar  ?? null;
          const l = Number(lengthCm);
          const w = Number(widthCm);
          if (!(l > 0) || !(w > 0)) {
            const err = new Error(`Panjang dan lebar wajib diisi untuk produk per m²: ${item.name || prod.name}`);
            err.status = 422;
            throw err;
          }
          const base = Number(type === 'broker' ? prod.price_broker : prod.price_customer) || 0;
          const billedArea = Math.max((l / 100) * (w / 100), 1);
          const linePrice = Math.round(billedArea * base);
          return {
            productId: pid,
            name: item.name || prod.name,
            price: linePrice,
            quantity,
            notes,
            color,
            size: `${l} × ${w} cm`,
            material: null,
            lengthCm: l,
            widthCm: w,
          };
        }

        const unitPrice = resolveOfflineUnitPrice(
          prod,
          type,
          item.size ?? item.ukuran,
          item.material ?? item.bahan
        );
        return {
          productId: pid,
          name: item.name || prod.name,
          price: unitPrice,
          quantity,
          notes,
          color,
          size:     item.size     ?? item.ukuran   ?? null,
          material: item.material ?? item.bahan    ?? null,
          lengthCm: null,
          widthCm:  null,
        };
      }

      // Item manual tanpa product_id (backward compat) — pakai harga dari form.
      return {
        productId: null,
        name: item.name,
        price: Number(item.price || 0),
        quantity,
        notes,
        color:    item.color    ?? item.warna    ?? null,
        size:     item.size     ?? item.ukuran   ?? null,
        material: item.material ?? item.bahan    ?? null,
        lengthCm: null,
        widthCm:  null,
      };
    });

    // Subtotal dihitung ulang dari harga hasil resolve — tidak percaya client.
    const resolvedSubtotal = resolvedItems.reduce(
      (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1),
      0
    );

    const customer = {
      id:      null,
      name:    customerObj?.name    || customerName    || '',
      phone:   customerObj?.phone   || customerPhone   || '',
      address: customerObj?.address || customerAddress || '',
      email:   customerObj?.email   || customerEmail   || '',
    };

    // Offline orders start at "On Progress" — payment and design steps are
    // handled in-store before the order is entered into the system.
    const order = await svc.createOrder({
      customer,
      items: resolvedItems,
      subtotal: resolvedSubtotal,
      source: 'offline',
      orderType: 'standard',
      initialStatus: 'On Progress',
      adminNote: adminNote || '',
      customerType: type,
    });
    emitOrderNew(order);
    return res.status(201).json({ ok: true, data: order });
  } catch (err) {
    if (err.status === 422) {
      return res.status(422).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function listOrders(req, res, next) {
  try {
    const { page, limit, status } = req.query;
    const result = await svc.listOrders({ page, limit, status });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listMyOrders(req, res, next) {
  try {
    const orders = await svc.listOrdersByCustomer({ customerId: req.user.id });
    return res.json({ ok: true, items: orders });
  } catch (err) {
    next(err);
  }
}

export async function trackOrder(req, res, next) {
  try {
    const { orderNumber, phone } = req.query;
    if (!orderNumber) {
      return res.status(400).json({ ok: false, message: 'orderNumber wajib diisi.' });
    }
    // phone is optional — if omitted, findOrder matches by orderNumber only
    const order = await svc.findOrder({ orderNumber, phone: phone || null });
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Pesanan tidak ditemukan.' });
    }
    return res.json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function getOrder(req, res, next) {
  try {
    const order = await svc.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Pesanan tidak ditemukan.' });
    }
    return res.json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { newStatus, cancellationReason } = req.body;
    if (!newStatus) {
      return res.status(422).json({ ok: false, message: 'Status wajib diisi.' });
    }
    if (newStatus === 'Cancelled' && !cancellationReason?.trim()) {
      return res.status(422).json({ ok: false, message: 'Alasan pembatalan wajib diisi.' });
    }
    const current = await svc.getOrderById(req.params.id);
    const previousStatus = current?.status;
    const order = await svc.updateOrderStatus(req.params.id, newStatus, req.user.id, req.user.role, cancellationReason, req.user.name);
    emitOrderStatusChanged(order, previousStatus);
    return res.json({ ok: true, data: order });
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      return res.status(err.status).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

export async function updateAdminNote(req, res, next) {
  try {
    const order = await svc.updateAdminNote(req.params.id, req.body.note || '');
    return res.json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function setTracking(req, res, next) {
  try {
    const { trackingNumber, courierName } = req.body;
    if (!trackingNumber) {
      return res.status(422).json({ ok: false, message: 'Nomor resi wajib diisi.' });
    }
    const order = await svc.setTrackingNumber(req.params.id, trackingNumber, courierName, req.user.id);
    return res.json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /:id/delivery-method — set metode pengiriman (Fitur 3)
 */
export async function setDeliveryMethod(req, res, next) {
  try {
    const { delivery_method } = req.body;
    if (!delivery_method) {
      return res.status(422).json({ ok: false, message: 'delivery_method wajib diisi.' });
    }
    const order = await svc.setDeliveryMethod(req.params.id, delivery_method);
    return res.json({ ok: true, data: order });
  } catch (err) {
    if (err.status === 422 || err.status === 404) {
      return res.status(err.status).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

/**
 * PATCH /:id/pickup — set info lokasi & jadwal pickup (Fitur 3)
 */
export async function setPickupInfo(req, res, next) {
  try {
    const { pickup_location, pickup_ready_at } = req.body;
    if (!pickup_location) {
      return res.status(422).json({ ok: false, message: 'pickup_location wajib diisi.' });
    }
    const order = await svc.setPickupInfo(req.params.id, { pickup_location, pickup_ready_at });
    return res.json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function uploadPaymentProof(req, res, next) {
  try {
    if (!req.file) {
      return res.status(422).json({ ok: false, message: 'File bukti pembayaran wajib diunggah.' });
    }
    const { path: filePath } = await StorageService.save(req.file, 'payments');
    const order = await svc.attachPaymentProof(req.params.id, filePath);

    try {
      getIO().to('staff').emit('order:payment_proof', {
        orderId:    order.id,
        orderNumber: order.order_number,
        uploadedAt: new Date().toISOString(),
      });
    } catch { /* ignore */ }

    return res.json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function deleteOrder(req, res, next) {
  try {
    const order = await svc.deleteOrder(req.params.id);
    return res.json({ ok: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function uploadDesignFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(422).json({ ok: false, message: 'File desain wajib diunggah.' });
    }

    const { id: orderId, itemId } = req.params;

    // Verify order belongs to this customer
    const order = await svc.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Pesanan tidak ditemukan.' });
    }
    if (order.customer_id && order.customer_id !== req.user.id) {
      return res.status(403).json({ ok: false, message: 'Akses ditolak.' });
    }

    const { path: filePath, url } = await StorageService.save(req.file, 'designs');
    await svc.attachDesignFile(itemId, filePath);

    return res.json({ ok: true, data: { itemId, designFilePath: url } });
  } catch (err) {
    next(err);
  }
}
