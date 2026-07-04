# OpenRound — Local Development Setup

## Prerequisites

- Node.js 20+
- [Clerk](https://clerk.com) account (free tier)
- [Neon](https://neon.tech) Postgres database (free tier)
- [Stripe](https://stripe.com) account (test mode)
- [Resend](https://resend.com) account (free tier)

## 1. Environment variables

```bash
cp .env.example .env.local
```

Fill in all values — see `.env.example` for descriptions.

## 2. Push the database schema

```bash
pnpm db:push
```

Creates `organizations`, `events`, and `registrations` tables.

## 3. Stripe webhook (local dev)

In a separate terminal, forward Stripe events to your app:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` secret it prints into `STRIPE_WEBHOOK_SECRET` in `.env.local`, then restart the dev server.

## 4. Run the dev server

```bash
pnpm dev
```

## 5. Try the full Sprint 2 flow

### Organizer — publish an event

1. Sign up / sign in → `/dashboard`
2. Create a draft event — search for a course (OpenGolfAPI) or enter manually
3. Click **Publish event — $49** → pay with Stripe test card `4242 4242 4242 4242`
4. Return to dashboard → copy registration link

### Tournament day — scoring with par

1. Open event → **Open scoring** → share scorer link
2. Enter scores — hole buttons show **Par** when a scorecard was saved
3. Leaderboard shows **+/-** vs par (E, +2, -1, etc.)

### Player — register

1. Open `/e/[your-event-slug]` on your phone or browser
2. Fill in name + email
3. Pay entry fee (or register free if fee is $0)
4. See confirmation page + email

## Stripe test cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Success |
| Any future expiry, any CVC | |

## Useful commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm db:push` | Sync schema to database |
| `pnpm db:studio` | Open Drizzle Studio |

## Sprint status

| Sprint | Status |
|--------|--------|
| 1 — Auth, org, event drafts | ✅ Done |
| 2 — Registration, Stripe, publish | ✅ Done |
| 3 — Pairings, CSV export | ✅ Done |
| 4 — Live scoring, leaderboard | ✅ Done |
| 5 — Polish & launch | Next |

## Route map

```
/                           Landing page
/sign-in, /sign-up          Clerk auth
/dashboard                  Event list
/dashboard/events/new       Create draft
/dashboard/events/[id]      Manage / publish event
/dashboard/events/[id]/export  Download registrations CSV
/e/[slug]                   Public registration
/e/[slug]/success           Registration confirmation
/e/[slug]/score             Volunteer score entry (code required)
/e/[slug]/leaderboard       Public live leaderboard
/api/e/[slug]/leaderboard   Leaderboard JSON (polling)
/api/webhooks/stripe        Stripe webhooks
```
