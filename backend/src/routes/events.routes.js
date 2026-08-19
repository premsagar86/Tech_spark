import { Router } from "express";
import { getEvents, getEvent, getEventLeaderboard } from "../controllers/events.controller.js";

const router = Router();

router.get("/", getEvents);
router.get("/:slug/leaderboard", getEventLeaderboard);
router.get("/:slug", getEvent);

export default router;
