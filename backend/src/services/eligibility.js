const MUTUALLY_EXCLUSIVE_EVENTS = { hackathon: "ideathon", ideathon: "hackathon" };

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Translates a MySQL ER_DUP_ENTRY on `participants` into a message naming
// which identity field collided — fallback for races the application-level
// checkRegistrationEligibility() check above didn't catch in time.
export function duplicateKeyMessage(err) {
  if (err.message?.includes("uniq_event_email")) return "This email is already registered for this event";
  if (err.message?.includes("uniq_event_mobile")) return "This mobile number is already registered for this event";
  return "One or more roll numbers are already registered for this event";
}

// Cross-event eligibility, shared by registration creation and admin
// add-team-member. A person is matched against their other active
// registrations by (college, roll_number) when college is known, OR by
// normalized email, OR by normalized mobile — any one match is enough,
// since there's no user-account system tying these together. Enforces:
//   - same-event duplicate prevention (can't register twice for one event)
//   - Hackathon/Ideathon mutual exclusion (both are prize-pool events)
//   - a 3-event cap per person
export async function checkRegistrationEligibility(conn, event, participants) {
  const collegeRollPairs = participants
    .map((p) => (p.college ? [p.college, p.rollNumber.trim().toUpperCase()] : null))
    .filter(Boolean);
  const emails = [...new Set(participants.map((p) => p.email).filter(Boolean))];
  const mobiles = [...new Set(participants.map((p) => p.mobile).filter(Boolean))];

  const conditions = [];
  const params = [];

  if (collegeRollPairs.length) {
    conditions.push(collegeRollPairs.map(() => `(UPPER(p.college) = UPPER(?) AND UPPER(p.roll_number) = ?)`).join(" OR "));
    for (const [college, roll] of collegeRollPairs) params.push(college, roll);
  }
  if (emails.length) {
    conditions.push(`p.email IN (${emails.map(() => "?").join(",")})`);
    params.push(...emails);
  }
  if (mobiles.length) {
    conditions.push(`p.mobile IN (${mobiles.map(() => "?").join(",")})`);
    params.push(...mobiles);
  }

  if (!conditions.length) return;

  const [existingRows] = await conn.query(
    `SELECT p.roll_number, p.college, p.email, p.mobile, e.id AS event_id, e.slug AS event_slug,
            e.name AS event_name, r.registration_code, r.team_name
     FROM participants p
     JOIN registrations r ON r.id = p.registration_id
     JOIN events e ON e.id = r.event_id
     WHERE (${conditions.join(" OR ")})
       AND r.payment_status IN ('not_required','created','paid')`,
    params
  );

  const otherSlug = MUTUALLY_EXCLUSIVE_EVENTS[event.slug];

  for (const p of participants) {
    const roll = p.rollNumber.trim().toUpperCase();
    const rows = existingRows.filter((r) => {
      const collegeRollMatch = p.college && r.college && r.roll_number.toUpperCase() === roll && r.college.toUpperCase() === p.college.toUpperCase();
      const emailMatch = p.email && r.email && r.email === p.email;
      const mobileMatch = p.mobile && r.mobile && r.mobile === p.mobile;
      return collegeRollMatch || emailMatch || mobileMatch;
    });

    const sameEventConflict = rows.find((r) => r.event_id === event.id);
    if (sameEventConflict) {
      throw httpError(
        409,
        `${p.fullName} (Roll No: ${p.rollNumber}) is already registered for ${event.name} ` +
          `(${sameEventConflict.team_name || sameEventConflict.registration_code}) using this email or mobile number.`
      );
    }

    if (otherSlug) {
      const conflict = rows.find((r) => r.event_slug === otherSlug);
      if (conflict) {
        throw httpError(
          409,
          `${p.fullName} (Roll No: ${p.rollNumber}) is already registered for ${conflict.event_name} ` +
            `(${conflict.team_name || conflict.registration_code}) and can't also register for ${event.name}.`
        );
      }
    }

    if (new Set(rows.map((r) => r.event_id)).size >= 3) {
      throw httpError(409, `${p.fullName} (Roll No: ${p.rollNumber}) has already registered for the maximum of 3 events.`);
    }
  }
}
