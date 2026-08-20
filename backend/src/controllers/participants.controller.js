import { pool } from "../db/pool.js";
import {
  issueParticipantToken,
  issueParticipantSession,
  participantRefreshCookieOptions,
  PARTICIPANT_REFRESH_TTL_MS,
} from "../middleware/participantAuth.js";
import { issueRecoveryToken, verifyRecoveryToken } from "../services/passwordReset.js";
import { rotateRefreshToken, revokeRefreshToken } from "../services/refreshTokens.js";
import { sendMagicLinkEmail } from "../services/email.js";
import {
  getParticipantByEmailAndMobile,
  getParticipantByEmail,
  getParticipantById,
  updateParticipantProfile,
} from "../models/participants.model.js";
import { listParticipantsForRegistration, getRegistrationById } from "../models/registrations.model.js";

export async function loginParticipant(req, res, next) {
  try {
    const { email, mobile } = req.body;
    // Matches ANY participant row — leader or team member — not just the
    // person who originally submitted the form. No match (missing/mismatched
    // email or mobile on file) is a clean 401, never a silent allow.
    const participant = await getParticipantByEmailAndMobile(email, mobile);
    if (!participant) return res.status(401).json({ error: "No matching registration found" });

    const token = await issueParticipantSession(res, participant);
    res.json({ token });
  } catch (err) {
    next(err);
  }
}

// Silently mints a new short-lived access token from the httpOnly refresh
// cookie — called by the frontend's request() on a 401, never by the user
// directly. A reused/expired/unknown refresh token clears the cookie and
// 401s, forcing a real re-login (see rotateRefreshToken's reuse-detection).
export async function refreshParticipant(req, res, next) {
  try {
    const raw = req.cookies?.participantRefreshToken;
    if (!raw) return res.status(401).json({ error: "Not authenticated" });

    const rotated = await rotateRefreshToken("participant", raw, PARTICIPANT_REFRESH_TTL_MS);
    if (!rotated) {
      res.clearCookie("participantRefreshToken", participantRefreshCookieOptions());
      return res.status(401).json({ error: "Session expired, please log in again" });
    }
    res.cookie("participantRefreshToken", rotated.token, participantRefreshCookieOptions());

    const participant = await getParticipantById(rotated.subjectId);
    if (!participant) return res.status(401).json({ error: "Not authenticated" });

    res.json({ token: issueParticipantToken(participant) });
  } catch (err) {
    next(err);
  }
}

// Participants previously had no server-side logout at all (the navbar just
// cleared the local token) — now there's a refresh token to revoke too.
export async function logoutParticipant(req, res, next) {
  try {
    await revokeRefreshToken("participant", req.cookies?.participantRefreshToken);
    res.clearCookie("participantRefreshToken", participantRefreshCookieOptions());
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function getMyRegistration(req, res, next) {
  try {
    const registration = await getRegistrationById(req.participant.registrationId);
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    const participants = await listParticipantsForRegistration(req.participant.registrationId);
    res.json({ registration, participants });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const { githubUrl, linkedinUrl } = req.body;
    const participant = await updateParticipantProfile(req.participant.participantId, { githubUrl, linkedinUrl });
    res.json({ participant });
  } catch (err) {
    next(err);
  }
}

// Reframed "forgot password" for participants (Part 7): there's no real
// password here, so the recovery need is served by a magic sign-in link
// instead. Same generic non-revealing response either way.
export async function requestMagicLink(req, res, next) {
  try {
    const { email } = req.body;
    const participant = await getParticipantByEmail(email);

    if (participant) {
      const token = issueRecoveryToken({
        purpose: "participant_magic_link",
        subjectId: participant.id,
        invalidateWith: participant.mobile, // stops working once the mobile on file changes
        secret: process.env.JWT_PARTICIPANT_SECRET,
      });
      // Not awaited — the response is identical either way (never reveal
      // whether the email matched), so there's no reason to block on a live
      // SMTP send. Same fix as the confirmation email's blocking-response bug.
      sendMagicLinkEmail(participant, token).catch((err) =>
        console.error(`Magic link email failed for participant ${participant.id}`, err)
      );
    }
    res.json({ message: "If that email is on a registration, a sign-in link has been sent." });
  } catch (err) {
    next(err);
  }
}

export async function verifyMagicLink(req, res, next) {
  try {
    const { token } = req.query;
    let payload;
    try {
      payload = verifyRecoveryToken(token, "participant_magic_link", process.env.JWT_PARTICIPANT_SECRET);
    } catch {
      return res.status(400).json({ error: "Link is invalid or has expired" });
    }

    const participant = await getParticipantById(payload.subjectId);
    if (!participant || participant.mobile !== payload.invalidateWith) {
      return res.status(400).json({ error: "Link has already been used" });
    }

    res.json({ token: await issueParticipantSession(res, participant) });
  } catch (err) {
    next(err);
  }
}
