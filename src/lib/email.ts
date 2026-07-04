import { Resend } from "resend";

let resend: Resend | undefined;

function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        "RESEND_API_KEY is not set. Add it to .env.local — see .env.example."
      );
    }
    resend = new Resend(key);
  }
  return resend;
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "OpenTee <onboarding@resend.dev>";
}

async function sendEmail(
  payload: Parameters<Resend["emails"]["send"]>[0]
): Promise<void> {
  const { data, error } = await getResend().emails.send(payload);

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Resend did not accept the email.");
  }
}

function formatEventDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatFee(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export async function sendRegistrationConfirmationEmail({
  to,
  playerName,
  eventName,
  eventDate,
  courseName,
  entryFeeCents,
  eventUrl,
}: {
  to: string;
  playerName: string;
  eventName: string;
  eventDate: string;
  courseName: string;
  entryFeeCents: number;
  eventUrl: string;
}) {
  await sendEmail({
    from: getFromAddress(),
    to,
    subject: `You're registered — ${eventName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; line-height: 1.5;">
        <h1 style="font-size: 20px;">You're in, ${playerName}!</h1>
        <p>Your registration for <strong>${eventName}</strong> is confirmed.</p>
        <ul>
          <li><strong>Date:</strong> ${formatEventDate(eventDate)}</li>
          <li><strong>Course:</strong> ${courseName}</li>
          <li><strong>Entry fee:</strong> ${formatFee(entryFeeCents)}</li>
        </ul>
        <p>We look forward to seeing you on the course.</p>
        <p style="color: #666; font-size: 14px;">
          <a href="${eventUrl}">View event details</a>
        </p>
      </div>
    `,
  });
}

export async function sendPublishConfirmationEmail({
  to,
  eventName,
  eventUrl,
  registrationUrl,
}: {
  to: string;
  eventName: string;
  eventUrl: string;
  registrationUrl: string;
}) {
  await sendEmail({
    from: getFromAddress(),
    to,
    subject: `${eventName} is live on OpenTee`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; line-height: 1.5;">
        <h1 style="font-size: 20px;">Your event is published!</h1>
        <p><strong>${eventName}</strong> is now live and accepting registrations.</p>
        <p>Share your registration link with players:</p>
        <p><a href="${registrationUrl}">${registrationUrl}</a></p>
        <p style="color: #666; font-size: 14px;">
          <a href="${eventUrl}">Manage event in dashboard</a>
        </p>
      </div>
    `,
  });
}

export async function sendScoringLinkEmail({
  to,
  playerName,
  eventName,
  eventDate,
  courseName,
  scoreUrl,
  groupLabel,
  leaderboardUrl,
}: {
  to: string;
  playerName: string;
  eventName: string;
  eventDate: string;
  courseName: string;
  scoreUrl: string;
  groupLabel?: string;
  leaderboardUrl: string;
}) {
  const groupLine = groupLabel
    ? `<li><strong>Group:</strong> ${groupLabel}</li>`
    : "";

  await sendEmail({
    from: getFromAddress(),
    to,
    subject: `Scoring is open — ${eventName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; line-height: 1.5;">
        <h1 style="font-size: 20px;">Scoring is live, ${playerName}!</h1>
        <p>Live scoring has opened for <strong>${eventName}</strong>. Use your scorecard link below to enter scores on the course.</p>
        <ul>
          <li><strong>Date:</strong> ${formatEventDate(eventDate)}</li>
          <li><strong>Course:</strong> ${courseName}</li>
          ${groupLine}
        </ul>
        <p style="margin: 24px 0;">
          <a href="${scoreUrl}" style="display: inline-block; background: #1a5c3a; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Open your scorecard
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Or copy this link: <a href="${scoreUrl}">${scoreUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px;">
          <a href="${leaderboardUrl}">View live leaderboard</a>
        </p>
      </div>
    `,
  });
}
