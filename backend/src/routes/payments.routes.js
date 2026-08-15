import { Router } from "express";
import { handleWebhook } from "../controllers/payments.controller.js";

const router = Router();

// Body is parsed as raw Buffer here — see app.js, which mounts
// express.raw() on this path *before* the global express.json() so the raw
// bytes are still available for HMAC signature verification.
router.post("/webhook", handleWebhook);

export default router;
