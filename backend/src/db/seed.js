import "dotenv/config";
import { pool } from "./pool.js";

const events = [
  {
    slug: "ideathon",
    name: "Ideathon",
    subtitle: "Pitch the idea, not just the code",
    description:
      "Teams get a themed problem statement and pitch an original solution to a panel of judges — no working prototype required, just a sharp idea, a clear pitch deck, and the ability to defend it under questioning.",
    min_team_size: 3,
    max_team_size: 3,
    fee: 300,
    max_registrations: null,
    event_date: "2026-09-20 09:00:00",
    duration: "1 day",
    difficulty: "Medium",
    rules: JSON.stringify([
      "Team size: 3 members (fixed).",
      "Problem statement is revealed on the day of the event.",
      "Each team gets a fixed slot to pitch, followed by a Q&A round with judges.",
      "Original ideas only — plagiarism or a previously published idea leads to disqualification.",
      "Judging criteria: innovation, feasibility, clarity of the pitch, and impact.",
      "Judges' decision is final.",
    ]),
  },
  {
    slug: "hackathon",
    name: "Hackathon",
    subtitle: "Build something real, against the clock",
    description:
      "A build-focused competition judged on a working prototype. Teams pick (or are assigned) a problem statement and have the full duration to design, build, and demo a functioning solution.",
    min_team_size: 3,
    max_team_size: 3,
    fee: 300,
    max_registrations: 50,
    event_date: "2026-09-20 09:00:00",
    duration: "24 hours",
    difficulty: "Hard",
    rules: JSON.stringify([
      "Team size: 3 members (fixed).",
      "Bring your own laptop and charger — seating is capacity-limited.",
      "Code must be written during the event; pre-built projects are not eligible.",
      "Use of open-source libraries/APIs is allowed and encouraged.",
      "A live demo is mandatory at the end of the event — no demo, no evaluation.",
      "Judges' decision is final.",
    ]),
  },
  {
    slug: "vision-vault",
    name: "Vision Vault",
    subtitle: "Tech trivia and general knowledge",
    description:
      "A quiz event covering tech, current affairs, and general knowledge, run over multiple rounds that get progressively harder — think fast, buzz faster.",
    min_team_size: 2,
    max_team_size: 2,
    fee: 0,
    max_registrations: null,
    event_date: "2026-09-19 11:00:00",
    duration: "2 hours",
    difficulty: "Easy",
    rules: JSON.stringify([
      "Team size: 2 members (fixed).",
      "Multiple rounds, including a rapid-fire buzzer round.",
      "No mobile phones or internet access during the quiz.",
      "Negative marking applies in select rounds — details shared before the round starts.",
      "Judges'/quizmaster's decision is final.",
    ]),
  },
  {
    slug: "brain-blitz",
    name: "Brain Blitz",
    subtitle: "Rapid-fire problem solving",
    description:
      "Timed rounds of logic, aptitude, and lateral-thinking challenges. Every round is against the clock — accuracy under pressure wins.",
    min_team_size: 1,
    max_team_size: 1,
    fee: 0,
    max_registrations: null,
    event_date: "2026-09-19 14:00:00",
    duration: "2 hours",
    difficulty: "Medium",
    rules: JSON.stringify([
      "Individual participation only.",
      "Each round has a strict time limit — late submissions are not scored.",
      "No calculators or reference material unless explicitly allowed for a round.",
      "Judges' decision is final.",
    ]),
  },
  {
    slug: "code-quest",
    name: "Code Quest",
    subtitle: "Competitive programming",
    description:
      "Solve algorithmic problems on a judged platform within the time limit. Standard competitive-programming format — correctness and speed both count.",
    min_team_size: 4,
    max_team_size: 4,
    fee: 0,
    max_registrations: null,
    event_date: "2026-09-19 09:00:00",
    duration: "3 hours",
    difficulty: "Hard",
    rules: JSON.stringify([
      "Team size: 4 members (fixed).",
      "Problems are auto-judged; partial scores are awarded for partial test-case passes.",
      "Any standard programming language supported by the judge is allowed.",
      "No internet access other than the judging platform itself.",
      "Plagiarized or copied submissions lead to disqualification.",
    ]),
  },
  {
    slug: "blind-byte",
    name: "Blind Byte",
    subtitle: "Debug it blind",
    description:
      "Spot and fix bugs in code that's shown only briefly, then hidden. You're debugging from memory and logic, not by staring at the screen.",
    min_team_size: 1,
    max_team_size: 1,
    fee: 0,
    max_registrations: null,
    event_date: "2026-09-19 16:00:00",
    duration: "1.5 hours",
    difficulty: "Medium",
    rules: JSON.stringify([
      "Individual participation only.",
      "Code snippet is displayed for a limited time before being hidden.",
      "Fixes must be written without re-revealing the original snippet, except for brief, limited peeks as announced on the day.",
      "Scoring is based on correctness and number of peeks used.",
      "Judges' decision is final.",
    ]),
  },
];

async function seed() {
  for (const event of events) {
    await pool.query(
      `INSERT INTO events
         (slug, name, subtitle, description, min_team_size, max_team_size, fee, max_registrations, event_date, duration, difficulty, rules)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), subtitle = VALUES(subtitle), description = VALUES(description),
         min_team_size = VALUES(min_team_size), max_team_size = VALUES(max_team_size), fee = VALUES(fee),
         max_registrations = VALUES(max_registrations), event_date = VALUES(event_date),
         duration = VALUES(duration), difficulty = VALUES(difficulty), rules = VALUES(rules)`,
      [
        event.slug, event.name, event.subtitle, event.description,
        event.min_team_size, event.max_team_size, event.fee, event.max_registrations,
        event.event_date, event.duration, event.difficulty, event.rules,
      ]
    );
  }
  console.log(`Seeded ${events.length} events.`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
