import { Router } from "express";
import { loginLimiter, recoveryLimiter } from "../middleware/rateLimiter.js";
import { requireParticipant } from "../middleware/participantAuth.js";
import {
  loginParticipant,
  getMyRegistration,
  requestMagicLink,
  verifyMagicLink,
  updateMyProfile,
} from "../controllers/participants.controller.js";

const router = Router();

router.post("/login", loginLimiter, loginParticipant);
router.get("/me", requireParticipant, getMyRegistration);
router.patch("/me/profile", requireParticipant, updateMyProfile);
router.post("/request-link", recoveryLimiter, requestMagicLink);
router.get("/verify-link", verifyMagicLink);

export default router;
