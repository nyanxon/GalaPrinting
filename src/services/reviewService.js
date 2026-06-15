/**
 * services/reviewService.js
 * Review system — localStorage backed (USE_BACKEND=false) or API backed (USE_BACKEND=true).
 *
 * Requirements: 16.1
 */

import { readJson, writeJson } from "../core/storage.js";
import { USE_BACKEND, api } from "../core/httpClient.js";

const KEY = "gala.reviews";

/** @typedef {{ id: string, productId: string, productName: string, category: string, customerId: string, customerName: string, rating: number, comment: string, createdAt: string }} Review */

function load() { return readJson(KEY, []); }
function save(d) { writeJson(KEY, d); }

/**
 * List reviews, optionally filtered by productId.
 * @param {string} [productId]
 * @returns {Promise<Review[]>|Review[]}
 */
export async function listReviews(productId) {
  if (USE_BACKEND) {
    const params = productId ? { productId } : {};
    const res = await api.get('/api/reviews', { params });
    // API already returns camelCase fields from the service layer
    return res.data.data ?? [];
  }
  // localStorage fallback — filter by productId if provided
  const all = load();
  return productId ? all.filter((r) => r.productId === productId) : all;
}

/**
 * Create a review.
 * @param {{ productId: string, productName?: string, category?: string, customerId?: string, customerName?: string, rating: number, comment: string }} params
 * @returns {Promise<Review>|Review}
 */
export async function addReview({ productId, productName, category, customerId, customerName, rating, comment, orderId, orderItemId }) {
  if (USE_BACKEND) {
    const res = await api.post('/api/reviews', { productId, orderId, orderItemId, rating, comment });
    return res.data.data;
  }
  // localStorage fallback
  const reviews = load();
  const review = {
    id: crypto.randomUUID(),
    productId, productName, category,
    customerId, customerName,
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    comment: String(comment || "").trim(),
    createdAt: new Date().toISOString(),
  };
  reviews.unshift(review);
  save(reviews);
  return review;
}

/**
 * Delete a review by id.
 * @param {string} reviewId
 * @returns {Promise<{ok:boolean}>|{ok:boolean}}
 */
export async function deleteReview(reviewId) {
  if (USE_BACKEND) {
    await api.delete(`/api/reviews/${reviewId}`);
    return { ok: true };
  }
  // localStorage fallback
  save(load().filter((r) => r.id !== reviewId));
  return { ok: true };
}

/** Seed demo reviews (localStorage only) */
export function seedDemoReviews() {
  if (USE_BACKEND) return; // no seeding needed when backend is active
  if (load().length) return;
  const demos = [
    { id: "r1", productId: "p-stiker", productName: "Stiker Vinyl", category: "Stiker", customerId: "c1", customerName: "Andi", rating: 5, comment: "Kualitas bagus!", createdAt: new Date().toISOString() },
    { id: "r2", productId: "p-brosur", productName: "Brosur A5",    category: "Brosur", customerId: "c2", customerName: "Rina", rating: 4, comment: "Cepat dan rapi.", createdAt: new Date().toISOString() },
  ];
  save(demos);
}
