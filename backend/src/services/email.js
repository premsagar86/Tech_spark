import mjml2html from "mjml";
import QRCode from "qrcode";

// Local .env parsing (dotenv) strips wrapping quotes from values like
// EMAIL_FROM="Name <addr>" automatically, but pasting the same line into a
// host's dashboard (e.g. Railway) often keeps the quotes as literal
// characters, which corrupts the From header and gets sends silently
// rejected — strip them defensively so it works either way.
const EMAIL_FROM = (process.env.EMAIL_FROM ?? "").replace(/^"|"$/g, "");

// Sent over HTTPS via Brevo's transactional email API rather than raw SMTP —
// Railway (and most PaaS hosts) blocks/times out outbound SMTP ports (25/
// 465/587) to curb spam abuse, which made every send here fail with
// ETIMEDOUT on "CONN" no matter what IPv4/IPv6 settings were tried. HTTPS on
// 443 isn't blocked.
console.log(
  `Mail transport configured: provider=brevo-api from=${EMAIL_FROM} apiKeySet=${Boolean(process.env.BREVO_API_KEY)}`
);

function fromAddress() {
  const match = EMAIL_FROM.match(/^(.*)<(.+)>$/);
  const result = match ? { name: match[1].trim() || undefined, email: match[2].trim() } : { email: EMAIL_FROM };
  // Catch a mismatched EMAIL_FROM here, with the actual value in the error —
  // this dashboard/env mismatch has bitten this project three times now, and
  // without this it only ever surfaces as Brevo's generic 400 downstream.
  if (!/\S+@\S+\.\S+/.test(result.email)) {
    throw new Error(`EMAIL_FROM is not a valid sender email: ${JSON.stringify(EMAIL_FROM)}`);
  }
  return result;
}

async function sendViaBrevo({ to, toName, subject, html, attachment }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: fromAddress(),
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
      ...(attachment ? { attachment: [attachment] } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API send failed (${res.status}): ${body}`);
  }
}

// Custom web fonts (Bebas Neue) mostly don't render in email clients —
// Gmail/Outlook strip most @font-face — so these templates use bold system
// fonts + the brand colors/layout to carry the "impact" instead (Part 5).
function wrapper(bodyMjml) {
  return `
    <mjml>
      <mj-body background-color="#0a0a0f">
        <mj-section background-color="#16161f" padding="32px">
          <mj-column>
            ${bodyMjml}
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;
}

function confirmationTemplate({ participant, registration, teamRoster, qrBase64 }) {
  return wrapper(`
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
    <mj-image src="data:image/png;base64,${qrBase64}" width="200px" alt="Your check-in QR code" />
    <mj-text align="center" color="#f5f3ee">
      Use this QR code to verify your profile at check-in — just show this email at the event, no login needed.
    </mj-text>
    <mj-text color="#f5f3ee">
      You can also log in with your email + mobile number anytime to view your personal check-in QR.
    </mj-text>
    <mj-button background-color="#00d4ff" href="${process.env.WHATSAPP_COMMUNITY_LINK}">
      Join the WhatsApp Community
    </mj-button>
    <mj-divider border-color="#ffffff22" />
    <mj-text align="center" color="rgba(245,243,238,.55)" font-size="12px">
      TechSpark 2026 — questions? Contact your event coordinator.
    </mj-text>
  `);
}

function magicLinkTemplate({ participant, linkUrl }) {
  return wrapper(`
    <mj-text align="center" color="#ff6b00" font-size="22px" font-weight="700">
      Sign in to TechSpark 2026
    </mj-text>
    <mj-text color="#f5f3ee">
      Hi ${participant.full_name}, click below to sign in and view your team's QR code. This link
      expires in 30 minutes and can only be used once.
    </mj-text>
    <mj-button background-color="#00d4ff" href="${linkUrl}">
      Sign In
    </mj-button>
    <mj-text color="rgba(245,243,238,.55)" font-size="12px">
      If you didn't request this, you can safely ignore this email.
    </mj-text>
  `);
}

export async function sendConfirmationEmail(participant, registration, teamRoster) {
  const qrBuffer = await QRCode.toBuffer(participant.check_in_code, { width: 240, margin: 1 });
  const qrBase64 = qrBuffer.toString("base64");
  const { html } = mjml2html(confirmationTemplate({ participant, registration, teamRoster, qrBase64 }));
  await sendViaBrevo({
    to: participant.email,
    toName: participant.full_name,
    subject: "🎉 Your TechSpark 2026 registration is confirmed!",
    html,
    // Brevo's API attachments are downloadable-only (no cid inline embedding
    // like raw SMTP MIME) — the QR is already shown inline via the data: URI
    // above; this is a fallback for clients that don't render data URIs.
    attachment: { name: "check-in-qr.png", content: qrBase64 },
  });
}

export async function sendMagicLinkEmail(participant, token) {
  // FRONTEND_URL is a comma-separated list for CORS (app.js) — not a single
  // URL, so it can't be used here. PUBLIC_APP_URL is the single production origin.
  const linkUrl = `${process.env.PUBLIC_APP_URL}/login/magic?token=${token}`;
  const { html } = mjml2html(magicLinkTemplate({ participant, linkUrl }));
  await sendViaBrevo({
    to: participant.email,
    toName: participant.full_name,
    subject: "Sign in to TechSpark 2026",
    html,
  });
}
