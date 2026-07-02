import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { handlePlatformFeePaid } from "@/actions/publish";
import { handleRegistrationPaid } from "@/actions/registrations";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const type = session.metadata?.type;

    if (type === "platform_fee") {
      const eventId = session.metadata?.eventId;
      const orgId = session.metadata?.orgId;
      if (eventId && orgId) {
        await handlePlatformFeePaid(eventId, orgId, session.id);
      }
    }

    if (type === "registration") {
      const registrationId = session.metadata?.registrationId;
      const eventId = session.metadata?.eventId;
      if (registrationId && eventId) {
        await handleRegistrationPaid(
          registrationId,
          eventId,
          session.id,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
