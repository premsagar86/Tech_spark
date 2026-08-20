import { Router } from "express";
import { loginLimiter, recoveryLimiter } from "../middleware/rateLimiter.js";
import { requireParticipant } from "../middleware/participantAuth.js";
import {
  loginParticipant,
  refreshParticipant,
  logoutParticipant,
  getMyRegistration,
  requestMagicLink,
  verifyMagicLink,
  updateMyProfile,
  getCheckInQrImage,
} from "../controllers/participants.controller.js";

const router = Router();

router.post("/login", loginLimiter, loginParticipant);
router.post("/refresh", loginLimiter, refreshParticipant);
router.post("/logout", logoutParticipant);
router.get("/me", requireParticipant, getMyRegistration);
router.patch("/me/profile", requireParticipant, updateMyProfile);
router.post("/request-link", recoveryLimiter, requestMagicLink);
router.get("/verify-link", verifyMagicLink);
router.get("/qr/:code", getCheckInQrImage);

export default router;
