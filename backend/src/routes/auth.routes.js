import { Router } from "express";
import { loginLimiter } from "../middleware/rateLimiter.js";
import { login, refreshAdmin } from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", loginLimiter, login);
router.post("/refresh", loginLimiter, refreshAdmin);

export default router;
