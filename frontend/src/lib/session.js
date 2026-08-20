// Session state lives entirely in cookies, not localStorage. The real tokens
// (access + refresh, for both admin and participant) are httpOnly cookies set
// by the backend — invisible to this file on purpose, since that's what
// actually blocks an XSS payload from stealing them; a plain readable cookie
// would offer no more protection than localStorage did. For UI purposes only
// (Navbar, routing, "am I logged in") the backend also sets one small,
// non-httpOnly "session hint" cookie per audience — no signature, never
// trusted server-side for authorization, same non-authoritative status these
// values already had when they were decoded out of a JWT.

const ADMIN_HINT_COOKIE = "adminSessionHint";
const PARTICIPANT_HINT_COOKIE = "participantSessionHint";

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Only clears what JS can actually clear — the httpOnly token/refresh
// cookies are cleared server-side by the logout endpoints callers already
// invoke alongside this.
function clearCookie(name) {
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

function readHint(cookieName) {
  const raw = readCookie(cookieName);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Same-tab components (e.g. Navbar) can't rely on the native "storage" event
// — that never fires for cookies at all, and even for localStorage it only
// fires in *other* tabs — so broadcast our own event whenever login state
// changes.
export function notifySessionChanged() {
  window.dispatchEvent(new Event("ts2026-session-changed"));
}

export function isAdminLoggedIn() {
  return Boolean(readCookie(ADMIN_HINT_COOKIE));
}

export function isParticipantLoggedIn() {
  return Boolean(readCookie(PARTICIPANT_HINT_COOKIE));
}

export function clearAdminSession() {
  clearCookie(ADMIN_HINT_COOKIE);
  notifySessionChanged();
}

export function clearParticipantSession() {
  clearCookie(PARTICIPANT_HINT_COOKIE);
  notifySessionChanged();
}

// UI-only read (which nav items/redirects to show) — the server is the real
// authority via requireRole, this cookie is never trusted for authorization.
export function getAdminRole() {
  return readHint(ADMIN_HINT_COOKIE)?.role ?? null;
}

// Same non-authoritative client-side read as getAdminRole() — just for
// picking "me" out of a team roster, not for authorization.
export function getParticipantId() {
  return readHint(PARTICIPANT_HINT_COOKIE)?.participantId ?? null;
}
