import "server-only";

export type SmsSendResult =
  | { success: true; sid: string }
  | { success: false; error: string; skipped?: boolean };

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim()
  );
}

export async function sendSms(
  to: string,
  body: string
): Promise<SmsSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();

  if (!accountSid || !authToken || !from) {
    return {
      success: false,
      error: "SMS is not configured.",
      skipped: true,
    };
  }

  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) {
    return { success: false, error: "Invalid phone number." };
  }

  const params = new URLSearchParams({
    To: normalizedTo,
    From: from,
    Body: body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  const payload = (await response.json()) as {
    sid?: string;
    message?: string;
  };

  if (!response.ok) {
    return {
      success: false,
      error: payload.message ?? "Failed to send SMS.",
    };
  }

  return { success: true, sid: payload.sid ?? "unknown" };
}

export async function sendEventReminderSms(options: {
  to: string;
  playerName: string;
  eventName: string;
  eventDate: string;
  eventUrl: string;
}): Promise<SmsSendResult> {
  const body = `Hi ${options.playerName}, reminder: ${options.eventName} is tomorrow (${options.eventDate}). Details: ${options.eventUrl}`;
  return sendSms(options.to, body);
}

export async function sendWaitlistSpotAvailableSms(options: {
  to: string;
  playerName: string;
  eventName: string;
  eventUrl: string;
}): Promise<SmsSendResult> {
  const body = `Hi ${options.playerName}, a spot opened up for ${options.eventName}. Register now: ${options.eventUrl}`;
  return sendSms(options.to, body);
}
