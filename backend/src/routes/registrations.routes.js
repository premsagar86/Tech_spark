import { Router } from "express";
import { registrationLimiter } from "../middleware/rateLimiter.js";
import {
  createRegistration,
  getRegistrationStatus,
  verifyPayment,
  retryPayment,
} from "../controllers/registrations.controller.js";

const router = Router();

router.post("/", registrationLimiter, createRegistration);
router.get("/:code", getRegistrationStatus);
router.post("/:code/verify-payment", verifyPayment);
router.post("/:code/retry-payment", retryPayment);

export default router;
