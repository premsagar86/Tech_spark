import { Router } from "express";
import { registrationLimiter, loginLimiter } from "../middleware/rateLimiter.js";
import {
  createRegistration,
  getRegistrationStatus,
  getRegistrationsByContact,
  verifyPayment,
  retryPayment,
} from "../controllers/registrations.controller.js";

const router = Router();

router.post("/", registrationLimiter, createRegistration);
// Declared before "/:code" so Express doesn't match "by-contact" as a code.
router.get("/by-contact", loginLimiter, getRegistrationsByContact);
router.get("/:code", getRegistrationStatus);
router.post("/:code/verify-payment", verifyPayment);
router.post("/:code/retry-payment", retryPayment);

export default router;
