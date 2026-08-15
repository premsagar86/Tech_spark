import { Router } from "express";
import { loginLimiter, recoveryLimiter } from "../middleware/rateLimiter.js";
import { requireParticipant } from "../middleware/participantAuth.js";
import {
  loginParticipant,
  getMyRegistration,
  requestMagicLink,
  verifyMagicLink,
} from "../controllers/participants.controller.js";

const router = Router();

router.post("/login", loginLimiter, loginParticipant);
router.get("/me", requireParticipant, getMyRegistration);
router.post("/request-link", recoveryLimiter, requestMagicLink);
router.get("/verify-link", verifyMagicLink);

export default router;
