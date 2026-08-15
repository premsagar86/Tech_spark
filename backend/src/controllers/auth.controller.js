import { issueParticipantToken } from "../middleware/participantAuth.js";
import { issueAdminToken } from "../middleware/adminAuth.js";
import { getParticipantByEmailAndMobile } from "../models/participants.model.js";
import { getAdminByEmailAndMobile } from "../models/admins.model.js";

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
      const token = issueParticipantToken(participant);
      return res.json({ role: "participant", token });
    }

    const admin = await getAdminByEmailAndMobile(email, mobile);
    if (admin) {
      const token = issueAdminToken(admin);
      res.cookie("adminToken", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 12 * 60 * 60 * 1000,
      });
      return res.json({ role: admin.role, token });
    }

    res.status(401).json({ error: "No matching account found" });
  } catch (err) {
    next(err);
  }
}
