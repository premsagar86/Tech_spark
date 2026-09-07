import crypto from "node:crypto";
import { pool } from "../db/pool.js";
import {
  getExamBySlug,
  getExamById,
  listQuestions,
  getAttemptById,
  getAttemptForParticipant,
  createAttempt,
  setAttemptTokenHash,
  markAttemptStatus,
  setManualScore,
  upsertAnswers,
  listAnswers,
  listEvents,
  listAttemptsForExam,
} from "../models/exams.model.js";
import {
  issueAttemptToken,
  hashToken,
  setAttemptCookie,
  attemptTokenTtlMs,
} from "../middleware/examAttemptAuth.js";
import { ingestAndScore, severityOf } from "../services/strikePolicy.js";
import { gradeAttempt } from "../services/gradeAttempt.js";
import { verifyExtensionProof } from "../services/extensionProof.js";

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Everything a candidate is allowed to see about a question — never
// correct_answer.
function publicQuestion(q) {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options ?? null,
    // Whether more than one option is correct ("select all that apply"). This
    // is the only thing derived from correct_answer that reaches the candidate.
    multi: Array.isArray(q.correct_answer),
    language: q.language ?? null,
    starterCode: q.starter_code ?? null,
    points: q.points,
    orderIndex: q.order_index,
  };
}

function examMeta(exam, questionCount) {
  return {
    slug: exam.slug,
    title: exam.title,
    durationMinutes: exam.duration_minutes,
    strikeLimit: exam.strike_limit,
    requireExtension: !!exam.require_extension,
    requireCamera: !!exam.require_camera,
    revealScore: !!exam.reveal_score,
    opensAt: exam.opens_at,
    closesAt: exam.closes_at,
    questionCount,
  };
}

function windowState(exam) {
  const now = Date.now();
  if (exam.opens_at && now < new Date(exam.opens_at).getTime()) return "not_open";
  if (exam.closes_at && now > new Date(exam.closes_at).getTime()) return "closed";
  return "open";
}

// ---------------------------------------------------------------------------
// Candidate endpoints
// ---------------------------------------------------------------------------

// GET /api/exam/:slug  — meta only, no questions.
export async function getExamMeta(req, res, next) {
  try {
    const exam = await getExamBySlug(req.params.slug);
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    const questions = await listQuestions(exam.id);
    const attempt = await getAttemptForParticipant(exam.id, req.participant.participantId);
    res.json({
      exam: examMeta(exam, questions.length),
      window: windowState(exam),
      attempt: attempt
        ? {
            id: attempt.id,
            status: attempt.status,
            startedAt: attempt.started_at,
            remainingMs:
              attempt.status === "in_progress" ? Math.max(0, Number(attempt.remaining_seconds) * 1000) : 0,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/exam/:slug/start
// body: { extProof?: { v, ts, sig }, extensionVersion?, cameraGranted?: boolean }
export async function startAttempt(req, res, next) {
  try {
    const exam = await getExamBySlug(req.params.slug);
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    const wnd = windowState(exam);
    if (wnd === "not_open") throw httpError(403, "This exam has not opened yet");
    if (wnd === "closed") throw httpError(403, "This exam is closed");

    const participantId = req.participant.participantId;
    const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;

    // Extension gate.
    if (exam.require_extension) {
      const result = verifyExtensionProof({
        attemptContext: exam.slug,
        origin,
        proof: req.body?.extProof,
      });
      if (!result.ok) {
        return res.status(403).json({
          error: "The exam proctor extension is required and could not be verified.",
          reason: result.reason,
        });
      }
      req._extensionVersion = result.version;
    }

    // One attempt per participant. Resume an in-progress one; refuse a finished one.
    let attempt = await getAttemptForParticipant(exam.id, participantId);
    if (attempt) {
      if (attempt.status === "in_progress" && Number(attempt.remaining_seconds) > 0) {
        const ttl = (Number(attempt.remaining_seconds) + 600) * 1000; // + grace
        const token = issueAttemptToken({ attemptId: attempt.id, participantId, examId: exam.id }, ttl);
        await setAttemptTokenHash(attempt.id, hashToken(token));
        setAttemptCookie(res, token, ttl);
        return res.json(startPayload(exam, attempt, token, await candidateQuestions(exam)));
      }
      if (attempt.status === "in_progress") {
        await markAttemptStatus(attempt.id, "expired");
      }
      return res.status(409).json({ error: "You have already used your attempt at this exam." });
    }

    // New attempt.
    const ttlMs = attemptTokenTtlMs(exam.duration_minutes);
    const signingKey = crypto.randomBytes(32).toString("hex");

    try {
      attempt = await createAttempt({
        examId: exam.id,
        participantId,
        tokenHash: null,
        signingKey,
        durationMinutes: exam.duration_minutes,
        ip: req.ip,
        userAgent: req.get("user-agent"),
        extensionVersion: req._extensionVersion || null,
      });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "You have already used your attempt at this exam." });
      }
      throw err;
    }

    const token = issueAttemptToken({ attemptId: attempt.id, participantId, examId: exam.id }, ttlMs);
    await setAttemptTokenHash(attempt.id, hashToken(token));
    setAttemptCookie(res, token, ttlMs);

    res.json(startPayload(exam, attempt, token, await candidateQuestions(exam), signingKey));
  } catch (err) {
    next(err);
  }

  async function candidateQuestions(exam) {
    const raw = await listQuestions(exam.id);
    const list = exam.shuffle_questions ? shuffle(raw) : raw;
    return list.map(publicQuestion);
  }
}

function startPayload(exam, attempt, token, questions, signingKey) {
  return {
    attemptId: attempt.id,
    attemptToken: token, // also set as httpOnly cookie; returned for header-based clients
    signingKey: signingKey ?? attempt.signing_key ?? null,
    ingestPath: `/api/exam/attempts/${attempt.id}/events`,
    status: attempt.status,
    strikes: attempt.strikes,
    strikeLimit: exam.strike_limit,
    // Clients run their own countdown from this; the server re-checks on every write.
    remainingMs: Math.max(0, Number(attempt.remaining_seconds) * 1000),
    durationMinutes: exam.duration_minutes,
    exam: examMeta(exam, questions.length),
    questions,
  };
}

// GET /api/exam/attempts/:id  — resume state.
export async function getAttempt(req, res, next) {
  try {
    const attempt = await getAttemptById(req.params.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await getExamById(attempt.exam_id);
    const answers = await listAnswers(attempt.id);

    // Lazily flip a lapsed attempt to 'expired' on read.
    if (attempt.status === "in_progress" && Number(attempt.remaining_seconds) <= 0) {
      await markAttemptStatus(attempt.id, "expired");
      attempt.status = "expired";
    }

    res.json({
      attemptId: attempt.id,
      status: attempt.status,
      strikes: attempt.strikes,
      strikeLimit: exam.strike_limit,
      remainingMs: attempt.status === "in_progress" ? Math.max(0, Number(attempt.remaining_seconds) * 1000) : 0,
      answers: answers.map((a) => ({ questionId: a.question_id, answer: a.answer })),
      exam: examMeta(exam, (await listQuestions(exam.id)).length),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/exam/attempts/:id/answers  — batch autosave.
// body: { answers: [{ questionId, answer }] }
export async function saveAnswers(req, res, next) {
  try {
    const attempt = await getAttemptById(req.params.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });

    if (attempt.status !== "in_progress") {
      return res.status(409).json({ error: `Attempt is ${attempt.status}`, status: attempt.status });
    }
    if (Number(attempt.remaining_seconds) <= 0) {
      await markAttemptStatus(attempt.id, "expired");
      return res.status(409).json({ error: "Time is up", status: "expired" });
    }

    const entries = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const clean = entries
      .filter((e) => Number.isFinite(Number(e.questionId)))
      .map((e) => ({ questionId: Number(e.questionId), answer: e.answer ?? null }))
      .slice(0, 200);

    await upsertAnswers(attempt.id, clean);
    res.json({ ok: true, saved: clean.length });
  } catch (err) {
    next(err);
  }
}

// POST /api/exam/attempts/:id/events  — proctor event ingest.
// body: { events: [{ kind, severity?, source?, detail?, seq?, clientTs? }], sig?, meta? }
export async function ingestEvents(req, res, next) {
  try {
    const attempt = await getAttemptById(req.params.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await getExamById(attempt.exam_id);

    const incoming = Array.isArray(req.body?.events) ? req.body.events : [];
    const events = incoming
      .filter((e) => e && typeof e.kind === "string")
      .slice(0, 100)
      .map((e) => ({
        kind: e.kind,
        source: e.source === "extension" || e.source === "server" ? e.source : "sdk",
        detail: e.detail ?? {},
        seq: Number.isFinite(Number(e.seq)) ? Number(e.seq) : null,
        clientTs: Number.isFinite(Number(e.clientTs)) ? Number(e.clientTs) : null,
      }));

    // Soft signature check — logged, never rejected (the server tally is
    // authoritative regardless; see services/strikePolicy.js).
    let sigOk = null;
    if (attempt.signing_key && typeof req.body?.sig === "string") {
      const expected = crypto
        .createHmac("sha256", attempt.signing_key)
        .update(JSON.stringify(req.body.events))
        .digest("hex");
      sigOk = expected === req.body.sig;
      if (!sigOk) console.warn(`[exam] attempt ${attempt.id}: event batch signature mismatch`);
    }

    if (attempt.status !== "in_progress") {
      // Still record late-arriving events for the audit trail, but don't
      // re-score a finished attempt.
      if (events.length) {
        await pool.query(
          `INSERT INTO exam_events (attempt_id, kind, severity, source, detail, seq, client_ts)
           VALUES ?`,
          [
            events.map((e) => [
              attempt.id,
              e.kind.slice(0, 40),
              severityOf(e.kind),
              e.source,
              JSON.stringify(e.detail ?? {}),
              e.seq,
              e.clientTs,
            ]),
          ]
        );
      }
      return res.json({
        strikes: attempt.strikes,
        strikeLimit: exam.strike_limit,
        autoSubmitted: attempt.status === "auto_submitted",
        ended: true,
        status: attempt.status,
      });
    }

    const result = await ingestAndScore({ attempt, exam, events });
    res.json({ ...result, sigOk });
  } catch (err) {
    next(err);
  }
}

// POST /api/exam/attempts/:id/submit  — finalize + grade.
export async function submitAttempt(req, res, next) {
  try {
    const attempt = await getAttemptById(req.params.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await getExamById(attempt.exam_id);

    if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
      const grade = await gradeAttempt(attempt.id, exam.id);
      return res.json({ status: attempt.status, alreadySubmitted: true, ...gradeView(exam, grade) });
    }

    const finalStatus =
      attempt.status === "expired" || Number(attempt.remaining_seconds) <= 0 ? "expired" : "submitted";
    // Keep an auto_submitted status if a concurrent strike already set it.
    const fresh = await getAttemptById(attempt.id);
    if (fresh.status === "auto_submitted") {
      const grade = await gradeAttempt(attempt.id, exam.id);
      return res.json({ status: "auto_submitted", ...gradeView(exam, grade) });
    }

    await markAttemptStatus(attempt.id, finalStatus === "expired" ? "expired" : "submitted");
    const grade = await gradeAttempt(attempt.id, exam.id);

    res.clearCookie("examAttemptToken", { path: "/" });
    res.json({ status: finalStatus, ...gradeView(exam, grade) });
  } catch (err) {
    next(err);
  }
}

function gradeView(exam, grade) {
  if (!exam.reveal_score) {
    return { revealScore: false, manualPending: grade.manualPending > 0 };
  }
  return {
    revealScore: true,
    autoScore: grade.autoScore,
    autoMax: grade.autoMax,
    manualPending: grade.manualPending,
  };
}

// ---------------------------------------------------------------------------
// Admin endpoints  (mounted under /api/admin, requireAdmin + requireRole('admin'))
// ---------------------------------------------------------------------------

export async function listExamAttempts(req, res, next) {
  try {
    const exam = await getExamBySlug(req.params.slug);
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    const attempts = await listAttemptsForExam(exam.id);
    res.json({
      exam: { slug: exam.slug, title: exam.title, strikeLimit: exam.strike_limit },
      attempts: attempts.map((a) => ({
        id: a.id,
        participant: { name: a.full_name, rollNumber: a.roll_number, email: a.email },
        status: a.status,
        strikes: a.strikes,
        strikeEvents: Number(a.strike_events),
        totalEvents: Number(a.total_events),
        autoScore: a.auto_score,
        score: a.score,
        startedAt: a.started_at,
        submittedAt: a.submitted_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getExamAttemptDetail(req, res, next) {
  try {
    const attempt = await getAttemptById(req.params.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const exam = await getExamById(attempt.exam_id);
    const [events, answers, questions] = await Promise.all([
      listEvents(attempt.id),
      listAnswers(attempt.id),
      listQuestions(exam.id),
    ]);
    const answerByQ = new Map(answers.map((a) => [a.question_id, a.answer]));

    res.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        strikes: attempt.strikes,
        strikeLimit: exam.strike_limit,
        autoScore: attempt.auto_score,
        score: attempt.score,
        startedAt: attempt.started_at,
        submittedAt: attempt.submitted_at,
        expiresAt: attempt.expires_at,
        ip: attempt.ip,
        userAgent: attempt.user_agent,
        extensionVersion: attempt.extension_version,
      },
      events: events.map((e) => ({
        id: e.id,
        kind: e.kind,
        severity: e.severity,
        source: e.source,
        detail: e.detail,
        seq: e.seq,
        clientTs: e.client_ts,
        serverTs: e.server_ts,
      })),
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        correctAnswer: q.correct_answer,
        givenAnswer: answerByQ.get(q.id) ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function scoreExamAttempt(req, res, next) {
  try {
    const attempt = await getAttemptById(req.params.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const score = Number(req.body?.score);
    if (!Number.isFinite(score)) throw httpError(400, "Score must be a number");
    await setManualScore(attempt.id, score, req.admin.adminId);
    res.json({ ok: true, score });
  } catch (err) {
    next(err);
  }
}
