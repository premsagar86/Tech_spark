import { clearAdminSession, clearParticipantSession } from "./session.js";

const API_URL = import.meta.env.VITE_API_URL;

const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS);

// Both the access and refresh tokens live in httpOnly cookies now (sent
// automatically via credentials: "include") — there's no token for this file
// to read or attach as a header. A refresh call just needs to succeed; the
// browser applies its Set-Cookie response itself, so the retry below picks
// up the fresh access token automatically. A per-auth-type in-flight cache
// means a burst of 401s (e.g. several admin dashboard calls firing at once)
// only triggers one refresh call, not one per call.
let adminRefreshPromise = null;
let participantRefreshPromise = null;

async function refreshAccessToken(auth) {
  const path = auth === "admin" ? "/api/auth/refresh" : "/api/participants/refresh";
  const res = await fetch(`${API_URL}${path}`, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error("refresh failed");
}

function refreshOnce(auth) {
  if (auth === "admin") {
    if (!adminRefreshPromise) {
      adminRefreshPromise = refreshAccessToken("admin").finally(() => { adminRefreshPromise = null; });
    }
    return adminRefreshPromise;
  }
  if (!participantRefreshPromise) {
    participantRefreshPromise = refreshAccessToken("participant").finally(() => { participantRefreshPromise = null; });
  }
  return participantRefreshPromise;
}

async function request(path, options = {}, { auth } = {}, _retried = false) {
  const headers = { "Content-Type": "application/json", ...options.headers };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers,
      credentials: "include",
      signal: controller.signal,
      ...options,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("The server took too long to respond. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  // Silent refresh: an expired/invalid access token gets one automatic retry
  // after minting a fresh one from the httpOnly refresh cookie — the caller
  // only ever sees a 401 if the refresh itself fails (logged out elsewhere,
  // refresh token revoked/expired/reused).
  if (res.status === 401 && (auth === "admin" || auth === "participant") && !_retried) {
    try {
      await refreshOnce(auth);
      return request(path, options, { auth }, true);
    } catch {
      if (auth === "admin") clearAdminSession();
      else clearParticipantSession();
      // fall through — respond using the original 401 below
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.headers.get("content-type")?.includes("text/csv")) return res.blob();
  return res.json();
}

export const api = {
  // Events
  getEvents: () => request("/api/events"),
  getEvent: (slug) => request(`/api/events/${slug}`),
  getLeaderboard: (slug) => request(`/api/events/${slug}/leaderboard`),

  // Registrations
  register: (payload) => request("/api/registrations", { method: "POST", body: JSON.stringify(payload) }),
  getStatus: (code) => request(`/api/registrations/${code}`),
  getStatusByContact: ({ email, mobile }) =>
    request(`/api/registrations/by-contact?${new URLSearchParams({ email, mobile })}`),
  verifyPayment: (code, payload) =>
    request(`/api/registrations/${code}/verify-payment`, { method: "POST", body: JSON.stringify(payload) }),
  retryPayment: (code) => request(`/api/registrations/${code}/retry-payment`, { method: "POST" }),

  // Auth — one endpoint for both participants and staff, role comes back
  // in the response so the caller knows which token to store.
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),

  // Participants
  getMyRegistration: () => request("/api/participants/me", {}, { auth: "participant" }),
  updateMyProfile: (payload) =>
    request("/api/participants/me/profile", { method: "PATCH", body: JSON.stringify(payload) }, { auth: "participant" }),
  requestMagicLink: (payload) => request("/api/participants/request-link", { method: "POST", body: JSON.stringify(payload) }),
  verifyMagicLink: (token) => request(`/api/participants/verify-link?token=${encodeURIComponent(token)}`),
  participantLogout: () => request("/api/participants/logout", { method: "POST" }, { auth: "participant" }),

  // Admin
  adminLogout: () => request("/api/admin/logout", { method: "POST" }, { auth: "admin" }),
  listRegistrations: (params = {}) =>
    request(`/api/admin/registrations?${new URLSearchParams(params)}`, {}, { auth: "admin" }),
  getAdminStats: () => request("/api/admin/stats", {}, { auth: "admin" }),
  exportRegistrationsCsv: (params = {}) =>
    request(`/api/admin/registrations?${new URLSearchParams({ ...params, format: "csv" })}`, {}, { auth: "admin" }),
  confirmPaymentOverride: (id) =>
    request(`/api/admin/registrations/${id}/confirm-payment`, { method: "PATCH" }, { auth: "admin" }),
  rejectPaymentOverride: (id) =>
    request(`/api/admin/registrations/${id}/reject-payment`, { method: "PATCH" }, { auth: "admin" }),
  deleteRegistration: (id) =>
    request(`/api/admin/registrations/${id}`, { method: "DELETE" }, { auth: "admin" }),
  setRegistrationScore: (id, score) =>
    request(`/api/admin/registrations/${id}/score`, { method: "PATCH", body: JSON.stringify({ score }) }, { auth: "admin" }),
  addTeamMember: (id, payload) =>
    request(`/api/admin/registrations/${id}/participants`, { method: "POST", body: JSON.stringify(payload) }, { auth: "admin" }),
  verifyCheckInCode: (code) => request(`/api/admin/verify/${code}`, {}, { auth: "admin" }),
  checkInParticipant: (id) =>
    request(`/api/admin/participants/${id}/check-in`, { method: "PATCH" }, { auth: "admin" }),
};
