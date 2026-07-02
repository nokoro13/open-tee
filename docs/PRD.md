# OpenTee — Product Requirements Document

**Version:** 0.1  
**Last updated:** June 30, 2026  
**Status:** Draft  
**Owner:** OpenTee team

---

## 1. Executive summary

OpenTee is a **mobile-first web platform** for hosting and managing golf tournaments. Organizers create events, players register and pay online, and scores flow to a live leaderboard — all in the browser, with no app download.

This PRD defines the **MVP (v1)** required to deliver on the core promise shown on the marketing site, plus a phased roadmap for Pro and Enterprise tiers.

**MVP north-star flow:**

> Organizer creates event → opens registration → players sign up & pay → tournament day scoring on mobile → public live leaderboard → final results published

---

## 2. Problem statement

Running a golf tournament today typically involves:

- Spreadsheets for registrations and pairings
- Manual payment collection (checks, Venmo, pro shop charges)
- Phone calls and email chains on tournament day
- Delayed or paper-based scoring and results

Organizers (club pros, charity directors, association admins) need a single tool that works **on the course from a phone**, not a desktop-only admin panel bolted onto legacy software.

### Opportunity

- Charity outings, corporate scrambles, and club member events happen every week across the US
- Incumbents exist (Golf Genius, GolfStatus, etc.) but many small/mid events still run on manual tools
- OpenTee wins by being **fast to set up, mobile-native, and priced per event** for occasional organizers

---

## 3. Product principles

1. **Mobile-first web** — Design for phone screens first; desktop is secondary. No native app in v1.
2. **No install** — Everything runs in Safari, Chrome, or any modern mobile browser.
3. **Organizer speed** — First event live in under 30 minutes.
4. **Player simplicity** — Register in under 2 minutes; spectators view leaderboard without an account.
5. **Vertical slices** — Ship end-to-end flows, not horizontal “platform layers.”
6. **Honest scope** — Marketing may describe the full vision; MVP ships one complete tournament loop well.

---

## 4. Target users & personas

### Primary — Tournament Organizer (“Director Dana”)

- **Who:** Club pro, charity event chair, corporate outing planner, association volunteer
- **Goals:** Fill the field, collect money, run smooth tournament day, publish results quickly
- **Pain:** Too many tools, too much manual follow-up, scoring delays
- **Device:** Phone on tournament day; laptop during setup

### Secondary — Player (“Fairway Frank”)

- **Who:** Golfer registering for an outing or member event
- **Goals:** Quick signup, clear event info, pay easily, see live standings
- **Pain:** Clunky forms, unclear pricing, no live results
- **Device:** Phone (registration + leaderboard)

### Secondary — Scorer / Volunteer (“Volunteer Val”)

- **Who:** Club member or volunteer entering scores hole-by-hole
- **Goals:** Fast score entry without training; works with spotty cell service
- **Device:** Phone, one-handed when possible

### Tertiary — Spectator (“Clubhouse Chris”)

- **Who:** Family, sponsors, members following the event
- **Goals:** Live leaderboard on phone or TV display
- **Device:** Phone or clubhouse screen (public URL)

---

## 5. Goals & success metrics

### Business (first 90 days post-launch)

| Metric | Target |
|--------|--------|
| Events published (paid) | 25+ |
| Total registrations processed | 500+ |
| Organizer NPS | ≥ 40 |
| Registration completion rate | ≥ 75% |
| Free → paid conversion (publish event) | ≥ 30% |

### Product

| Metric | Target |
|--------|--------|
| Time to publish first event (new organizer) | < 30 min |
| Median score entry time per group | < 45 sec |
| Leaderboard update latency | < 5 sec |
| Mobile traffic share | ≥ 70% of tournament-day sessions |
| Critical path uptime on tournament days | 99.9% |

---

## 6. MVP scope (v1)

### In scope

| Module | MVP capability |
|--------|----------------|
| **Auth & org** | Email/password or OAuth signup; one organization per account in v1 |
| **Event setup** | Single-day event; name, date, course, format, capacity, entry fee |
| **Formats** | Stroke play + scramble only in v1 (most common for charity/corporate) |
| **Registration** | Public branded event page; player form; Stripe checkout |
| **Payments** | Fixed entry fee via Stripe; confirmation email |
| **Pairings** | Manual pairing into groups (drag-and-drop or assign); tee time optional |
| **Live scoring** | Mobile web score entry per group/hole; real-time leaderboard |
| **Leaderboard** | Public URL; gross scores; mobile-optimized |
| **Organizer dashboard** | Registration list, pairing view, scoring status, basic export (CSV) |
| **Email** | Registration confirmation; optional reminder 24h before event |
| **Billing** | Pay OpenTee platform fee when event goes live (Starter tier) |

### Explicitly out of scope for v1

- Native iOS/Android apps
- SMS notifications
- Sponsor package management
- Donation tracking
- Multi-day events
- Stableford, best ball, match play, custom formats
- Handicap / GHIN integration
- Flights and complex tiebreaker rules
- Waitlist automation
- Early-bird / tiered pricing
- Custom domains / white-label
- API access
- Multi-org / team roles (beyond single owner)
- Offline score sync (design for poor connectivity, but no full offline mode in v1)
- TV/championship display mode (public mobile leaderboard only)

---

## 7. User stories

### Organizer

| ID | Story | Priority |
|----|-------|----------|
| O-1 | As an organizer, I can create an account and set up my organization so I can manage events. | P0 |
| O-2 | As an organizer, I can create a tournament with date, course, format, capacity, and entry fee. | P0 |
| O-3 | As an organizer, I can preview and publish a public registration page. | P0 |
| O-4 | As an organizer, I can see all registrations and payment status in a dashboard. | P0 |
| O-5 | As an organizer, I can manually assign players to groups/tee times. | P0 |
| O-6 | As an organizer, I can open scoring for tournament day and monitor progress. | P0 |
| O-7 | As an organizer, I can export registration data to CSV. | P1 |
| O-8 | As an organizer, I can send a reminder email to registered players. | P1 |
| O-9 | As an organizer, I can comp a player (free entry without payment). | P1 |
| O-10 | As an organizer, I pay OpenTee when I publish my event. | P0 |

### Player

| ID | Story | Priority |
|----|-------|----------|
| P-1 | As a player, I can register via a public link without creating a permanent account. | P0 |
| P-2 | As a player, I can pay my entry fee securely during registration. | P0 |
| P-3 | As a player, I receive email confirmation with event details. | P0 |
| P-4 | As a player, I can view the live leaderboard on my phone. | P0 |

### Scorer

| ID | Story | Priority |
|----|-------|----------|
| S-1 | As a scorer, I can open a scoring link/code and enter scores hole-by-hole on mobile. | P0 |
| S-2 | As a scorer, I see clear validation if a score is missing or invalid. | P0 |
| S-3 | As a scorer, I can correct a score before the round is finalized. | P1 |

---

## 8. Core user flows

### Flow A — Organizer: first event (setup → publish)

```
Sign up → Create org → New event wizard
  → Event details (name, date, course)
  → Format (stroke / scramble)
  → Registration settings (fee, max players)
  → Preview public page
  → Pay platform fee → Event live
  → Share registration link
```

**Acceptance criteria:**
- Wizard completable on mobile (usable, not just possible)
- Draft saved automatically
- Payment required only at publish step (matches “free to build” promise)

### Flow B — Player: registration

```
Open public URL → View event info
  → Enter name, email, optional handicap
  → Pay via Stripe Checkout
  → Confirmation screen + email
```

**Acceptance criteria:**
- ≤ 4 form fields before payment (minimize drop-off)
- Works on iOS Safari and Android Chrome
- Sold-out state shown when at capacity

### Flow C — Tournament day: scoring

```
Organizer opens scoring → Shares scorer link or group codes
  → Scorer selects group → Enters scores per hole (large tap targets)
  → Leaderboard updates → Players/spectators refresh public page
  → Organizer finalizes results
```

**Acceptance criteria:**
- Score entry usable with one hand
- Leaderboard reflects new scores within 5 seconds
- Clear “round complete” state per group

### Flow D — Pairings (pre-event)

```
Organizer views registration list
  → Creates groups (size 4 for scramble, 1–4 for stroke)
  → Assigns tee time (optional text/time field)
  → Saves pairings visible to organizer (player view optional P1)
```

---

## 9. Functional requirements

### 9.1 Authentication & organizations

- Email + password signup and login
- OAuth (Google) — P1, nice for faster onboarding
- Password reset via email
- One organization per user in v1 (name, contact email)
- Session persists on mobile browsers (30-day cookie)

### 9.2 Event management

**Event fields (MVP):**

| Field | Required | Notes |
|-------|----------|-------|
| Name | Yes | e.g. “Pine Valley Charity Classic” |
| Date | Yes | Single day |
| Course name | Yes | Free text in v1; course DB later |
| Format | Yes | `stroke` \| `scramble` |
| Max players | Yes | Starter cap: 72 |
| Entry fee | Yes | USD; $0 allowed for free events |
| Description | No | Rich text optional P1 |
| Logo | No | Pro tier |
| Registration open/close | Yes | Datetime |

**Event states:** `draft` → `published` → `closed` → `archived`

### 9.3 Registration & payments

- Public URL pattern: `opentee.com/e/[slug]`
- Stripe Checkout for entry fees (Stripe Connect for payouts — evaluate in MVP vs v1.1)
- Platform billing: organizer pays OpenTee fee on publish (Stripe)
- Registration record: player name, email, payment status, registered at
- Capacity enforcement — block registration when full
- Refunds: manual via Stripe dashboard in v1 (in-app refunds P2)

### 9.4 Pairings

- Manual assignment only in v1
- Group entity: label (Group 1, Tee 1), optional tee time, list of registrations
- Unassigned players list
- Scramble: exactly 4 players per group (warn if not)
- Stroke: 1–4 players per group

### 9.5 Live scoring

- Scoring access: magic link or short code per event (no scorer account required in v1)
- Hole count: 9 or 18 selectable at event setup
- Stroke play: integer score per player per hole
- Scramble: one team score per hole
- Leaderboard: sort by total score (stroke); team total (scramble)
- Tie display: shared rank in v1 (no tiebreaker logic)
- Finalize: organizer locks scoring; no further edits

### 9.6 Leaderboard (public)

- Public URL: `opentee.com/e/[slug]/leaderboard`
- No login required
- Auto-refresh (polling every 5–10s acceptable in v1)
- Mobile layout: top 10 visible without horizontal scroll
- Show: rank, name/team, thru, total score

### 9.7 Communications

- Transactional email only in v1 (Resend or Postmark)
- Templates: registration confirmation, optional event reminder
- From address: `events@opentee.com` or similar

### 9.8 Organizer dashboard

- Events list (draft / published / past)
- Per-event tabs: Overview | Registrations | Pairings | Scoring | Settings
- Registration table: search by name/email, payment status filter
- CSV export: name, email, payment status, group assignment

---

## 10. Mobile-first UX requirements

These are **non-negotiable** for v1:

| Requirement | Detail |
|-------------|--------|
| Viewport | Design at 390×844 (iPhone) first |
| Touch targets | Minimum 44×44px for all primary actions |
| Score entry | Numeric keypad input; large hole selector |
| Navigation | Bottom nav or sticky primary action on mobile dashboard |
| Typography | 16px minimum body text (prevent iOS zoom on focus) |
| Performance | LCP < 2.5s on 4G for public registration page |
| Browser support | Last 2 versions: iOS Safari, Chrome Android, Chrome/Safari desktop |
| No hover-only UI | All interactions must work without hover |

---

## 11. Data model (MVP sketch)

```
Organization
  id, name, owner_user_id, created_at

User
  id, email, name, password_hash, created_at

Event
  id, org_id, slug, name, date, course_name, format, holes (9|18)
  max_players, entry_fee_cents, status, registration_opens, registration_closes
  platform_paid_at, created_at

Registration
  id, event_id, name, email, handicap (nullable)
  payment_status (pending|paid|comped|refunded)
  stripe_payment_intent_id, group_id (nullable), created_at

Group
  id, event_id, label, tee_time (nullable), sort_order

Score
  id, event_id, group_id, hole_number, strokes
  player_registration_id (stroke) OR null (scramble team score)
  entered_by, created_at, updated_at

Leaderboard (computed view / cache)
  event_id, registration_id | group_id, total_strokes, holes_completed, rank
```

---

## 12. Technical recommendations

Aligned with the existing codebase (Next.js 16, React 19, shadcn, Tailwind v4):

| Layer | Recommendation | Rationale |
|-------|----------------|-----------|
| Framework | Next.js App Router | Already in use; RSC + API routes |
| Database | PostgreSQL via Supabase or Neon | Relational fits event/registration model |
| ORM | Drizzle | Lightweight, TypeScript-first |
| Auth | Clerk or Auth.js v5 | Fast setup; mobile session handling |
| Payments | Stripe Checkout + Billing | Entry fees + platform subscription/per-event |
| Email | Resend | Simple transactional API |
| Realtime | Supabase Realtime or SSE | Leaderboard updates; polling fallback for v1 |
| Hosting | Vercel | Native Next.js deployment |
| File storage | Cloudinary or S3 | Event logos (Pro tier) |

### Suggested route structure

```
/                         Marketing (existing landing page)
/login, /signup           Auth
/dashboard                Organizer home
/dashboard/events/new     Event wizard
/dashboard/events/[id]    Event admin
/e/[slug]                 Public registration
/e/[slug]/leaderboard     Public leaderboard
/e/[slug]/score           Scorer entry (magic link)
```

---

## 13. Phased roadmap

### Phase 1 — MVP (8–12 weeks)

**Goal:** One organizer can run a complete scramble or stroke event end-to-end.

- Auth + org
- Event CRUD + publish + platform billing
- Public registration + Stripe
- Manual pairings
- Mobile score entry
- Public leaderboard
- Confirmation email
- CSV export

**Launch tier:** Starter ($49/event, up to 72 players)

### Phase 2 — Pro (weeks 12–20)

**Goal:** Match Pro tier on landing page.

- Unlimited players
- Custom branding (logo, colors, cover image)
- Sponsor packages (display + revenue tracking)
- Waitlist
- Early-bird pricing
- Group registration
- SMS reminders (Twilio)
- Handicap field + basic net scoring
- Additional formats: Stableford, best ball
- Multi-flight support
- Post-event analytics report

**Launch tier:** Pro ($149/event)

### Phase 3 — Enterprise (weeks 20+)

**Goal:** Multi-event operators and associations.

- Annual billing
- Multiple orgs / team roles (admin, scorer, viewer)
- API access
- White-label / custom domains
- GHIN or handicap index integration
- TV/display mode for clubhouses
- Dedicated support + SLA

---

## 14. Pricing alignment

| Tier | Price | MVP availability |
|------|-------|------------------|
| Starter | $49/event | Phase 1 |
| Pro | $149/event | Phase 2 |
| Enterprise | Custom annual | Phase 3 |

**Free trial (as marketed):** Build and preview events for free; pay when publishing registration.

---

## 15. Legal & compliance (before taking payments)

- [ ] Terms of Service
- [ ] Privacy Policy (player email, payment data)
- [ ] Stripe PCI compliance (use Checkout — no card data on our servers)
- [ ] Refund policy documented on registration page
- [ ] CAN-SPAM compliance for emails
- [ ] Data retention policy for registration records

---

## 16. Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Poor cell service on course | Scorers can’t submit scores | Optimistic UI + retry queue; clear error states |
| Scope creep (too many formats) | Delayed launch | Stroke + scramble only in v1 |
| Stripe Connect complexity | Delayed payouts | Platform collects fees first; manual payout to clubs in v1 if needed |
| Marketing overpromises | User disappointment | Align FAQ/landing with phase; this PRD as source of truth |
| Incumbent switching cost | Slow adoption | Target charity/volunteer organizers underserved by enterprise tools |

---

## 17. Open questions

1. **Primary launch segment:** Charity scrambles vs club member events vs association tournaments?
2. **Payout model:** Does OpenTee hold entry fees and pay out clubs, or do clubs connect their own Stripe?
3. **Player accounts:** Anonymous registration only in v1, or optional “create account to see history”?
4. **Scoring access control:** Open magic link vs per-group PIN?
5. **Comp entries:** Organizer-only in dashboard, or registration code?
6. **Geography:** US-only at launch (USD, US courses)?

---

## 18. Immediate next steps

1. **Answer open questions** in Section 17 (especially payout model and launch segment).
2. **Customer discovery** — 5 interviews with target organizers; validate MVP scope.
3. **Wireframes** — 5 mobile screens: event setup, registration, dashboard, score entry, leaderboard.
4. **Technical setup** — DB, auth, Stripe test mode, deploy landing page with waitlist.
5. **Sprint 1** — Auth + org + event draft CRUD (no payments yet).

---

## Appendix A — Landing page vs MVP honesty check

| Marketing claim | MVP | Phase |
|-----------------|-----|-------|
| Multi-day events | ❌ | Phase 2 |
| All tournament formats | ❌ (stroke + scramble only) | Phase 2 |
| SMS updates | ❌ | Phase 2 |
| Sponsor management | ❌ | Phase 2 |
| Analytics & reports | ❌ (CSV only) | Phase 2 |
| Mobile-first web, no app | ✅ | MVP |
| Online registration & payment | ✅ | MVP |
| Live leaderboard | ✅ | MVP |
| Email notifications | ✅ (confirmation) | MVP |
| Free to build, pay to publish | ✅ | MVP |

Consider softening landing copy for features marked ❌ until Phase 2, or label them “Coming soon.”

---

## Appendix B — MVP sprint breakdown (suggested)

| Sprint | Focus | Deliverable |
|--------|-------|-------------|
| 1 (2 wk) | Foundation | Auth, org, DB schema, event draft CRUD |
| 2 (2 wk) | Registration | Public event page, Stripe Checkout, confirmation email |
| 3 (2 wk) | Tournament ops | Pairings UI, registration dashboard, CSV export |
| 4 (2 wk) | Scoring | Mobile score entry, leaderboard, realtime updates |
| 5 (2 wk) | Polish & launch | Platform billing, QA on mobile, bug fixes, deploy |

---

*This document is the source of truth for MVP scope. Update version and changelog when scope changes.*
