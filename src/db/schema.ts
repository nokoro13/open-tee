import { relations } from "drizzle-orm";
import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "closed",
  "archived",
]);

export const eventFormatEnum = pgEnum("event_format", [
  "stroke",
  "scramble",
  "best_ball",
  "match_play",
  "head_to_head",
  "ryder_cup",
  "stableford",
  "alternate_shot",
  "shamble",
]);

export const holesEnum = pgEnum("holes", ["9", "18"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "comped",
  "refunded",
]);

export const scoringStatusEnum = pgEnum("scoring_status", [
  "disabled",
  "open",
  "finalized",
]);

export const teamSideEnum = pgEnum("team_side", ["a", "b", "team"]);

export const ryderMatchTypeEnum = pgEnum("ryder_match_type", [
  "singles",
  "fourball",
  "foursomes",
]);

export const nineSideEnum = pgEnum("nine_side", ["front", "back"]);

export const startFormatEnum = pgEnum("start_format", ["shotgun", "tee_times"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerClerkId: text("owner_clerk_id").notNull().unique(),
  contactEmail: text("contact_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  courseName: text("course_name").notNull(),
  externalCourseId: text("external_course_id"),
  nineSide: nineSideEnum("nine_side"),
  format: eventFormatEnum("format").notNull().default("scramble"),
  holes: holesEnum("holes").notNull().default("18"),
  maxPlayers: integer("max_players").notNull().default(72),
  entryFeeCents: integer("entry_fee_cents").notNull().default(0),
  status: eventStatusEnum("status").notNull().default("draft"),
  description: text("description"),
  registrationOpens: timestamp("registration_opens", { withTimezone: true }),
  registrationCloses: timestamp("registration_closes", { withTimezone: true }),
  platformPaidAt: timestamp("platform_paid_at", { withTimezone: true }),
  stripePlatformSessionId: text("stripe_platform_session_id"),
  scoringStatus: scoringStatusEnum("scoring_status").notNull().default("disabled"),
  scoringCode: text("scoring_code"),
  scoringFinalizedAt: timestamp("scoring_finalized_at", { withTimezone: true }),
  teamAName: text("team_a_name"),
  teamBName: text("team_b_name"),
  startFormat: startFormatEnum("start_format").notNull().default("tee_times"),
  shotgunStartTime: text("shotgun_start_time"),
  firstTeeTime: text("first_tee_time"),
  teeTimeIntervalMinutes: integer("tee_time_interval_minutes").default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const eventHoles = pgTable(
  "event_holes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    par: integer("par").notNull(),
    yardage: integer("yardage"),
    strokeIndex: integer("stroke_index"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_holes_event_hole_idx").on(table.eventId, table.holeNumber),
  ]
);

export const pairingGroups = pgTable("pairing_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  teeTime: text("tee_time"),
  startingHole: integer("starting_hole"),
  matchType: ryderMatchTypeEnum("match_type"),
  scoringCode: text("scoring_code"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    pairingGroupId: uuid("pairing_group_id").references(() => pairingGroups.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    handicap: text("handicap"),
    teamSide: teamSideEnum("team_side"),
    scoringCode: text("scoring_code"),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("pending"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("registrations_event_email_idx").on(table.eventId, table.email),
  ]
);

export const holeScores = pgTable(
  "hole_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    registrationId: uuid("registration_id").references(() => registrations.id, {
      onDelete: "cascade",
    }),
    pairingGroupId: uuid("pairing_group_id").references(() => pairingGroups.id, {
      onDelete: "cascade",
    }),
    teamSide: teamSideEnum("team_side"),
    strokes: integer("strokes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("hole_scores_event_hole_registration_idx").on(
      table.eventId,
      table.holeNumber,
      table.registrationId
    ),
    uniqueIndex("hole_scores_event_hole_group_idx").on(
      table.eventId,
      table.holeNumber,
      table.pairingGroupId,
      table.teamSide
    ),
  ]
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [events.orgId],
    references: [organizations.id],
  }),
  registrations: many(registrations),
  pairingGroups: many(pairingGroups),
  holeScores: many(holeScores),
  eventHoles: many(eventHoles),
}));

export const eventHolesRelations = relations(eventHoles, ({ one }) => ({
  event: one(events, {
    fields: [eventHoles.eventId],
    references: [events.id],
  }),
}));

export const pairingGroupsRelations = relations(pairingGroups, ({ one, many }) => ({
  event: one(events, {
    fields: [pairingGroups.eventId],
    references: [events.id],
  }),
  registrations: many(registrations),
}));

export const registrationsRelations = relations(registrations, ({ one, many }) => ({
  event: one(events, {
    fields: [registrations.eventId],
    references: [events.id],
  }),
  pairingGroup: one(pairingGroups, {
    fields: [registrations.pairingGroupId],
    references: [pairingGroups.id],
  }),
  holeScores: many(holeScores),
}));

export const holeScoresRelations = relations(holeScores, ({ one }) => ({
  event: one(events, {
    fields: [holeScores.eventId],
    references: [events.id],
  }),
  registration: one(registrations, {
    fields: [holeScores.registrationId],
    references: [registrations.id],
  }),
  pairingGroup: one(pairingGroups, {
    fields: [holeScores.pairingGroupId],
    references: [pairingGroups.id],
  }),
}));

export type Organization = typeof organizations.$inferSelect;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type PairingGroup = typeof pairingGroups.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type HoleScore = typeof holeScores.$inferSelect;
export type EventHole = typeof eventHoles.$inferSelect;
