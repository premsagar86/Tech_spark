import jwt from "jsonwebtoken";
import { issueParticipantSession } from "../middleware/participantAuth.js";
import {
  issueAdminToken,
  issueAdminSession,
  adminRefreshCookieOptions,
  adminTokenCookieOptions,
  setAdminSessionHint,
  adminSessionHintCookieOptions,
  ADMIN_REFRESH_TTL_MS,
} from "../middleware/adminAuth.js";
import { rotateRefreshToken } from "../services/refreshTokens.js";
import { getParticipantByEmailAndMobile } from "../models/participants.model.js";
import { getAdminByEmailAndMobile, getAdminById } from "../models/admins.model.js";

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
      await issueParticipantSession(res, participant);
      return res.json({ role: "participant" });
    }

    const admin = await getAdminByEmailAndMobile(email, mobile);
    if (admin) {
      const token = await issueAdminSession(res, admin);
      res.cookie("adminToken", token, adminTokenCookieOptions());
      return res.json({ role: admin.role });
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
      res.clearCookie("adminToken", adminTokenCookieOptions());
      res.clearCookie("adminSessionHint", adminSessionHintCookieOptions());
      return res.status(401).json({ error: "Session expired, please log in again" });
    }
    res.cookie("adminRefreshToken", rotated.token, adminRefreshCookieOptions());

    const admin = await getAdminById(rotated.subjectId);
    if (!admin) return res.status(401).json({ error: "Not authenticated" });

    const token = issueAdminToken(admin);
    res.cookie("adminToken", token, adminTokenCookieOptions());
    setAdminSessionHint(res, admin);
    res.json({ role: admin.role });
  } catch (err) {
    next(err);
  }
}

// Status probe for the frontend's "am I logged in" UI state — cookies set by
// the backend (Railway) aren't readable via document.cookie on the frontend's
// origin (Amplify) when the two aren't same-site, so the client can't just
// parse a hint cookie itself; it has to ask the server, which reads the real
// httpOnly cookies fine regardless of cross-site restrictions. Always 200 —
// this reports status, it doesn't gate access (requireAdmin/requireParticipant
// still do that on the actual protected routes).
export function getSession(req, res) {
  const adminToken = req.cookies?.adminToken;
  if (adminToken) {
    try {
      const payload = jwt.verify(adminToken, process.env.JWT_ADMIN_SECRET);
      return res.json({ role: payload.role, adminId: payload.adminId });
    } catch {
      // fall through — an expired/invalid adminToken doesn't rule out a valid participantToken
    }
  }

  const participantToken = req.cookies?.participantToken;
  if (participantToken) {
    try {
      const payload = jwt.verify(participantToken, process.env.JWT_PARTICIPANT_SECRET);
      return res.json({ role: "participant", participantId: payload.participantId });
    } catch {
      // fall through to the logged-out response below
    }
  }

  res.json({ role: null });
}
