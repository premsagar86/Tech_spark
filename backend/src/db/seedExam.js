import "dotenv/config";
import { pool } from "./pool.js";

// Seeds one sample proctored exam ("sample") so the exam + proctoring flow is
// testable end to end before an admin question-authoring UI exists. Idempotent:
// re-running updates the exam row and replaces its questions.

const exam = {
  slug: "sample",
  title: "TechSpark Entrance Test (Sample)",
  duration_minutes: 30,
  strike_limit: 3,
  require_extension: true,
  require_camera: true,
  shuffle_questions: false,
  reveal_score: false,
  opens_at: null,
  closes_at: null,
};

const questions = [
  {
    type: "mcq",
    prompt: "What is the time complexity of binary search on a sorted array of n elements?",
    options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
    correct_answer: "O(log n)",
    points: 1,
  },
  {
    type: "mcq",
    prompt: "Which of these are valid HTTP methods? (select all that apply)",
    options: ["GET", "PUSH", "PATCH", "REMOVE"],
    correct_answer: ["GET", "PATCH"],
    points: 2,
  },
  {
    type: "short",
    prompt: "Name the data structure that follows First-In-First-Out ordering.",
    options: null,
    correct_answer: ["queue", "a queue"],
    points: 1,
  },
  {
    type: "coding",
    prompt:
      "Write a function `reverse(str)` that returns the input string reversed. (Scored manually by a reviewer.)",
    options: null,
    correct_answer: null,
    language: "javascript",
    starter_code: "function reverse(str) {\n  // your code here\n}\n",
    points: 5,
  },
];

async function seed() {
  await pool.query(
    `INSERT INTO exams
       (slug, title, duration_minutes, strike_limit, require_extension, require_camera, shuffle_questions, reveal_score, opens_at, closes_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title), duration_minutes = VALUES(duration_minutes), strike_limit = VALUES(strike_limit),
       require_extension = VALUES(require_extension), require_camera = VALUES(require_camera),
       shuffle_questions = VALUES(shuffle_questions), reveal_score = VALUES(reveal_score),
       opens_at = VALUES(opens_at), closes_at = VALUES(closes_at)`,
    [
      exam.slug, exam.title, exam.duration_minutes, exam.strike_limit,
      exam.require_extension, exam.require_camera, exam.shuffle_questions, exam.reveal_score,
      exam.opens_at, exam.closes_at,
    ]
  );

  const [[row]] = await pool.query("SELECT id FROM exams WHERE slug = ?", [exam.slug]);
  const examId = row.id;

  // Replace questions wholesale (answers cascade-delete with attempts, not with
  // questions, so only run a fresh seed against a DB with no live attempts).
  await pool.query("DELETE FROM exam_questions WHERE exam_id = ?", [examId]);
  let order = 0;
  for (const q of questions) {
    await pool.query(
      `INSERT INTO exam_questions
         (exam_id, type, prompt, options, correct_answer, language, starter_code, points, order_index)
       VALUES (?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?, ?)`,
      [
        examId,
        q.type,
        q.prompt,
        JSON.stringify(q.options ?? null),
        JSON.stringify(q.correct_answer ?? null),
        q.language ?? null,
        q.starter_code ?? null,
        q.points,
        order++,
      ]
    );
  }

  console.log(`Seeded exam "${exam.slug}" (id ${examId}) with ${questions.length} questions.`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Exam seed failed:", err.message);
  process.exit(1);
});
