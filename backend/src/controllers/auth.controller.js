import { issueParticipantSession } from "../middleware/participantAuth.js";
import {
  issueAdminToken,
  issueAdminSession,
  adminRefreshCookieOptions,
  ADMIN_REFRESH_TTL_MS,
} from "../middleware/adminAuth.js";
import { rotateRefreshToken } from "../services/refreshTokens.js";
import { getParticipantByEmailAndMobile } from "../models/participants.model.js";
import { getAdminByEmailAndMobile, getAdminById } from "../models/admins.model.js";

const ADMIN_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 15 * 60 * 1000,
};

// Single entry point for both participants and staff — identify by
// email+mobile (participants never had a password; admins/scanners no
// longer do either, see schema.sql) and issue a token carrying whichever
// role matched. Participants are checked first since that's the far more
// common login.
export async function login(req, res, next) {
  try {
    const { email, mobile } = req.body;

    const participant = await getParticipantByEmailAndMobile(email, mobile);
    if (participant) {
      const token = await issueParticipantSession(res, participant);
      return res.json({ role: "participant", token });
    }

    const admin = await getAdminByEmailAndMobile(email, mobile);
    if (admin) {
      const token = await issueAdminSession(res, admin);
      res.cookie("adminToken", token, ADMIN_TOKEN_COOKIE_OPTIONS);
      return res.json({ role: admin.role, token });
    }

    res.status(401).json({ error: "No matching account found" });
  } catch (err) {
    next(err);
  }
}

// Silently mints a new short-lived access token from the httpOnly refresh
// cookie — called by the frontend's request() on a 401, never by the user
// directly. A reused/expired/unknown refresh token clears both cookies and
// 401s, forcing a real re-login (see rotateRefreshToken's reuse-detection).
export async function refreshAdmin(req, res, next) {
  try {
    const raw = req.cookies?.adminRefreshToken;
    if (!raw) return res.status(401).json({ error: "Not authenticated" });

    const rotated = await rotateRefreshToken("admin", raw, ADMIN_REFRESH_TTL_MS);
    if (!rotated) {
      res.clearCookie("adminRefreshToken", adminRefreshCookieOptions());
      res.clearCookie("adminToken", ADMIN_TOKEN_COOKIE_OPTIONS);
      return res.status(401).json({ error: "Session expired, please log in again" });
    }
    res.cookie("adminRefreshToken", rotated.token, adminRefreshCookieOptions());

    const admin = await getAdminById(rotated.subjectId);
    if (!admin) return res.status(401).json({ error: "Not authenticated" });

    const token = issueAdminToken(admin);
    res.cookie("adminToken", token, ADMIN_TOKEN_COOKIE_OPTIONS);
    res.json({ role: admin.role, token });
  } catch (err) {
    next(err);
  }
}
