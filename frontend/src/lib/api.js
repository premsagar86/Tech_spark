import { getAdminToken, getParticipantToken } from "./session.js";

const API_URL = import.meta.env.VITE_API_URL;

async function request(path, options = {}, { auth } = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };

  if (auth === "admin") {
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } else if (auth === "participant") {
    const token = getParticipantToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    credentials: "include",
    ...options,
  });
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

  // Registrations
  register: (payload) => request("/api/registrations", { method: "POST", body: JSON.stringify(payload) }),
  getStatus: (code) => request(`/api/registrations/${code}`),
  verifyPayment: (code, payload) =>
    request(`/api/registrations/${code}/verify-payment`, { method: "POST", body: JSON.stringify(payload) }),
  retryPayment: (code) => request(`/api/registrations/${code}/retry-payment`, { method: "POST" }),

  // Auth — one endpoint for both participants and staff, role comes back
  // in the response so the caller knows which token to store.
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),

  // Participants
  getMyRegistration: () => request("/api/participants/me", {}, { auth: "participant" }),
  requestMagicLink: (payload) => request("/api/participants/request-link", { method: "POST", body: JSON.stringify(payload) }),
  verifyMagicLink: (token) => request(`/api/participants/verify-link?token=${encodeURIComponent(token)}`),

  // Admin
  adminLogout: () => request("/api/admin/logout", { method: "POST" }, { auth: "admin" }),
  listRegistrations: (params = {}) =>
    request(`/api/admin/registrations?${new URLSearchParams(params)}`, {}, { auth: "admin" }),
  exportRegistrationsCsv: (params = {}) =>
    request(`/api/admin/registrations?${new URLSearchParams({ ...params, format: "csv" })}`, {}, { auth: "admin" }),
  confirmPaymentOverride: (id) =>
    request(`/api/admin/registrations/${id}/confirm-payment`, { method: "PATCH" }, { auth: "admin" }),
  rejectPaymentOverride: (id) =>
    request(`/api/admin/registrations/${id}/reject-payment`, { method: "PATCH" }, { auth: "admin" }),
  addTeamMember: (id, payload) =>
    request(`/api/admin/registrations/${id}/participants`, { method: "POST", body: JSON.stringify(payload) }, { auth: "admin" }),
  verifyCheckInCode: (code) => request(`/api/admin/verify/${code}`, {}, { auth: "admin" }),
  checkInParticipant: (id) =>
    request(`/api/admin/participants/${id}/check-in`, { method: "PATCH" }, { auth: "admin" }),
};
