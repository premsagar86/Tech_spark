import { Router } from "express";
import { getEvents, getEvent } from "../controllers/events.controller.js";

const router = Router();

router.get("/", getEvents);
router.get("/:slug", getEvent);

export default router;
