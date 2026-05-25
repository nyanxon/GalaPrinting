import { readJson, writeJson, remove } from "../core/storage.js";
import { USE_BACKEND, api, setAccessToken, clearSession } from "../core/httpClient.js";
import { syncCartOnLogin } from "./cartService.js";

// ---------------------------------------------------------------------------
// localStorage keys (used when USE_BACKEND=false)
// ---------------------------------------------------------------------------

const USERS_KEY   = "gala.users";
const SESSION_KEY = "gala.session";

// ---------------------------------------------------------------------------
// localStorage helpers (unchanged — only used when USE_BACKEND=false)
// ---------------------------------------------------------------------------

function loadUsers()      { return readJson(USERS_KEY, []); }
function saveUsers(users) { writeJson(USERS_KEY, users); }

export function getSession()  { return readJson(SESSION_KEY, null); }

// ---------------------------------------------------------------------------
// Socket.io lifecycle hooks
//
// NOTE: Socket.io initialisation and teardown are wired up in task 12.6
// (src/services/chatService.js). The functions below are called by login/logout
// so that the socket connects/disconnects at the right moment. They are
// intentionally no-ops until chatService provides real implementations.
// ---------------------------------------------------------------------------

/** @type {(() => void) | null} */
let _socketConnect = null;

/** @type {(() => void) | null} */
let _socketDisconnect = null;

/**
 * Register socket lifecycle callbacks.
 * Called by chatService (task 12.6) once it has initialised socket.io-client.
 *
 * @param {{ connect: () => void, disconnect: () => void }} handlers
 */
export function registerSocketHandlers({ connect, disconnect }) {
  _socketConnect    = connect;
  _socketDisconnect = disconnect;
}

// ---------------------------------------------------------------------------
// logout — shared between both modes for the localStorage path
// ---------------------------------------------------------------------------

/**
 * Log out the current user.
 *
 * - USE_BACKEND=true : calls POST /api/auth/logout, clears in-memory token,
 *   disconnects Socket.io.
 * - USE_BACKEND=false: removes the localStorage session key (original behaviour).
 */
export async function logout() {
  if (USE_BACKEND) {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Best-effort — clear session regardless of server response
    }
    clearSession();                          // clears in-memory token + redirects
    if (_socketDisconnect) _socketDisconnect();
    return;
  }

  // Original localStorage implementation
  remove(SESSION_KEY);
}

// ---------------------------------------------------------------------------
// registerCustomer
// ---------------------------------------------------------------------------

/**
 * Register a new customer account.
 *
 * - USE_BACKEND=true : POST /api/auth/register
 *   Response shape: { ok: true, data: { accessToken, user } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged)
 *
 * Requirements: 16.1, 16.3
 */
export async function registerCustomer({ name, email, phone, password, gender, dob }) {
  if (USE_BACKEND) {
    try {
      const res = await api.post("/api/auth/register", { name, email, phone, password, gender, dob });
      // Server returns { ok, accessToken, user } directly (no .data wrapper)
      const { accessToken, user } = res.data;
      setAccessToken(accessToken);
      if (_socketConnect) _socketConnect(accessToken);
      await syncCartOnLogin();
      return { ok: true, message: "Registrasi berhasil.", user };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Registrasi gagal. Periksa koneksi atau coba lagi nanti.";
      return { ok: false, message };
    }
  }

  // Original localStorage implementation (unchanged)
  const users  = loadUsers();
  const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return { ok: false, message: "Email sudah terdaftar. Silakan login." };

  const user = {
    id: crypto.randomUUID(),
    role: "customer",
    name:     String(name     || "").trim(),
    email:    String(email    || "").trim(),
    phone:    String(phone    || "").trim(),
    password: String(password || ""),
    gender:   gender || null,
    dob:      dob    || null,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  writeJson(SESSION_KEY, { userId: user.id, role: user.role });
  return { ok: true, message: "Registrasi berhasil." };
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

/**
 * Log in with email and password.
 *
 * - USE_BACKEND=true : POST /api/auth/login
 *   Response shape: { ok: true, data: { accessToken, user } }
 *   Stores access token in memory, initialises Socket.io connection.
 * - USE_BACKEND=false: original localStorage implementation (unchanged)
 *
 * Requirements: 16.1, 16.3, 16.6
 */
export async function login({ email, password }) {
  if (USE_BACKEND) {
    try {
      const res = await api.post("/api/auth/login", { email, password });
      // Server returns { ok, accessToken, user } directly (no .data wrapper)
      const { accessToken, user } = res.data;
      setAccessToken(accessToken);
      if (_socketConnect) _socketConnect(accessToken);
      await syncCartOnLogin();
      return { ok: true, message: "Login berhasil.", role: user.role, user };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Login gagal. Periksa koneksi atau coba lagi nanti.";
      return { ok: false, message };
    }
  }

  // Original localStorage implementation (unchanged)
  const users = loadUsers();
  const user  = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || user.password !== password)
    return { ok: false, message: "Email atau password salah." };
  writeJson(SESSION_KEY, { userId: user.id, role: user.role });
  return { ok: true, message: "Login berhasil.", role: user.role };
}

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

/**
 * Return the currently authenticated user object.
 *
 * - USE_BACKEND=true : GET /api/auth/me
 *   Response shape: { ok: true, data: { id, role, name, email, phone, ... } }
 * - USE_BACKEND=false: original localStorage implementation (unchanged)
 *
 * Requirements: 16.1
 */
export async function getCurrentUser() {
  if (USE_BACKEND) {
    try {
      // If we already have an in-memory access token, just call /me directly
      const { getAccessToken } = await import("../core/httpClient.js");
      if (getAccessToken()) {
        const res = await api.get("/api/auth/me");
        return res.data.user ?? null;
      }

      // No in-memory token (e.g. page was refreshed).
      // Attempt a silent token refresh using the HttpOnly cookie.
      // Use a plain axios call (not the `api` instance) to avoid triggering
      // the 401 interceptor which would cause an infinite loop.
      const { default: axios } = await import("axios");
      try {
        const refreshRes = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true }
        );
        const newToken = refreshRes.data.accessToken;
        if (!newToken) return null;
        setAccessToken(newToken);
        if (_socketConnect) _socketConnect(newToken);
      } catch {
        // No valid refresh cookie — user is simply not logged in
        return null;
      }

      // Now fetch the user profile with the restored token
      const res = await api.get("/api/auth/me");
      return res.data.user ?? null;
    } catch {
      return null;
    }
  }

  // Original localStorage implementation (unchanged)
  const session = getSession();
  if (!session) return null;
  const user = loadUsers().find((u) => u.id === session.userId) ?? null;
  // If the user's role changed (e.g. seed fixed it), update the session to match
  if (user && session.role !== user.role) {
    writeJson(SESSION_KEY, { userId: user.id, role: user.role });
  }
  return user;
}

// ---------------------------------------------------------------------------
// listCustomers — admin only, localStorage path only
// ---------------------------------------------------------------------------

/**
 * List all registered customers (for admin Customer menu).
 *
 * When USE_BACKEND=true: calls GET /api/users/customers.
 * When USE_BACKEND=false: reads from localStorage.
 */
export async function listCustomers() {
  if (USE_BACKEND) {
    const res = await api.get('/api/users/customers');
    return res.data.items ?? res.data.data ?? [];
  }
  return loadUsers().filter((u) => u.role === "customer");
}

// (seedStaffUsers removed) Staff accounts are now provided by the backend database.
