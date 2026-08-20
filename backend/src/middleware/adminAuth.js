import jwt from "jsonwebtoken";
import { issueRefreshToken } from "../services/refreshTokens.js";

const ADMIN_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function requireAdmin(req, res, next) {
  const token = req.cookies?.adminToken || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Access token is short-lived on purpose — see issueAdminSession() below,
// which pairs it with a long-lived, revocable refresh token.
export function issueAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.id, username: admin.username, role: admin.role },
    process.env.JWT_ADMIN_SECRET,
    { expiresIn: "15m" }
  );
}

// sameSite must be "none" (+ secure) in production — frontend (Amplify) and
// backend (Railway) are different registrable domains, so "lax" would silently
// never send this cookie on cross-site fetch/XHR (only same-site dev, where
// localhost:5173/localhost:3000 count as same-site, hides this).
export function adminRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_REFRESH_TTL_MS,
    path: "/",
  };
}

// Deliberately NOT httpOnly — a small, non-authoritative "who's logged in"
// hint (role only, no signature) so the frontend can render Navbar/routing
// state synchronously without ever touching the real (httpOnly) token. The
// server never trusts this cookie for anything — requireAdmin only ever
// verifies the signed JWT.
export function adminSessionHintCookieOptions() {
  return {
    httpOnly: false,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_REFRESH_TTL_MS,
    path: "/",
  };
}

export function setAdminSessionHint(res, admin) {
  res.cookie("adminSessionHint", JSON.stringify({ role: admin.role }), adminSessionHintCookieOptions());
}

export async function issueAdminSession(res, admin) {
  const accessToken = issueAdminToken(admin);
  const { token } = await issueRefreshToken("admin", admin.id, ADMIN_REFRESH_TTL_MS);
  res.cookie("adminRefreshToken", token, adminRefreshCookieOptions());
  setAdminSessionHint(res, admin);
  return accessToken;
}

export { ADMIN_REFRESH_TTL_MS };

// Chain after requireAdmin, which sets req.admin from the verified token.
export function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!allowedRoles.includes(req.admin?.role)) {
      return res.status(403).json({ error: "Not authorized for this action" });
    }
    next();
  };
}
