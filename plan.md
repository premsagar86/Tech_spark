# TechSpark 2026 — Full Stack Rebuild Plan

## Context

This supersedes the earlier CSS-only restyle plan. Scope is a **full platform rebuild**: React
frontend (Tailwind CSS, React Hook Form, GSAP + Motion for animation) talking to a real
**Express + MySQL** backend, including a complete registration → payment → verification lifecycle
and an admin dashboard with **QR-based check-in scanning**. The current implementation (see
`CLAUDE.md`) has no real backend at all — registrations POST straight to a hardcoded Google Apps
Script URL, with no payment verification, no team-size enforcement server-side, and no way for
organizers to check anyone in at the event. All of that is being built here.

**Decisions confirmed so far:**
- Brand name going forward is **"TechSpark 2026"**.
- Theme is modeled on **hackyatra.in**'s tokens: near-black background, warm-cream text, burnt-orange
  `#ff6b00` primary + cyan `#00d4ff` secondary accents, Bebas Neue display font.
- A real logo file will be supplied separately.
- **Only Ideathon and Hackathon are paid** (₹300/team each, per `js/events.js`) — Vision Vault, Brain
  Blitz, Code Quest, and Blind Byte are free. This was already how the schema branches (on
  `events.fee`, not a hardcoded event name), so no special-casing is needed in code — but the cash/
  counter payment path from the previous pass is **removed** per this round of feedback, since with
  only two paid events, **Razorpay alone** is the payment method. (Flagging this as my read of "no
  need for the remaining events, remove that feature" — if you actually meant something narrower,
  say so and I'll adjust.)
- **Payment confirmation triggers a WhatsApp message** to the registrant (Twilio), and **also
  persists a lightweight login** so the registrant's QR + team info shows automatically on later
  visits, not just via a one-off code lookup (Part 7).
- **Payment confirmation also emails a WhatsApp Community invite link** to each participant with an
  email on file (Part 5). Joining the community happens externally in WhatsApp itself — the backend
  only sends the link, it doesn't manage membership. Restricting who can add new members to that
  community (so participants can't add outsiders) is a one-time setting inside the WhatsApp app
  itself, not something this codebase implements — noted in Part 5 as a setup step, not a feature.
- **Rate limiting applies to both `/api/admin/login` and the new participant login
  (`/api/participants/login`)**, alongside the registration endpoint — anywhere someone could script
  repeated guesses.
- This pass is scoped to **software only**, per feedback — manual/physical-process recommendations
  (e.g. checking a college ID at the door) have been removed from the plan; those are event-staffing
  decisions, not something the system does or needs to describe.
- **Admin and participant account recovery** (Part 4/Part 7) — admins get a standard email-based
  password reset; participants don't have a real password to reset (Part 7's login is email +
  mobile, by design), so their recovery is a **magic sign-in link emailed to them** instead — same
  underlying need (get back in without remembering anything fragile), different mechanic because the
  two login schemes aren't actually the same shape. Flagging this reframing explicitly rather than
  silently picking one.
- **Registration closes automatically once an event's date arrives**, and the events list shows a
  **"Completed"** state instead of a Register button once it has (Part 2/Part 3/Part 10) — new
  `events.event_date` drives both. Check-in (Part 6) is unaffected by this — it needs to keep working
  during/after that same moment, since that's literally when the event and its check-in happen.

---

## Part 1 — Target architecture

```
techspark-2026/
├── frontend/
│   ├── index.html                      # includes the Razorpay checkout.js <script> tag
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── .env.example                    # VITE_API_URL
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                     # router
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── Footer.jsx
│       │   ├── Hero.jsx
│       │   ├── Countdown.jsx
│       │   ├── Leadership.jsx
│       │   ├── Administration.jsx
│       │   ├── Coordinators.jsx
│       │   ├── EventCard.jsx
│       │   ├── EventModal.jsx
│       │   ├── TeamCard.jsx            # renders a team's QR codes + roster
│       │   └── GlowBackground.jsx      # the blurred-blob ambient effect
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── Events.jsx
│       │   ├── Register.jsx
│       │   ├── Status.jsx
│       │   ├── Login.jsx
│       │   └── MagicLink.jsx           # handles the ?token= link from the recovery email
│       ├── admin/
│       │   ├── AdminRoute.jsx          # JWT route guard
│       │   ├── AdminLogin.jsx
│       │   ├── AdminForgotPassword.jsx
│       │   ├── AdminResetPassword.jsx
│       │   ├── AdminDashboard.jsx
│       │   └── AdminScanner.jsx
│       ├── forms/
│       │   ├── RegistrationWizard.jsx
│       │   └── steps/
│       │       ├── StepPersonalDetails.jsx
│       │       ├── StepEventSelect.jsx
│       │       ├── StepTeamMembers.jsx
│       │       └── StepReviewPay.jsx
│       ├── lib/
│       │   ├── api.js                  # fetch wrapper
│       │   ├── schemas.js              # zod validation schemas
│       │   ├── razorpayCheckout.js
│       │   └── session.js              # participant JWT storage helpers
│       ├── animations/
│       │   ├── scrollReveal.js         # gsap ScrollTrigger setup
│       │   └── motionVariants.js       # shared Motion variants
│       └── styles/
│           └── index.css               # Tailwind directives + font-face
└── backend/
    ├── package.json
    ├── .env.example
    └── src/
        ├── server.js                   # entry point
        ├── app.js                      # Express app + middleware wiring
        ├── routes/
        │   ├── events.routes.js
        │   ├── registrations.routes.js
        │   ├── payments.routes.js
        │   ├── participants.routes.js
        │   └── admin.routes.js
        ├── controllers/
        │   ├── events.controller.js
        │   ├── registrations.controller.js
        │   ├── payments.controller.js
        │   ├── participants.controller.js
        │   └── admin.controller.js
        ├── services/
        │   ├── confirmPayment.js       # shared idempotent core
        │   ├── razorpay.js             # order creation + signature verification
        │   ├── whatsapp.js             # Twilio
        │   └── email.js                # MJML + nodemailer
        ├── models/
        │   ├── events.model.js
        │   ├── registrations.model.js
        │   ├── participants.model.js
        │   └── admins.model.js
        ├── middleware/
        │   ├── errorHandler.js
        │   ├── adminAuth.js
        │   ├── participantAuth.js
        │   └── rateLimiter.js
        ├── utils/
        │   ├── generateCode.js         # registration/check-in code formatting
        │   └── expireStaleRegistrations.js
        └── db/
            ├── pool.js                 # mysql2 connection pool
            ├── schema.sql              # Part 3, run once to create tables
            ├── seed.js                 # inserts the 6 events
            └── create-admin.js         # CLI: node create-admin.js <user> <pass>
```

Scope note (unchanged): leadership/administration/coordinator info stays static content in React —
only **events**, **registrations/participants**, and **admins** are database-backed.

`services/confirmPayment.js` is still the one shared, idempotent core that both payment-confirmation
triggers (Razorpay signature verification and the Razorpay webhook) call — mark paid, generate
check-in codes, send the WhatsApp confirmation, issue the participant login token. Both triggers must
be safe to fire more than once for the same registration without double-generating anything, guarded
by checking `check_in_code IS NULL` before acting.

---

## Part 2 — Registration → payment → verification lifecycle

**1. User registers** (`/register`, 4-step wizard, react-hook-form) — personal details, event pick
   (team size bounded by the event's `min_team_size`–`max_team_size`), team member fields, review.
   Only Ideathon and Hackathon carry a nonzero `fee`; every other event is free, driven entirely by
   the `events.fee` value already in the DB — nothing event-specific hardcoded in the flow.

**2. `POST /api/registrations`** — in one DB transaction:
   - Re-validates everything server-side regardless of what the client sent: **the event's
     `event_date` hasn't already passed** (registration is closed once it has — checked first, before
     anything else, so a stale `/register` page open past the cutoff can't sneak a submission through),
     team size against the event's real `min_team_size`/`max_team_size`, no duplicate roll number for
     the same event (`UNIQUE(event_id, roll_number)`), and the event isn't already at
     `max_registrations` (Part 9) — the capacity check uses `SELECT COUNT(*) ... FOR UPDATE` on that
     event's rows so two near-simultaneous requests can't both slip past the cap.
   - Inserts the `registrations` row + one `participants` row per person, then **commits**.
   - Branches:
     - **Free event** (`fee = 0`): `payment_status = 'not_required'` → `confirmPayment()` runs
       immediately (codes generated, WhatsApp sent, login token issued).
     - **Paid event** (Ideathon/Hackathon): `payment_status = 'created'`, no payment attempted yet.

**3. Only after the registration transaction has committed** does the backend call Razorpay's Order
   API (a separate step, not nested inside the DB transaction — an external HTTP call has no business
   holding a DB connection/lock open) to create an order for the amount stored on that registration,
   then a quick follow-up update stores `razorpay_order_id`. If the Razorpay call itself fails, the
   registration is marked `payment_status = 'failed'` rather than left in a half-configured state.
   Response to the client includes the order id + the public Razorpay key id.

**4. Frontend opens Razorpay Checkout** with that order id. On success it gets `razorpay_payment_id` +
   `razorpay_order_id` + `razorpay_signature`, and calls
   `POST /api/registrations/:code/verify-payment`. The backend **verifies the HMAC signature
   server-side using the Razorpay key secret** — the one step that actually proves payment happened,
   nothing from the client is trusted alone. On a valid signature, `confirmPayment()` runs.
   - **A webhook is required, not optional**, as the reliable fallback for the case where the browser
     closes/network drops between Razorpay confirming payment and the callback reaching the backend.
     `POST /api/payments/webhook` handles both `payment.captured` (→ `confirmPayment()`) **and
     `payment.failed`** (→ explicitly marks `payment_status = 'failed'`, rather than leaving it stuck
     in `'created'` forever with no clear next step for the user).
   - Gotcha: the webhook route needs the **raw request body** for signature verification, so it must
     bypass Express's global JSON body parser. Webhooks can't reach `localhost` — local dev needs a
     tunnel (ngrok) or Razorpay's test-webhook tool.
   - **Abandoned checkout**: `/status` (and the new login-based view, Part 7) offer a **"Retry
     Payment"** action (`POST /api/registrations/:code/retry-payment`) that re-opens Checkout against
     the existing order (or a fresh one if it's gone stale).
   - **Stale abandoned registrations must not permanently occupy a capacity slot.** A scheduled
     cleanup job (`utils/expireStaleRegistrations.js`, run on an interval — e.g. every 10 minutes)
     flips any `'created'` registration older than ~30 minutes to `'failed'`, freeing that slot for
     `max_registrations` purposes. Without this, someone abandoning checkout on a capacity-limited
     event (Hackathon, laptop-limited) silently blocks a real team from registering.

**5. Once payment is confirmed**, the participant is auto-logged in (Part 7) so their QR + team info
   is available immediately without re-entering anything, and shows automatically on future visits.

**6. At the event, an admin scans QR codes to check people in** — Part 6.

---

## Part 3 — Database schema (MySQL)

```sql
CREATE DATABASE IF NOT EXISTS techspark2026;
USE techspark2026;

CREATE TABLE events (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  slug               VARCHAR(50)  NOT NULL UNIQUE,
  name               VARCHAR(100) NOT NULL,
  subtitle           VARCHAR(150),
  description        TEXT,
  min_team_size      INT          NOT NULL DEFAULT 1,
  max_team_size      INT          NOT NULL DEFAULT 1,
  fee                DECIMAL(8,2) NOT NULL DEFAULT 0,   -- 0 for all events except Ideathon/Hackathon (300 each)
  max_registrations  INT          NULL,                 -- NULL = unlimited
  event_date         DATETIME     NOT NULL,              -- registration auto-closes at this instant;
                                                           -- the events list shows "Completed" once past it
  duration           VARCHAR(50),
  difficulty         ENUM('Easy','Medium','Hard') NOT NULL DEFAULT 'Easy',
  rules              JSON,
  created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE registrations (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  registration_code     VARCHAR(20)  UNIQUE,             -- e.g. TS2026-000123; NULL briefly between
                                                           -- insert and the follow-up UPDATE (Part 12)
  event_id              INT          NOT NULL,
  team_name             VARCHAR(100),                   -- required when event.max_team_size > 1
  team_size             INT          NOT NULL,
  registration_fee      DECIMAL(8,2) NOT NULL DEFAULT 0,
  payment_status        ENUM('not_required','created','paid','failed') NOT NULL DEFAULT 'not_required',
  razorpay_order_id     VARCHAR(50),
  razorpay_payment_id   VARCHAR(50),
  payment_confirmed_by  INT NULL,                        -- set only if an admin manually overrides
  payment_confirmed_at  TIMESTAMP NULL,
  notified_at           TIMESTAMP NULL,                  -- guards against a duplicate WhatsApp send
  created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (payment_confirmed_by) REFERENCES admins(id)
);

CREATE TABLE participants (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  registration_id     INT          NOT NULL,
  event_id            INT          NOT NULL,           -- denormalized, for the uniqueness constraint
  participant_order   INT          NOT NULL,            -- 1 = the person who filled the form (leader)
  full_name           VARCHAR(100) NOT NULL,
  roll_number         VARCHAR(50)  NOT NULL,
  college             VARCHAR(150),                     -- filled for participant_order = 1 only,
  course              VARCHAR(50),                       -- matching what the current form collects
  branch              VARCHAR(50),                        -- per member (name/roll/mobile/email)
  year                VARCHAR(20),
  mobile              VARCHAR(10),
  email               VARCHAR(150),
  check_in_code       VARCHAR(30)  UNIQUE,               -- NULL until payment is confirmed
  checked_in          BOOLEAN      NOT NULL DEFAULT FALSE,
  checked_in_at       TIMESTAMP    NULL,
  checked_in_by       INT          NULL,
  confirmation_email_sent_at  TIMESTAMP NULL,              -- guards against a duplicate confirmation email
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (checked_in_by) REFERENCES admins(id),
  UNIQUE KEY uniq_reg_order (registration_id, participant_order),
  UNIQUE KEY uniq_event_roll (event_id, roll_number)
);

CREATE TABLE admins (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(50)  NOT NULL UNIQUE,
  email          VARCHAR(150) NOT NULL UNIQUE,          -- new: needed to send password-reset links
  password_hash  VARCHAR(255) NOT NULL,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
```

Dropped from the prior version: `payment_method` — with cash/counter payment removed, every paid
registration goes through Razorpay, so the column added nothing. `payment_confirmed_by`/`_at` stay,
now solely for the rare manual-override case (Part 4).

`registration_code` is nullable rather than backed by a placeholder value: an earlier draft of the
controller snippet (Part 12) inserted a literal `'PENDING'` string and updated it to the real code
right after, but since the column is `UNIQUE`, every concurrent registration would have briefly
collided on that same placeholder and serialized behind each other — exactly the "doors open" rush
scenario Part 6 worries about. MySQL's `UNIQUE` index allows multiple `NULL`s, so leaving it `NULL`
until the follow-up `UPDATE` sets the real, already-unique code avoids the collision entirely.

No separate table for password-reset/magic-link tokens (Part 4/Part 7) — both are **stateless**:
a short-lived JWT signed with the existing secrets, carrying the account id and a hash of the
account's current `password_hash` (admin) so that once the password actually changes, any old reset
link in someone's inbox stops verifying — no DB row to create, expire, or clean up.

`check_in_code` format unchanged: `<registration_code>-<participant_order>`, generated only inside
`confirmPayment()`.

**Concurrency note** (from reviewing the whole flow): both the capacity check in Part 2 and marking
`checked_in = true` in Part 6 need `SELECT ... FOR UPDATE` locking on the relevant rows — without it,
two near-simultaneous requests (two teams grabbing the last capacity slot; two scanner devices
checking the same person in at once) can both read a stale state and both "succeed."

---

## Part 4 — Admin dashboard

Protected behind `POST /api/admin/login` (bcrypt-hashed password, JWT in an httpOnly cookie). The
first admin account comes from `backend/src/db/create-admin.js`, a one-time CLI seed script
(`node create-admin.js <username> <email> <password>` — `email` needed for the password-reset flow
below) — no public admin signup exists or should exist.

**Registrations table** (`GET /api/admin/registrations`) — search across `full_name`, `roll_number`,
`mobile`, `email`, `team_name`, `registration_code`; filter by event and `payment_status`; CSV export
of the current filtered view. Row actions for `created` rows: **Confirm** / **Reject**, a manual
override for edge cases (e.g. webhook + signature both somehow failed) — before rejecting, an admin
should sanity-check the order's real status in the Razorpay dashboard rather than rejecting a payment
that's just still processing.

**Add Team Member** (new) — for a team that registered below an event's `max_team_size` (e.g. 2 of a
possible 3) and wants to add someone after submitting. `POST /api/admin/registrations/:id/participants`:
rejects if the registration is already at `event.max_team_size`, rejects (`409`, same as at
registration time) if the new person's roll number is already registered for that event. If the
registration's payment is already `paid`/`not_required`, the endpoint calls `confirmPayment()` again
— safe to do because check-in code generation is deterministic and every side effect is already
guarded (Part 1) — so existing members are untouched (their codes recompute to the same value,
nobody gets re-notified) and only the newly added member gets a check-in code and their confirmation
email. If payment isn't settled yet, the new member simply joins the normal flow and gets their code
whenever payment confirms like everyone else. The team's `registration_fee` doesn't change — fee is
per-team, not per-person, for both paid events.

**Forgot / reset password** (new) — standard flow, now that `admins.email` exists:
`POST /api/admin/forgot-password` (`{ email }`, rate-limited same as login) emails a reset link
containing the stateless token described in Part 3. The response is identical whether or not that
email matches an account ("If an account exists for that email, a reset link has been sent") — never
reveal which emails are valid admin accounts. `POST /api/admin/reset-password` (`{ token,
newPassword }`) verifies the token (signature, expiry, and that the embedded password-hash still
matches — i.e. it hasn't already been used) and updates `password_hash`.

---

## Part 5 — Post-payment notifications

Both of the following are triggered from inside the shared `confirmPayment()` service — each fires
exactly once per registration/participant regardless of which of the two payment-confirmation
triggers fired (signature callback or webhook), each guarded by its own "already sent" column so a
webhook-plus-callback race can't send either one twice. Both follow the same failure-isolation rule:
**a send failure never rolls back the payment confirmation itself** — the DB transaction commits
regardless of whether the message/email goes out; the relevant `*_sent_at IS NULL` in the admin
dashboard is the visible signal something didn't go out, for a manual resend later.

### WhatsApp payment confirmation (Twilio)

- **Provider**: Twilio's WhatsApp API — sandbox mode is free for development, production sending
  needs an approved message template and a paid Twilio WhatsApp-enabled number. **Start the template
  approval process early** — it runs on Twilio's review timeline (days), independent of and in
  parallel with the rest of development. (Same applies to Razorpay live-mode/KYC activation.)
- **Recipient**: the registrant's `mobile` (participant #1). Guarded by `registrations.notified_at`.
- **Content**: team name, event, registration code, "Payment confirmed", and a link to check status
  (now doubling as a login link — Part 7).

### Registration confirmation email — formal, branded (new)

After payment confirms, a single **HTML-templated confirmation email** is sent to every participant
who has an email on file — not a plain-text notice. This is meant to read as a proper "you're in"
moment, not an afterthought, so it's designed rather than just composed:

- **Content**: a congratulatory headline (e.g. *"🎉 Congratulations — your team's TechSpark 2026
  registration is confirmed!"*), the registration summary (team name, event, registration code, full
  team roster), a note that their personal check-in QR is available by logging in with their
  email + mobile (Part 7's login, linked directly), the **WhatsApp Community invite
  link** as a clear call-to-action button, and coordinator contact info in the footer (reusing the
  same names/numbers already on `index.html` today).
- **Visual identity**: reuse the site's brand colors (the burnt-orange/cyan accents on a dark or
  clean-light card layout, Part 2 of the earlier design pass) for headers, the CTA button, and
  section dividers. One real constraint worth setting expectations on: **custom web fonts (Bebas
  Neue) mostly don't render in email clients** — Gmail/Outlook strip most `@font-face` — so the email
  template uses bold system fonts + the brand colors/layout to carry the "impact," not the exact
  site typography.
- **Build approach**: author the template in **MJML** (compiles to the verbose, table-based,
  inline-styled HTML that email clients actually render consistently — hand-writing that HTML
  directly is painful and easy to get subtly wrong per-client) and send the compiled HTML via
  `nodemailer`.
- Guarded per-participant by `participants.confirmation_email_sent_at`, sent independently per
  recipient so one bad address doesn't block a teammate's (same failure-isolation rule as Part 5's
  opening paragraph).
- **Email provider**: `nodemailer` + an SMTP account — a free-tier transactional provider (Brevo or
  Resend) is the recommended default for deliverability (transactional providers keep "confirmation"
  emails out of spam far more reliably than personal SMTP); plain Gmail SMTP works as a zero-signup
  fallback at this volume, but is more likely to land in spam for a "look official" email like this.
- **The community link is a static value** (env var `WHATSAPP_COMMUNITY_LINK`), not generated per
  user — WhatsApp doesn't expose an API for third parties to mint personal community invites, so this
  is a normal invite URL the organizer creates once inside the WhatsApp app. **Joining is fully
  self-service**: the participant taps the link in the email and joins themselves — no admin ever
  manually adds anyone to the community one-by-one, and this codebase never talks to WhatsApp's
  membership APIs at all (there isn't one available for this use case). The only manual step, ever,
  is the one-time community-settings change noted below.
- **Coverage gap worth a decision**: `email` is required for participant #1 (Step 1 of the form) but
  currently optional for team members 2..N (matching the existing site's form) — team members without
  an email on file get no confirmation email. If everyone should get one, making email required for
  every participant is a small form-validation change — flagging as a product decision, not deciding
  it silently.
- **Setup step outside this codebase**: restricting the WhatsApp Community so only admins can add new
  members is a one-time setting the organizer sets inside the WhatsApp app when creating it —
  "Community settings → who can add participants → Admins only." Not a build task.

---

## Part 6 — Admin Scanner (event check-in)

`/admin/scan`, camera-based via **`html5-qrcode`** (works on any admin's phone/laptop browser). Scans
a participant's **`check_in_code`** QR (exists only post-payment). `GET /api/admin/verify/:code`,
three outcomes:

| Case | Response | Admin UI |
|---|---|---|
| Code doesn't exist at all | `404` | Red: **"NO TEAM REGISTERED"** |
| Code exists, payment not settled | `200`, `authorized: false` | Amber: **"NOT AUTHORIZED — payment pending/failed"**, team name still shown so staff can redirect to the help desk |
| Code exists, payment settled | `200`, `authorized: true` | Green banner: **Team Name** (or the participant's own name for individual events, which have no team name), event, and every participant's name + individual check-in code + checked-in status |

Scanning **any one** participant's QR resolves the whole team (via `registration_id`), so the admin
processes the entire team from one scan. Each participant row has **"Mark checked in"**
(`PATCH /api/admin/participants/:id/check-in`, row-locked per the concurrency note in Part 3) —
re-scanning shows "already checked in at 10:42 by admin1" instead of allowing a second entry.

Worth deciding before the event: where the backend is hosted and whether it's fast/reliable enough
for a burst of check-ins at doors-open time, since that's what this whole flow depends on live.

---

## Part 7 — Participant login & persistent QR/team display (new)

Goal: once payment is confirmed, the registrant's QR codes + team info should show automatically
whenever they visit the site again — not require re-typing a code every time.

- **Not a password system** — deliberately lightweight, since the data behind it (your own team's QR
  + roster) is low-sensitivity and this is upgrading *persistence/convenience* over what a public
  `registration_code` lookup already exposed, not adding real access control.
- **Credentials: email + mobile number** (both already collected at registration) — email is the
  identifier, mobile is the password-equivalent. Chose mobile over team name for this: a team name is
  often publicly visible elsewhere in the app (event listings, admin dashboard, any leaderboard),
  making it a weak secret; a mobile number isn't displayed anywhere else, so it's the better of the
  two given neither is a "real" password. `POST /api/participants/login` — `{ email, mobile }` — finds
  the participant with that email + mobile, resolves their team via `registration_id`, and issues a
  **participant-scoped JWT** (distinct from the admin JWT), stored in the browser with an expiry
  covering the whole fest window.
- **Login isn't limited to the team leader** — the lookup matches against every row in `participants`,
  so any team member with both an email and mobile on file can log in independently with their own
  credentials, and it resolves the same shared team/QR view via `registration_id` regardless of which
  member logged in. A participant with no email on file (or an email that doesn't match a mobile on
  the same row) simply has nothing to match — login fails with a clear "no matching registration
  found," not a silent allow.
- Since email is now the login identifier and not just a notification channel, the existing gap
  matters more: email is required for participant #1 but optional for team members 2..N. A member
  without an email on file can't log in directly this way — they'd see their code via a teammate's
  session instead. Left as-is per the current form rather than silently making email required for
  everyone; flag if you'd rather change that.
- **Auto-login right after registering/paying** — since the user just proved ownership by completing
  the form, `confirmPayment()` (or the initial free-event submit) has the frontend store this token
  immediately, no separate login step needed for the common case.
- `GET /api/participants/me` (participant JWT required) — same shape as the existing
  `GET /api/registrations/:code` status payload: team name, event, payment status, and every
  participant's QR (once payment is settled).
- **Frontend behavior**: on any page load, if a valid participant token exists, show a persistent "My
  Registration" card (home page and/or a dedicated view) with team info + QR, no navigation or manual
  code entry required. A `/login` page (email + mobile) covers the case of a different device or
  cleared storage; a logout action clears the token for shared/library computers.
- `/status` (public, code-only lookup) stays as-is for anyone without a saved session — e.g. checking
  a teammate's status without their own device being logged in.
- **"Forgot password" for participants, reframed** (new): there's no real password to reset here
  (email + mobile is the whole scheme, Part 3), so the equivalent recovery need — "I don't have/
  remember the mobile number I registered with" — is served by a **magic sign-in link** instead.
  `POST /api/participants/request-link` (`{ email }`, rate-limited) emails a short-lived signed link;
  opening it (`GET /api/participants/verify-link?token=...`) logs them in directly without needing
  the mobile at all, same generic non-revealing response as the admin flow above. Once in, they can
  see (and, if the UI supports it — a small addition, not core scope) correct a wrong mobile number
  on file for next time.

---

## Part 8 — API summary

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/events` | — | List events |
| GET | `/api/events/:slug` | — | Single event detail |
| POST | `/api/registrations` | — | Create registration + participants |
| GET | `/api/registrations/:code` | — | Public status/QR lookup by code |
| POST | `/api/registrations/:code/verify-payment` | — | Razorpay Checkout success callback, signature-verified |
| POST | `/api/registrations/:code/retry-payment` | — | Re-open/recreate a Razorpay order for a stuck `created` registration |
| POST | `/api/payments/webhook` | Razorpay signature | Server-to-server confirmation (`payment.captured`) and failure (`payment.failed`) |
| POST | `/api/participants/login` | — | Email + mobile → participant JWT |
| GET | `/api/participants/me` | participant | Persistent "my team" view (Part 7) |
| POST | `/api/participants/request-link` | — | Email → magic sign-in link (Part 7 account recovery) |
| GET | `/api/participants/verify-link` | — | Consume the magic link → participant JWT |
| POST | `/api/admin/login` | — | Admin auth, returns JWT |
| POST | `/api/admin/forgot-password` | — | Email → reset link (Part 4) |
| POST | `/api/admin/reset-password` | — | Token + new password → updates `password_hash` |
| GET | `/api/admin/registrations` | admin | Search/filter/list + CSV export |
| PATCH | `/api/admin/registrations/:id/confirm-payment` | admin | Manual override |
| PATCH | `/api/admin/registrations/:id/reject-payment` | admin | Manual override |
| POST | `/api/admin/registrations/:id/participants` | admin | Add a team member to an existing registration, capped at `event.max_team_size` (Part 4) |
| GET | `/api/admin/verify/:code` | admin | Event check-in `check_in_code` lookup |
| PATCH | `/api/admin/participants/:id/check-in` | admin | Mark an individual as checked in |

No ORM — plain `mysql2/promise` with parameterized queries in `models/`; fine at this table count.

---

## Part 9 — Security & abuse prevention

- **Event capacity cap**: `events.max_registrations`, enforced with row locking (Part 3) and cleaned
  up by the stale-registration expiry job (Part 2) so abandoned checkouts don't permanently occupy a
  slot on a capacity-limited event.
- **Rate limiting**: `express-rate-limit` on `POST /api/registrations`, `POST /api/admin/login`,
  `POST /api/participants/login` (mobile-guessing risk against a known email), and the two new
  email-sending recovery endpoints (`POST /api/admin/forgot-password`,
  `POST /api/participants/request-link`) — without a limit, either could be used to mail-bomb an
  inbox by repeatedly requesting links for the same address.
- **Server is the source of truth, always**: team size, payment amount (order created from the DB's
  `fee`, never client-supplied), and payment success itself (HMAC signature / webhook, never a client
  claim).
- **Admin bootstrap**: `create-admin.js` CLI script — no public admin signup.
- **Participant login (Part 7) is intentionally low-security by design** — email + mobile, no real
  password or reset flow — appropriate given what it gates (your own team's already-collected info),
  called out explicitly so it's a deliberate scope decision, not an oversight.
- Optional, not core scope: refunds via Razorpay's API if an event is ever cancelled after payments
  come in — skipping by default.

---

## Part 10 — Frontend integration details

- **Forms**: `react-hook-form` + `zod` per wizard step; team-size bound comes from the fetched event
  object, server re-checks regardless.
- **Razorpay Checkout**: loaded via their `checkout.js` script tag, opened from
  `lib/razorpayCheckout.js`; only the public `key_id` ever reaches the frontend.
- **QR rendering**: `qrcode` npm package, one canvas per participant, shown on `/status` and the
  persistent "My Registration" view (Part 7) once payment is settled.
- **QR scanning** (admin): `html5-qrcode`, only loaded on `/admin/scan`.
- **Animation split** (unchanged): **GSAP + ScrollTrigger** for scroll reveals, countdown tilt,
  confetti; **Motion** for React-state-driven transitions — modals, wizard steps, the scan-result
  banner, button hover/tap.
- **Routing**: public `/`, `/events`, `/register`, `/status`, `/login`; admin `/admin/login`,
  `/admin`, `/admin/scan`, guarded by a route wrapper checking the respective JWT.
- **Event status display**: `EventCard`/`EventModal` compare `event.event_date` to the current time —
  before it, the normal "Register" CTA; once past it, the CTA is replaced with a disabled **"Event
  Completed"** badge, computed client-side from the same field the backend uses to actually block
  submissions (Part 2), so the UI and the enforcement never disagree. Someone reaching `/register`
  directly for a closed event (stale tab, bookmark) sees the same "registration closed" state instead
  of the wizard, rather than being allowed to fill it out and only failing at the final submit.

---

## Part 11 — Phased build order

1. **Backend foundation** — Express init, MySQL pool, run the Part 3 schema, seed the 6 events with
   real `min_team_size`/`max_team_size`/`fee`/`max_registrations`/`event_date` (fee = 300 for Ideathon
   and Hackathon only, 0 for the rest), `create-admin.js` (now takes username + email + password),
   test `GET /api/events`.
2. **Registration API + capacity/rate-limit guards** — team-size, duplicate-roll, and locked
   capacity-cap enforcement, rate limiting, the stale-registration expiry job. Test with curl.
3. **Razorpay integration** — order creation as a post-commit step (not nested in the registration
   transaction), `verify-payment`, webhook (`payment.captured` + `payment.failed`, raw body,
   signature-checked), `confirmPayment()`. Test in Razorpay **test mode** with ngrok for the webhook,
   including firing it twice to confirm no duplicate codes/messages.
4. **Notification services** — Twilio WhatsApp sandbox integration and the MJML-templated
   confirmation email (via `nodemailer`), both wired into `confirmPayment()` with per-recipient
   failure isolation (kick off Twilio's production template approval now, in parallel with
   everything else).
5. **Participant login API** — `POST /api/participants/login` (rate-limited), `GET /api/participants/me`,
   auto-issued from `confirmPayment()`, plus the magic-link recovery pair (rate-limited).
6. **Admin auth + registrations API** — login, forgot/reset password (rate-limited), search/filter/
   list/export, manual confirm/reject, add-team-member.
7. **Admin verify/check-in API** — `GET /api/admin/verify/:code`, check-in endpoint, row-locked. Test
   all three outcomes with curl.
8. **Frontend scaffold** — Vite + React + Tailwind, design tokens, router incl. `/status`, `/login`,
   `/admin/*`.
9. **Static sections** — Hero, Countdown, Leadership, Administration, Coordinators, GSAP reveals.
10. **Events page** — fetched from the API, `EventModal` via Motion.
11. **Registration wizard** — react-hook-form steps, Razorpay Checkout wired in, auto-login on
    completion.
12. **Status/login views** — `/status` lookup, `/login`, persistent "My Registration" card, Retry
    Payment action.
13. **Admin dashboard UI** — table, search/filter, confirm/reject, CSV export.
14. **Admin scanner UI** — the check-in flow from Part 6.
15. **Responsive pass** — every page including both admin screens (the scanner especially needs to
    work well on a phone browser).
16. **Env/deploy prep** — `.env.example` for both apps (Razorpay test vs. live keys, webhook secret,
    Twilio credentials), CORS locked to the real frontend origin, production build verified, hosting
    decided and load-tested for a check-in burst.

---

## Part 12 — Starter code snippets

Working, consistent-with-each-other code for the highest-value pieces — enough to start typing
rather than staring at a blank file. Package lists first, then backend, then frontend.

### Dependencies

```bash
# backend/
npm install express mysql2 dotenv cors cookie-parser jsonwebtoken bcrypt express-rate-limit \
  razorpay twilio nodemailer mjml
npm install -D nodemon

# frontend/
npm create vite@latest frontend -- --template react
cd frontend
npm install react-router-dom react-hook-form zod @hookform/resolvers \
  gsap motion qrcode html5-qrcode
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### backend/.env.example

```
PORT=4000
DATABASE_URL=mysql://user:techspark@localhost:3306/techspark2026
JWT_ADMIN_SECRET=change_me
JWT_PARTICIPANT_SECRET=change_me_too
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
TWILIO_ACCOUNT_SID=xxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=xxxxx
SMTP_PASS=xxxxx
EMAIL_FROM="TechSpark 2026 <noreply@techspark2026.in>"
WHATSAPP_COMMUNITY_LINK=https://chat.whatsapp.com/xxxxxxxx
FRONTEND_URL=http://localhost:5173
```

### backend/src/db/pool.js

```js
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
});
```

### backend/src/app.js

```js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import eventsRoutes from "./routes/events.routes.js";
import registrationsRoutes from "./routes/registrations.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import participantsRoutes from "./routes/participants.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(cookieParser()); // required — adminAuth.js reads req.cookies.adminToken

// The webhook needs the RAW body for signature verification, so it must be
// mounted before express.json() parses everything else.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/api/events", eventsRoutes);
app.use("/api/registrations", registrationsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/participants", participantsRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);
export default app;
```

```js
// backend/src/server.js
import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
```

### backend/src/utils/generateCode.js

```js
export function registrationCodeFromId(id) {
  return `TS2026-${String(id).padStart(6, "0")}`;
}

export function checkInCodeFor(registrationCode, participantOrder) {
  return `${registrationCode}-${String(participantOrder).padStart(2, "0")}`;
}
```

### backend/src/middleware/rateLimiter.js

```js
import rateLimit from "express-rate-limit";

export const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many registration attempts, try again later." },
});

// Shared shape for both admin login and participant login (Part 9).
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, try again later." },
});
```

### backend/src/middleware/adminAuth.js / participantAuth.js

```js
import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
  const token = req.cookies?.adminToken || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
```

```js
// participantAuth.js — same shape, separate secret so an admin token can never
// double as a participant token or vice versa.
import jwt from "jsonwebtoken";

export function requireParticipant(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.participant = jwt.verify(token, process.env.JWT_PARTICIPANT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function issueParticipantToken(participant) {
  return jwt.sign(
    { participantId: participant.id, registrationId: participant.registration_id },
    process.env.JWT_PARTICIPANT_SECRET,
    { expiresIn: "60d" }
  );
}
```

### backend/src/controllers/participants.controller.js — login (Part 7)

```js
import { pool } from "../db/pool.js";
import { issueParticipantToken } from "../middleware/participantAuth.js";

export async function loginParticipant(req, res) {
  const { email, mobile } = req.body;
  // Matches ANY participant row — leader or team member — not just the person
  // who originally submitted the form. No match (missing/mismatched email or
  // mobile on file) is a clean 401, never a silent allow.
  const [[participant]] = await pool.query(
    "SELECT * FROM participants WHERE email = ? AND mobile = ?",
    [email, mobile]
  );
  if (!participant) return res.status(401).json({ error: "No matching registration found" });

  const token = issueParticipantToken(participant);
  res.json({ token });
}

export async function getMyRegistration(req, res) {
  const [[registration]] = await pool.query(
    "SELECT * FROM registrations WHERE id = ?",
    [req.participant.registrationId]
  );
  const [participants] = await pool.query(
    "SELECT full_name, roll_number, check_in_code, checked_in FROM participants WHERE registration_id = ? ORDER BY participant_order",
    [req.participant.registrationId]
  );
  res.json({ registration, participants });
}
```

### backend/src/controllers/registrations.controller.js

The flagship example — shows the transaction, the row-locked capacity check, team-size validation,
code generation from the auto-increment id, and the Razorpay order call happening only *after*
commit (Part 2, step 3):

```js
import { pool } from "../db/pool.js";
import { registrationCodeFromId } from "../utils/generateCode.js";
import { confirmPayment } from "../services/confirmPayment.js";
import { createOrder } from "../services/razorpay.js";

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export async function createRegistration(req, res, next) {
  const { eventSlug, teamName, participants } = req.body;
  const conn = await pool.getConnection();
  let registrationId, registrationCode, event, paymentStatus;

  try {
    await conn.beginTransaction();

    const [[evt]] = await conn.query("SELECT * FROM events WHERE slug = ? FOR UPDATE", [eventSlug]);
    if (!evt) throw httpError(404, "Event not found");
    event = evt;

    if (new Date() >= new Date(event.event_date)) {
      throw httpError(409, "Registration for this event is closed");
    }

    const teamSize = participants.length;
    if (teamSize < event.min_team_size || teamSize > event.max_team_size) {
      throw httpError(400, `Team size must be between ${event.min_team_size} and ${event.max_team_size}`);
    }

    if (event.max_registrations !== null) {
      const [[{ count }]] = await conn.query(
        `SELECT COUNT(*) AS count FROM registrations
         WHERE event_id = ? AND payment_status IN ('not_required','created','paid') FOR UPDATE`,
        [event.id]
      );
      if (count >= event.max_registrations) throw httpError(409, "Event is full");
    }

    paymentStatus = event.fee > 0 ? "created" : "not_required";

    // registration_code starts NULL (the column allows multiple NULLs under its UNIQUE index) —
    // never a shared placeholder value, which would otherwise serialize every concurrent signup
    // on the same collision (Part 3).
    const [regResult] = await conn.query(
      `INSERT INTO registrations (event_id, team_name, team_size, registration_fee, payment_status)
       VALUES (?, ?, ?, ?, ?)`,
      [event.id, teamName ?? null, teamSize, event.fee, paymentStatus]
    );
    registrationId = regResult.insertId;
    registrationCode = registrationCodeFromId(registrationId);
    await conn.query("UPDATE registrations SET registration_code = ? WHERE id = ?", [registrationCode, registrationId]);

    for (const [i, p] of participants.entries()) {
      await conn.query(
        `INSERT INTO participants
           (registration_id, event_id, participant_order, full_name, roll_number, college, course, branch, year, mobile, email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [registrationId, event.id, i + 1, p.fullName, p.rollNumber,
         p.college ?? null, p.course ?? null, p.branch ?? null, p.year ?? null, p.mobile ?? null, p.email ?? null]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "One or more roll numbers are already registered for this event" });
    }
    return next(err);
  } finally {
    conn.release();
  }

  if (paymentStatus === "not_required") {
    await confirmPayment(registrationId);
    return res.status(201).json({ registrationCode, paymentRequired: false });
  }

  // Outside the transaction, on purpose — an external HTTP call has no business holding a DB lock open.
  try {
    const order = await createOrder({ amount: event.fee, receipt: registrationCode });
    await pool.query("UPDATE registrations SET razorpay_order_id = ? WHERE id = ?", [order.id, registrationId]);
    return res.status(201).json({
      registrationCode,
      paymentRequired: true,
      razorpayOrderId: order.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: event.fee,
    });
  } catch (err) {
    await pool.query("UPDATE registrations SET payment_status = 'failed' WHERE id = ?", [registrationId]);
    return next(httpError(502, "Could not initialize payment, please try again"));
  }
}
```

### backend/src/services/passwordReset.js — stateless reset/magic-link tokens (Part 3)

Shared by both the admin reset flow and the participant magic link — same mechanic, different
purpose string so a token minted for one can never be replayed as the other:

```js
import jwt from "jsonwebtoken";

// secret is caller-provided (not hardcoded) so an admin-purpose token is always signed
// with JWT_ADMIN_SECRET and a participant-purpose token with JWT_PARTICIPANT_SECRET —
// keeping the same secret separation participantAuth.js already relies on, instead of
// quietly signing both purposes with one shared secret.
export function issueRecoveryToken({ purpose, subjectId, invalidateWith, secret }) {
  return jwt.sign({ purpose, subjectId, invalidateWith }, secret, { expiresIn: "30m" });
}

export function verifyRecoveryToken(token, expectedPurpose, secret) {
  const payload = jwt.verify(token, secret);
  if (payload.purpose !== expectedPurpose) throw new Error("Wrong token purpose");
  return payload;
}
```

### backend/src/controllers/admin.controller.js — forgot/reset password (Part 4)

```js
import { pool } from "../db/pool.js";
import bcrypt from "bcrypt";
import { issueRecoveryToken, verifyRecoveryToken } from "../services/passwordReset.js";
import { sendPasswordResetEmail } from "../services/email.js";

export async function forgotPassword(req, res) {
  const { email } = req.body;
  const [[admin]] = await pool.query("SELECT * FROM admins WHERE email = ?", [email]);

  // Same response either way — never reveal whether the email matches an account.
  if (admin) {
    const token = issueRecoveryToken({
      purpose: "admin_password_reset",
      subjectId: admin.id,
      invalidateWith: admin.password_hash, // old links stop working once the password actually changes
      secret: process.env.JWT_ADMIN_SECRET,
    });
    await sendPasswordResetEmail(admin, token);
  }
  res.json({ message: "If an account exists for that email, a reset link has been sent." });
}

export async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  let payload;
  try {
    payload = verifyRecoveryToken(token, "admin_password_reset", process.env.JWT_ADMIN_SECRET);
  } catch {
    return res.status(400).json({ error: "Reset link is invalid or has expired" });
  }

  const [[admin]] = await pool.query("SELECT * FROM admins WHERE id = ?", [payload.subjectId]);
  if (!admin || admin.password_hash !== payload.invalidateWith) {
    return res.status(400).json({ error: "Reset link has already been used" });
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE admins SET password_hash = ? WHERE id = ?", [password_hash, admin.id]);
  res.json({ ok: true });
}
```

### backend/src/controllers/participants.controller.js — magic sign-in link (Part 7)

```js
import { pool } from "../db/pool.js";
import { issueRecoveryToken, verifyRecoveryToken } from "../services/passwordReset.js";
import { issueParticipantToken } from "../middleware/participantAuth.js";
import { sendMagicLinkEmail } from "../services/email.js";

export async function requestMagicLink(req, res) {
  const { email } = req.body;
  const [[participant]] = await pool.query("SELECT * FROM participants WHERE email = ?", [email]);

  if (participant) {
    const token = issueRecoveryToken({
      purpose: "participant_magic_link",
      subjectId: participant.id,
      invalidateWith: participant.mobile, // stops working once the mobile on file changes
      secret: process.env.JWT_PARTICIPANT_SECRET,
    });
    await sendMagicLinkEmail(participant, token);
  }
  res.json({ message: "If that email is on a registration, a sign-in link has been sent." });
}

export async function verifyMagicLink(req, res) {
  const { token } = req.query;
  let payload;
  try {
    payload = verifyRecoveryToken(token, "participant_magic_link", process.env.JWT_PARTICIPANT_SECRET);
  } catch {
    return res.status(400).json({ error: "Link is invalid or has expired" });
  }

  const [[participant]] = await pool.query("SELECT * FROM participants WHERE id = ?", [payload.subjectId]);
  if (!participant || participant.mobile !== payload.invalidateWith) {
    return res.status(400).json({ error: "Link has already been used" });
  }

  res.json({ token: issueParticipantToken(participant) });
}
```

### backend/src/controllers/admin.controller.js — add a team member (Part 4)

```js
import { pool } from "../db/pool.js";
import { confirmPayment } from "../services/confirmPayment.js";

export async function addTeamMember(req, res, next) {
  const { id } = req.params;
  const { fullName, rollNumber, mobile, email } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[registration]] = await conn.query("SELECT * FROM registrations WHERE id = ? FOR UPDATE", [id]);
    if (!registration) throw httpError(404, "Registration not found");

    const [[event]] = await conn.query("SELECT * FROM events WHERE id = ?", [registration.event_id]);
    const [existing] = await conn.query(
      "SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order",
      [id]
    );

    if (existing.length >= event.max_team_size) {
      throw httpError(400, `Team is already at the maximum size of ${event.max_team_size}`);
    }

    const nextOrder = existing.length + 1;
    await conn.query(
      `INSERT INTO participants
         (registration_id, event_id, participant_order, full_name, roll_number, mobile, email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, registration.event_id, nextOrder, fullName, rollNumber, mobile ?? null, email ?? null]
    );
    await conn.query("UPDATE registrations SET team_size = ? WHERE id = ?", [nextOrder, id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "That roll number is already registered for this event" });
    }
    return next(err);
  } finally {
    conn.release();
  }

  // Payment already settled — backfill just the new member. Safe to re-run: existing
  // participants' codes recompute to the same value and are already marked notified,
  // so only the new member gets a check-in code + their confirmation email (Part 1, Part 5).
  const [[registration]] = await pool.query("SELECT payment_status FROM registrations WHERE id = ?", [id]);
  if (registration.payment_status === "paid" || registration.payment_status === "not_required") {
    await confirmPayment(id);
  }

  res.status(201).json({ ok: true });
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
```

### backend/src/services/confirmPayment.js

The shared idempotent core (Part 1/Part 5) — every payment-confirmation trigger calls this and only
this:

```js
import { pool } from "../db/pool.js";
import { checkInCodeFor } from "../utils/generateCode.js";
import { sendPaymentConfirmationWhatsApp } from "./whatsapp.js";
import { sendConfirmationEmail } from "./email.js";
import { issueParticipantToken } from "../middleware/participantAuth.js";

export async function confirmPayment(registrationId, { confirmedByAdminId } = {}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[registration]] = await conn.query("SELECT * FROM registrations WHERE id = ? FOR UPDATE", [registrationId]);
    if (!registration) throw new Error(`Registration ${registrationId} not found`);

    const [participants] = await conn.query(
      "SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order",
      [registrationId]
    );

    // Idempotency guard — handles the webhook-vs-client-callback race (Part 2, step 4).
    if (participants.every((p) => p.check_in_code !== null)) {
      await conn.rollback();
      return;
    }

    for (const p of participants) {
      const checkInCode = checkInCodeFor(registration.registration_code, p.participant_order);
      await conn.query("UPDATE participants SET check_in_code = ? WHERE id = ?", [checkInCode, p.id]);
    }

    await conn.query(
      `UPDATE registrations SET payment_status = 'paid', payment_confirmed_by = ?, payment_confirmed_at = NOW() WHERE id = ?`,
      [confirmedByAdminId ?? null, registrationId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Side effects, deliberately outside the transaction and isolated from each other —
  // a WhatsApp or email failure must never undo the payment confirmation (Part 5).
  const [[registration]] = await pool.query("SELECT * FROM registrations WHERE id = ?", [registrationId]);
  const [participants] = await pool.query(
    "SELECT * FROM participants WHERE registration_id = ? ORDER BY participant_order",
    [registrationId]
  );
  const leader = participants[0];

  try {
    if (!registration.notified_at) {
      await sendPaymentConfirmationWhatsApp(leader, registration);
      await pool.query("UPDATE registrations SET notified_at = NOW() WHERE id = ?", [registrationId]);
    }
  } catch (err) {
    console.error("WhatsApp send failed", err);
  }

  for (const p of participants) {
    if (!p.email || p.confirmation_email_sent_at) continue;
    try {
      await sendConfirmationEmail(p, registration, participants);
      await pool.query("UPDATE participants SET confirmation_email_sent_at = NOW() WHERE id = ?", [p.id]);
    } catch (err) {
      console.error(`Confirmation email failed for participant ${p.id}`, err);
    }
  }

  return { registration, participants, participantToken: issueParticipantToken(leader) };
}
```

### backend/src/services/razorpay.js

```js
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export async function createOrder({ amount, receipt }) {
  return razorpay.orders.create({ amount: Math.round(amount * 100), currency: "INR", receipt });
}

export function verifySignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

export function verifyWebhookSignature(rawBody, signatureHeader) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}
```

### backend/src/routes/payments.routes.js — the webhook

```js
import { Router } from "express";
import { verifyWebhookSignature } from "../services/razorpay.js";
import { confirmPayment } from "../services/confirmPayment.js";
import { pool } from "../db/pool.js";

const router = Router();

router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(req.body.toString());
  const orderId = event.payload?.payment?.entity?.order_id;
  const [[registration]] = await pool.query("SELECT * FROM registrations WHERE razorpay_order_id = ?", [orderId]);
  if (!registration) return res.status(200).send("ok");

  if (event.event === "payment.captured") {
    await confirmPayment(registration.id);
  } else if (event.event === "payment.failed") {
    await pool.query(
      "UPDATE registrations SET payment_status = 'failed' WHERE id = ? AND payment_status = 'created'",
      [registration.id]
    );
  }
  res.status(200).send("ok");
});

export default router;
```

### backend/src/services/whatsapp.js

```js
import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendPaymentConfirmationWhatsApp(leader, registration) {
  if (!leader.mobile) return;
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:+91${leader.mobile}`,
    body: `TechSpark 2026: Payment confirmed for "${registration.team_name ?? leader.full_name}" (${registration.registration_code}). View your QR: ${process.env.FRONTEND_URL}/status?code=${registration.registration_code}`,
  });
}
```

### backend/src/services/email.js — MJML template (Part 5)

```js
import mjml2html from "mjml";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function buildTemplate({ participant, registration, teamRoster }) {
  return `
    <mjml>
      <mj-body background-color="#0a0a0f">
        <mj-section background-color="#16161f" padding="32px">
          <mj-column>
            <mj-text align="center" color="#ff6b00" font-size="24px" font-weight="700">
              🎉 Congratulations, ${participant.full_name}!
            </mj-text>
            <mj-text align="center" color="#f5f3ee" font-size="16px">
              Your team's registration for <strong>TechSpark 2026</strong> is confirmed.
            </mj-text>
            <mj-divider border-color="#ffffff22" />
            <mj-text color="#f5f3ee">
              <strong>Team:</strong> ${registration.team_name ?? participant.full_name}<br/>
              <strong>Registration Code:</strong> ${registration.registration_code}<br/>
              <strong>Team Members:</strong> ${teamRoster.map((p) => p.full_name).join(", ")}
            </mj-text>
            <mj-button background-color="#ff6b00" href="${process.env.FRONTEND_URL}/status?code=${registration.registration_code}">
              View My QR Code
            </mj-button>
            <mj-button background-color="#00d4ff" href="${process.env.WHATSAPP_COMMUNITY_LINK}">
              Join the WhatsApp Community
            </mj-button>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;
}

export async function sendConfirmationEmail(participant, registration, teamRoster) {
  const { html } = mjml2html(buildTemplate({ participant, registration, teamRoster }));
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: participant.email,
    subject: "🎉 Your TechSpark 2026 registration is confirmed!",
    html,
  });
}
```

### frontend/src/lib/api.js

```js
const API_URL = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getEvents: () => request("/api/events"),
  register: (payload) => request("/api/registrations", { method: "POST", body: JSON.stringify(payload) }),
  verifyPayment: (code, payload) =>
    request(`/api/registrations/${code}/verify-payment`, { method: "POST", body: JSON.stringify(payload) }),
  getStatus: (code) => request(`/api/registrations/${code}`),
  // payload: { email, mobile }
  participantLogin: (payload) => request("/api/participants/login", { method: "POST", body: JSON.stringify(payload) }),
};
```

### frontend/src/lib/razorpayCheckout.js

```js
// Loaded globally via the <script src="https://checkout.razorpay.com/v1/checkout.js"> tag in index.html.
export function openRazorpayCheckout({ orderId, keyId, amount, onSuccess }) {
  const rzp = new window.Razorpay({
    key: keyId,
    order_id: orderId,
    amount: amount * 100,
    currency: "INR",
    name: "TechSpark 2026",
    theme: { color: "#ff6b00" },
    handler: onSuccess, // { razorpay_payment_id, razorpay_order_id, razorpay_signature }
  });
  rzp.open();
}
```

### frontend/src/lib/schemas.js (react-hook-form + zod, Part 10)

```js
import { z } from "zod";

export const personalDetailsSchema = z.object({
  fullName: z.string().min(1, "Required"),
  rollNumber: z.string().min(1, "Required"),
  college: z.string().min(1, "Required"),
  course: z.string().min(1, "Required"),
  branch: z.string().min(1, "Required"),
  year: z.string().min(1, "Required"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email("Enter a valid email"),
});

// max/min come from the fetched event object at runtime — see StepTeamMembers.jsx
export const teamMemberSchema = z.object({
  fullName: z.string().min(1, "Required"),
  rollNumber: z.string().min(1, "Required"),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
});
```

### frontend/src/App.jsx

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Events from "./pages/Events";
import Register from "./pages/Register";
import Status from "./pages/Status";
import Login from "./pages/Login";
import MagicLink from "./pages/MagicLink";
import AdminLogin from "./admin/AdminLogin";
import AdminForgotPassword from "./admin/AdminForgotPassword";
import AdminResetPassword from "./admin/AdminResetPassword";
import AdminDashboard from "./admin/AdminDashboard";
import AdminScanner from "./admin/AdminScanner";
import AdminRoute from "./admin/AdminRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<Events />} />
        <Route path="/register" element={<Register />} />
        <Route path="/status" element={<Status />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/magic" element={<MagicLink />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
        <Route path="/admin/reset-password" element={<AdminResetPassword />} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/scan" element={<AdminRoute><AdminScanner /></AdminRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
```

### frontend/tailwind.config.js (design tokens from the earlier hackyatra.in research pass)

```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0f",
        surface: "#16161f",
        raised: "#1c1c28",
        foreground: "#f5f3ee",
        "foreground-muted": "rgba(245,243,238,.55)",
        primary: { DEFAULT: "#ff6b00", light: "#ff8c3a" },
        accent: "#00d4ff",
        border: "rgba(255,255,255,.08)",
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        body: ["Poppins", "sans-serif"],
      },
    },
  },
};
```

---

## Verification

- Every backend endpoint hit directly with curl/Postman before the frontend depends on it.
- Full lifecycle: free event (immediate codes + auto-login), paid event via Razorpay **test mode**
  (checkout → verify-payment → codes + WhatsApp + login token).
- Webhook idempotency: fire `payment.captured` twice, confirm no duplicate codes/messages; fire
  `payment.failed` and confirm the registration clears to `'failed'`, freeing its capacity slot.
- Team-size abuse: `POST /api/registrations` directly with more participants than `max_team_size` →
  rejected.
- Duplicate-roll: same roll number, same event, twice → second rejected.
- Capacity cap + expiry: fill an event to `max_registrations`, confirm the next registration is
  rejected; abandon a checkout, confirm the stale-registration job frees its slot after the timeout.
- Rate limit: rapid-fire requests to `POST /api/registrations`, `POST /api/admin/login`, and
  `POST /api/participants/login` → all three throttled.
- Confirmation email: confirm it arrives once per participant with an email on file (check subject,
  branding/colors render correctly across at least Gmail + Outlook web, and the community link
  button works), confirm a second `confirmPayment()` call (webhook race) doesn't send it twice, and
  confirm one bad email address on a team doesn't prevent teammates from receiving theirs.
- Scanner: valid participant (green, full team shown), pending-payment participant (amber, not
  authorized), made-up code (red, "NO TEAM REGISTERED"); re-scan after check-in shows the prior
  check-in time/admin instead of allowing a duplicate.
- Participant login: log in with email + mobile on a fresh browser/session, confirm the same QR/team
  info shown on `/status` appears automatically on revisit without re-entering anything.
- Registration cutoff: set an event's `event_date` in the past, confirm `POST /api/registrations` is
  rejected for it and the events list shows "Event Completed" instead of a Register CTA; confirm
  check-in scanning for that event's already-registered teams still works unaffected.
- Account recovery: request an admin password reset and a participant magic link, confirm both emails
  arrive, confirm each token works exactly once (a second use of the same link fails with "already
  used"), confirm an expired token is rejected, and confirm requesting a link for an email that
  doesn't exist returns the same generic response as one that does.
