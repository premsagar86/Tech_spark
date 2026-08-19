import { pool } from "../db/pool.js";
import { issueParticipantToken } from "../middleware/participantAuth.js";
import { issueRecoveryToken, verifyRecoveryToken } from "../services/passwordReset.js";
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

    const token = issueParticipantToken(participant);
    res.json({ token });
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
      await sendMagicLinkEmail(participant, token);
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

    res.json({ token: issueParticipantToken(participant) });
  } catch (err) {
    next(err);
  }
}
