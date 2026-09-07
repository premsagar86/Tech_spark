import { listQuestions, listAnswers, setAutoScore } from "../models/exams.model.js";

// Auto-grades the objective part of an attempt (mcq + short). Coding questions
// are left for an admin to score by hand (v1 has no execution sandbox).
//
//  - mcq:   answer must deep-equal correct_answer. Both may be a scalar (single
//           choice) or an array (multi-select, order-independent).
//  - short: case-insensitive, trimmed string match. correct_answer may be a
//           single accepted string or an array of accepted strings.
//
// mysql2 returns JSON columns already parsed, so `answer` / `correct_answer`
// are real values here, not strings.

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function sameSet(a, b) {
  const A = [...a].map(norm).sort();
  const B = [...b].map(norm).sort();
  return A.length === B.length && A.every((v, i) => v === B[i]);
}

function isCorrect(question, answer) {
  if (answer == null) return false;
  const correct = question.correct_answer;
  if (correct == null) return false;

  if (question.type === "mcq") {
    if (Array.isArray(correct) || Array.isArray(answer)) {
      return sameSet(Array.isArray(answer) ? answer : [answer], Array.isArray(correct) ? correct : [correct]);
    }
    return norm(answer) === norm(correct);
  }
  if (question.type === "short") {
    const accepted = Array.isArray(correct) ? correct : [correct];
    return accepted.some((c) => norm(c) === norm(answer));
  }
  return false; // coding — manual
}

export async function gradeAttempt(attemptId, examId) {
  const questions = await listQuestions(examId);
  const answers = await listAnswers(attemptId);
  const byQ = new Map(answers.map((a) => [a.question_id, a.answer]));

  let autoScore = 0;
  let autoMax = 0;
  let manualPending = 0;
  const perQuestion = [];

  for (const q of questions) {
    const given = byQ.get(q.id);
    if (q.type === "coding") {
      manualPending += q.points;
      perQuestion.push({ questionId: q.id, type: q.type, awarded: null, points: q.points, manual: true });
      continue;
    }
    autoMax += q.points;
    const correct = isCorrect(q, given);
    if (correct) autoScore += q.points;
    perQuestion.push({ questionId: q.id, type: q.type, awarded: correct ? q.points : 0, points: q.points });
  }

  await setAutoScore(attemptId, autoScore);
  return { autoScore, autoMax, manualPending, perQuestion };
}
