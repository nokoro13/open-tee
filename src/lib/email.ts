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
  await getResend().emails.send({
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
  await getResend().emails.send({
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
