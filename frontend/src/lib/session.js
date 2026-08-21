// Session state is server-verified, not read from a cookie. The real tokens
// (access + refresh, for both admin and participant) are httpOnly cookies set
// by the backend (Railway) — invisible to this file on purpose, since that's
// what actually blocks an XSS payload from stealing them. Frontend (Amplify)
// and backend (Railway) are cross-site here, and document.cookie can only
// ever see cookies belonging to the page's own origin no matter what
// SameSite/Secure/Partitioned attributes a cookie has — so "am I logged in"
// can't be answered by parsing a cookie client-side; it has to ask the
// server (GET /api/auth/session), which reads the real cookies fine across
// origins.
import { useEffect, useState } from "react";
import { api } from "./api.js";

let session = { role: null, participantId: null, adminId: null, loaded: false };

// Guards against an out-of-order response: the boot-time loadSession() call
// (fired on every page, including /login, before anyone's authenticated) can
// still be in flight — e.g. behind a slow/cold-starting backend — when login
// calls refreshSession() and gets a newer, correct answer back first. Without
// this, the stale pre-login response arriving afterwards would blindly
// overwrite the fresh post-login session back to "logged out". Each fetch
// captures the sequence number current at its own start and only applies its
// result if nothing newer has been kicked off since.
let requestSeq = 0;
let currentPromise = null;

// Same-tab components (e.g. Navbar) can't rely on the native "storage" event
// — that never fires for cookies at all, and even for localStorage it only
// fires in *other* tabs — so broadcast our own event whenever login state
// changes.
export function notifySessionChanged() {
  window.dispatchEvent(new Event("ts2026-session-changed"));
}

function setSession(next) {
  session = { ...session, ...next, loaded: true };
  notifySessionChanged();
}

function fetchSession() {
  const seq = ++requestSeq;
  currentPromise = api
    .getSession()
    .then((data) => ({ role: data.role, participantId: data.participantId ?? null, adminId: data.adminId ?? null }))
    .catch(() => ({ role: null, participantId: null, adminId: null }))
    .then((next) => {
      if (seq !== requestSeq) return; // superseded by a newer request — this result is stale, ignore it
      setSession(next);
    });
  return currentPromise;
}

// Fetches the session once and caches it; safe to call from multiple
// components — they all share the same in-flight/completed promise.
export function loadSession() {
  if (!currentPromise) fetchSession();
  return currentPromise;
}

// Forces a fresh look at the server — called right after login/magic-link
// verification, since the cookies just changed and the cached answer (from
// before login) is now stale. Always starts a new request (bumping
// requestSeq so any older, still-in-flight request's result gets discarded).
export function refreshSession() {
  return fetchSession();
}

export function isAdminLoggedIn() {
  return session.role === "admin" || session.role === "scanner";
}

export function isParticipantLoggedIn() {
  return session.role === "participant";
}

// UI-only read (which nav items/redirects to show) — the server is the real
// authority via requireRole, this is never trusted for authorization.
export function getAdminRole() {
  return isAdminLoggedIn() ? session.role : null;
}

// Same non-authoritative client-side read as getAdminRole() — just for
// picking "me" out of a team roster, not for authorization.
export function getParticipantId() {
  return session.participantId;
}

// Only clears what's known client-side — the httpOnly token/refresh cookies
// are cleared server-side by the logout endpoints callers already invoke
// alongside this.
export function clearAdminSession() {
  requestSeq++; // invalidate any in-flight fetch so it can't overwrite this with a stale role
  currentPromise = null;
  setSession({ role: null, adminId: null });
}

export function clearParticipantSession() {
  requestSeq++;
  currentPromise = null;
  setSession({ role: null, participantId: null });
}

// React hook for components that need to react once the session fetch
// resolves, rather than reading a synchronous value that starts out wrong
// (logged-out) until loadSession() finishes.
export function useSession() {
  const [state, setState] = useState(session);

  useEffect(() => {
    if (!session.loaded) loadSession();
    function handleChange() {
      setState(session);
    }
    window.addEventListener("ts2026-session-changed", handleChange);
    return () => window.removeEventListener("ts2026-session-changed", handleChange);
  }, []);

  return { ...state, loading: !state.loaded };
}
