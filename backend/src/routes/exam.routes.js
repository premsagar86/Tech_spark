import { Router } from "express";
import { requireParticipant } from "../middleware/participantAuth.js";
import { requireExamAttempt } from "../middleware/examAttemptAuth.js";
import { examStartLimiter, examEventsLimiter } from "../middleware/rateLimiter.js";
import {
  getExamMeta,
  startAttempt,
  getAttempt,
  saveAnswers,
  ingestEvents,
  submitAttempt,
} from "../controllers/exam.controller.js";

const router = Router();

// Attempt-scoped routes first — two segments, so no collision with "/:slug",
// but declared here for clarity (mirrors registrations.routes.js).
router.get("/attempts/:id", requireParticipant, requireExamAttempt, getAttempt);
router.post("/attempts/:id/answers", requireParticipant, requireExamAttempt, saveAnswers);
router.post("/attempts/:id/events", requireParticipant, requireExamAttempt, examEventsLimiter, ingestEvents);
router.post("/attempts/:id/submit", requireParticipant, requireExamAttempt, submitAttempt);

router.get("/:slug", requireParticipant, getExamMeta);
router.post("/:slug/start", requireParticipant, examStartLimiter, startAttempt);

export default router;
