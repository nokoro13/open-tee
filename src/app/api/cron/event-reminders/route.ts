import { NextResponse } from "next/server";

import { sendEventRemindersForTomorrow } from "@/lib/event-reminders";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendEventRemindersForTomorrow();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Reminder job failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
