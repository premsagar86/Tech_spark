import mjml2html from "mjml";
import nodemailer from "nodemailer";
import QRCode from "qrcode";

// Local .env parsing (dotenv) strips wrapping quotes from values like
// EMAIL_FROM="Name <addr>" automatically, but pasting the same line into a
// host's dashboard (e.g. Railway) often keeps the quotes as literal
// characters, which corrupts the From header and gets sends silently
// rejected — strip them defensively so it works either way.
const EMAIL_FROM = (process.env.EMAIL_FROM ?? "").replace(/^"|"$/g, "");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // Force IPv4 — on Railway (and most containerized PaaS hosts) outbound IPv6
  // routing is often broken/unrouted, so the raw TCP connect just hangs
  // until ETIMEDOUT instead of failing fast or falling back to IPv4 on its own.
  family: 4,
});

// Temporary: confirms exactly what this deployment actually loaded (env var
// mismatches between .env and the hosting dashboard have bitten this project
// twice already) — password/key intentionally not logged.
console.log(
  `Mail transport configured: host=${process.env.SMTP_HOST} port=${process.env.SMTP_PORT} user=${process.env.SMTP_USER} from=${EMAIL_FROM}`
);

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

function confirmationTemplate({ participant, registration, teamRoster }) {
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
    <mj-image src="cid:checkinQr" width="200px" alt="Your check-in QR code" />
    <mj-text align="center" color="#f5f3ee">
      Use this QR code to verify your profile at check-in — just show this email at the event, no login needed.
    </mj-text>
    <mj-text color="#f5f3ee">
      You can also log in with your email + mobile number anytime to view your personal check-in QR.
    </mj-text>
    <mj-button background-color="#ff6b00" href="${process.env.FRONTEND_URL}">
      View My QR Code
    </mj-button>
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
  const { html } = mjml2html(confirmationTemplate({ participant, registration, teamRoster }));
  const qrBuffer = await QRCode.toBuffer(participant.check_in_code, { width: 240, margin: 1 });
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: participant.email,
    subject: "🎉 Your TechSpark 2026 registration is confirmed!",
    html,
    attachments: [{ filename: "check-in-qr.png", content: qrBuffer, cid: "checkinQr" }],
  });
}

export async function sendMagicLinkEmail(participant, token) {
  const linkUrl = `${process.env.FRONTEND_URL}/login/magic?token=${token}`;
  const { html } = mjml2html(magicLinkTemplate({ participant, linkUrl }));
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: participant.email,
    subject: "Sign in to TechSpark 2026",
    html,
  });
}
