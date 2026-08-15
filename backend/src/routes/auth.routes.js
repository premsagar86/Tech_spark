import { Router } from "express";
import { loginLimiter } from "../middleware/rateLimiter.js";
import { login } from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", loginLimiter, login);

export default router;
