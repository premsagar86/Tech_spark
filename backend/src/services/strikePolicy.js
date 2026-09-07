import { pool } from "../db/pool.js";
import { insertEvents, getAttemptById } from "../models/exams.model.js";

// Server-authoritative severity map. KEEP IN SYNC with the SDK's
// core/strike-engine.js DEFAULT_POLICY — the client copy is only for instant
// "Warning 2/3" UI; the counts and the auto-submit decision are made here.
export const SEVERITY_BY_KIND = {
  // Hard "left the exam" signals — a strike each.
  tab_blur: "strike",
  tab_switch: "strike",
  new_tab_opened: "strike",
  window_blur: "strike",
  visibility_hidden: "strike",
  fullscreen_exit: "strike",
  nav_attempt: "strike",
  multi_display: "strike",
  paste_large: "strike",
  multi_face: "strike",
  extension_lost: "strike",
  camera_lost: "strike",

  // Softer signals — logged and shown, not an automatic strike.
  copy: "warn",
  cut: "warn",
  paste: "warn",
  contextmenu: "warn",
  blocked_shortcut: "warn",
  devtools: "warn",
  no_face: "warn",
  risky_extension: "warn",

  // Informational.
  page_hidden: "info",
  extension_missing: "info",
  camera_denied: "info",
  handshake_ok: "info",
  queue_overflow: "info",
};

export function severityOf(kind) {
  return SEVERITY_BY_KIND[kind] || "info";
}

/**
 * Persist a batch of incoming proctor events, recount strikes from the audit
 * log (so a replayed/duplicated batch can't inflate the tally), and auto-submit
 * when the limit is reached.
 *
 * @returns {Promise<{ strikes: number, strikeLimit: number, autoSubmitted: boolean, ended: boolean }>}
 */
export async function ingestAndScore({ attempt, exam, events }) {
  const normalized = events.map((e) => ({
    kind: e.kind,
    severity: severityOf(e.kind),
    source: e.source,
    detail: e.detail,
    seq: e.seq,
    clientTs: e.clientTs,
  }));

  await insertEvents(attempt.id, normalized);

  // Recount from the source of truth rather than trusting a running counter.
  const [[{ strikes }]] = await pool.query(
    "SELECT COUNT(*) AS strikes FROM exam_events WHERE attempt_id = ? AND severity = 'strike'",
    [attempt.id]
  );

  const strikeLimit = exam.strike_limit ?? 3;
  const expired = Number(attempt.remaining_seconds) <= 0;
  let status = attempt.status;
  let autoSubmitted = false;

  if (status === "in_progress") {
    if (strikes >= strikeLimit) {
      status = "auto_submitted";
      autoSubmitted = true;
      await insertEvents(attempt.id, [
        { kind: "auto_submit", severity: "strike", source: "server", detail: { strikes, strikeLimit } },
      ]);
    } else if (expired) {
      status = "expired";
    }
    if (status !== "in_progress") {
      await pool.query(
        "UPDATE exam_attempts SET status = ?, strikes = ?, submitted_at = COALESCE(submitted_at, NOW()) WHERE id = ?",
        [status, strikes, attempt.id]
      );
    } else {
      await pool.query("UPDATE exam_attempts SET strikes = ? WHERE id = ?", [strikes, attempt.id]);
    }
  }

  const fresh = await getAttemptById(attempt.id);
  return {
    strikes,
    strikeLimit,
    autoSubmitted: autoSubmitted || fresh.status === "auto_submitted",
    ended: fresh.status !== "in_progress",
    status: fresh.status,
  };
}
