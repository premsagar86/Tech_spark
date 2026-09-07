import { Router } from "express";
import { requireParticipant } from "../middleware/participantAuth.js";
import { requireExamAttempt, examFeatureConfigured } from "../middleware/examAttemptAuth.js";
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

// The exam feature is opt-in: if the server has no JWT_EXAM_SECRET, every exam
// route returns a clean 503 instead of an opaque 500/401. The rest of the API
// is unaffected.
router.use((req, res, next) => {
  if (!examFeatureConfigured()) {
    return res.status(503).json({ error: "Exam feature is not configured on this server" });
  }
  next();
});

// Attempt-scoped routes first — two segments, so no collision with "/:slug",
// but declared here for clarity (mirrors registrations.routes.js).
router.get("/attempts/:id", requireParticipant, requireExamAttempt, getAttempt);
router.post("/attempts/:id/answers", requireParticipant, requireExamAttempt, saveAnswers);
router.post("/attempts/:id/events", requireParticipant, requireExamAttempt, examEventsLimiter, ingestEvents);
router.post("/attempts/:id/submit", requireParticipant, requireExamAttempt, submitAttempt);

router.get("/:slug", requireParticipant, getExamMeta);
router.post("/:slug/start", requireParticipant, examStartLimiter, startAttempt);

export default router;
