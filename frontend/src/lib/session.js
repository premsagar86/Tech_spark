// Storage helpers for the two separate JWTs the app carries (Part 7/Part 9):
// admin and participant tokens are deliberately never mixed.

const PARTICIPANT_KEY = "ts2026_participant_token";
const ADMIN_KEY = "ts2026_admin_token";

// Same-tab components (e.g. Navbar) can't rely on the native "storage" event
// — that only fires in *other* tabs — so broadcast our own event whenever a
// token is set/cleared.
function notifySessionChanged() {
  window.dispatchEvent(new Event("ts2026-session-changed"));
}

export function getParticipantToken() {
  return localStorage.getItem(PARTICIPANT_KEY);
}

export function setParticipantToken(token) {
  localStorage.setItem(PARTICIPANT_KEY, token);
  notifySessionChanged();
}

export function clearParticipantToken() {
  localStorage.removeItem(PARTICIPANT_KEY);
  notifySessionChanged();
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_KEY);
}

export function setAdminToken(token) {
  localStorage.setItem(ADMIN_KEY, token);
  notifySessionChanged();
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_KEY);
  notifySessionChanged();
}

// Reads the role claim out of the stored admin JWT for UI purposes only
// (e.g. which nav items/redirects to show) — the signature isn't verified
// here, the server is the real authority via requireRole.
export function getAdminRole() {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

// Same non-authoritative client-side read as getAdminRole() — just for
// picking "me" out of a team roster, not for authorization.
export function getParticipantId() {
  const token = getParticipantToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.participantId ?? null;
  } catch {
    return null;
  }
}
