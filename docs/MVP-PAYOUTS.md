# MVP entry fee payouts

**Decision (Phase 1):** OpenRound collects player entry fees through its own Stripe account. Organizers receive payouts manually after the event.

## Why

- Stripe Connect adds onboarding, compliance, and support overhead.
- The PRD allows platform collection first with manual club payout in v1.
- Charity and volunteer organizers often prefer a single trusted checkout experience at launch.

## Player experience

- Players pay via Stripe Checkout on the public registration page.
- OpenRound stores payment status and sends confirmation email.
- Refund requests go to the event organizer (see refund policy on registration page).

## Organizer experience

- Entry fees appear in OpenRound's Stripe dashboard until Connect ships.
- Organizers are paid out manually on a defined schedule (e.g. within 5 business days after the event).
- Platform fee ($49/event Starter) is separate and charged at publish.

## Future (post-MVP)

- Stripe Connect for automatic payouts to organizer/club accounts.
- In-app refund initiation for organizers.
- Itemized payout reports in the dashboard.
