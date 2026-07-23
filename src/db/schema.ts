import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
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

export const platformTierEnum = pgEnum("platform_tier", ["starter", "pro"]);

export const golfCourseStatusEnum = pgEnum("golf_course_status", [
  "draft",
  "published",
]);

export const golfDataQualityEnum = pgEnum("golf_data_quality", [
  "geometry_only",
  "geometry_targets",
  "full",
]);

export const holeFeatureTypeEnum = pgEnum("hole_feature_type", [
  "green",
  "tee",
  "fairway",
  "hole_line",
  "bunker",
  "water",
  "rough",
  "out_of_bounds",
  "cartpath",
  "scrub",
  "tree",
]);

export const featureSourceEnum = pgEnum("feature_source", [
  "overpass",
  "manual",
]);

export const greenTargetTypeEnum = pgEnum("green_target_type", [
  "front",
  "middle",
  "back",
]);

export const targetComputedFromEnum = pgEnum("target_computed_from", [
  "polygon_centroid",
  "polygon_perimeter",
  "manual",
]);

export const mappingRequestStatusEnum = pgEnum("mapping_request_status", [
  "pending",
  "draft_ready",
  "published",
  "rejected",
]);

export const courseOnboardingStatusEnum = pgEnum("course_onboarding_status", [
  "draft",
  "scorecard",
  "mapping",
  "submitted",
  "verified",
  "rejected",
]);

export const courseAccessRoleEnum = pgEnum("course_access_role", [
  "course_admin",
  "course_editor",
]);

export const courseAccessStatusEnum = pgEnum("course_access_status", [
  "pending",
  "active",
  "revoked",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerClerkId: text("owner_clerk_id").notNull().unique(),
  contactEmail: text("contact_email"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status"),
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end", {
    withTimezone: true,
  }),
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
  courseAddress: text("course_address"),
  courseCity: text("course_city"),
  courseState: text("course_state"),
  coursePhone: text("course_phone"),
  courseWebsite: text("course_website"),
  selectedTeeKey: text("selected_tee_key"),
  teeName: text("tee_name"),
  courseRating: text("course_rating"),
  courseSlope: integer("course_slope"),
  courseTotalYardage: integer("course_total_yardage"),
  nineSide: nineSideEnum("nine_side"),
  format: eventFormatEnum("format").notNull().default("scramble"),
  holes: holesEnum("holes").notNull().default("18"),
  maxPlayers: integer("max_players").notNull().default(72),
  entryFeeCents: integer("entry_fee_cents").notNull().default(0),
  platformTier: platformTierEnum("platform_tier").notNull().default("starter"),
  logoUrl: text("logo_url"),
  coverImageUrl: text("cover_image_url"),
  primaryColor: text("primary_color"),
  accentColor: text("accent_color"),
  waitlistEnabled: boolean("waitlist_enabled").notNull().default(false),
  groupRegistrationEnabled: boolean("group_registration_enabled")
    .notNull()
    .default(false),
  maxGroupSize: integer("max_group_size").notNull().default(4),
  smsRemindersEnabled: boolean("sms_reminders_enabled").notNull().default(false),
  earlyBirdFeeCents: integer("early_bird_fee_cents"),
  earlyBirdEndsAt: timestamp("early_bird_ends_at", { withTimezone: true }),
  status: eventStatusEnum("status").notNull().default("draft"),
  description: text("description"),
  registrationOpens: timestamp("registration_opens", { withTimezone: true }),
  registrationCloses: timestamp("registration_closes", { withTimezone: true }),
  registrationFinalizedAt: timestamp("registration_finalized_at", {
    withTimezone: true,
  }),
  pairingsFinalizedAt: timestamp("pairings_finalized_at", { withTimezone: true }),
  scorecardsReadyAt: timestamp("scorecards_ready_at", { withTimezone: true }),
  platformPaidAt: timestamp("platform_paid_at", { withTimezone: true }),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  smsReminderSentAt: timestamp("sms_reminder_sent_at", { withTimezone: true }),
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

export const flights = pgTable(
  "flights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("flights_event_name_idx").on(table.eventId, table.name),
  ]
);

export const registrationGroups = pgTable("registration_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  leaderName: text("leader_name").notNull(),
  leaderEmail: text("leader_email").notNull(),
  paymentStatus: paymentStatusEnum("payment_status")
    .notNull()
    .default("pending"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sponsorPackages = pgTable("sponsor_packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull().default(0),
  logoUrl: text("logo_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sponsorPurchases = pgTable("sponsor_purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  packageId: uuid("package_id")
    .notNull()
    .references(() => sponsorPackages.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  amountCents: integer("amount_cents").notNull(),
  paymentStatus: paymentStatusEnum("payment_status")
    .notNull()
    .default("pending"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("waitlist_event_email_idx").on(table.eventId, table.email),
  ]
);

export const pairingGroups = pgTable("pairing_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  flightId: uuid("flight_id").references(() => flights.id, {
    onDelete: "set null",
  }),
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
    registrationGroupId: uuid("registration_group_id").references(
      () => registrationGroups.id,
      { onDelete: "set null" }
    ),
    flightId: uuid("flight_id").references(() => flights.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    smsOptIn: boolean("sms_opt_in").notNull().default(false),
    handicap: text("handicap"),
    entryFeePaidCents: integer("entry_fee_paid_cents"),
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

export const golfCourses = pgTable(
  "golf_courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    externalCourseId: text("external_course_id"),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    country: text("country").notNull().default("US"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    holeCount: integer("hole_count").notNull().default(18),
    status: golfCourseStatusEnum("status").notNull().default("draft"),
    onboardingStatus: courseOnboardingStatusEnum("onboarding_status")
      .notNull()
      .default("draft"),
    dataQuality: golfDataQualityEnum("data_quality")
      .notNull()
      .default("geometry_only"),
    mappedHoleCount: integer("mapped_hole_count").notNull().default(0),
    scorecardImageUrl: text("scorecard_image_url"),
    reviewNotes: text("review_notes"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedByClerkId: text("verified_by_clerk_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("golf_courses_external_course_idx").on(table.externalCourseId),
  ]
);

export const courseAccess = pgTable(
  "course_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => golfCourses.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id"),
    inviteEmail: text("invite_email"),
    role: courseAccessRoleEnum("role").notNull().default("course_admin"),
    status: courseAccessStatusEnum("status").notNull().default("pending"),
    invitedByClerkId: text("invited_by_clerk_id").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("course_access_course_user_idx").on(
      table.courseId,
      table.clerkUserId
    ),
    uniqueIndex("course_access_course_email_idx").on(
      table.courseId,
      table.inviteEmail
    ),
  ]
);

export const courseTees = pgTable(
  "course_tees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => golfCourses.id, { onDelete: "cascade" }),
    teeKey: text("tee_key").notNull(),
    teeName: text("tee_name").notNull(),
    teeColor: text("tee_color"),
    sortOrder: integer("sort_order").notNull().default(0),
    courseRating: text("course_rating"),
    slope: integer("slope"),
    totalYardage: integer("total_yardage"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("course_tees_course_key_idx").on(table.courseId, table.teeKey),
  ]
);

export const courseHoles = pgTable(
  "course_holes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => golfCourses.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    par: integer("par").notNull(),
    yardage: integer("yardage"),
    teeYardages: jsonb("tee_yardages").$type<Record<string, number>>(),
    strokeIndex: integer("stroke_index"),
    ladiesStrokeIndex: integer("ladies_stroke_index"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("course_holes_course_hole_idx").on(table.courseId, table.holeNumber),
  ]
);

export const holeFeatures = pgTable(
  "hole_features",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => golfCourses.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    featureType: holeFeatureTypeEnum("feature_type").notNull(),
    geometry: jsonb("geometry").notNull(),
    osmId: text("osm_id"),
    source: featureSourceEnum("source").notNull().default("overpass"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("hole_features_course_osm_id_idx").on(table.courseId, table.osmId),
  ]
);

export const greenTargets = pgTable(
  "green_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => golfCourses.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    targetType: greenTargetTypeEnum("target_type").notNull(),
    latitude: text("latitude").notNull(),
    longitude: text("longitude").notNull(),
    computedFrom: targetComputedFromEnum("computed_from")
      .notNull()
      .default("polygon_perimeter"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("green_targets_course_hole_type_idx").on(
      table.courseId,
      table.holeNumber,
      table.targetType
    ),
  ]
);

export const greenElevationGrids = pgTable(
  "green_elevation_grids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => golfCourses.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    gridWidth: integer("grid_width").notNull(),
    gridHeight: integer("grid_height").notNull(),
    boundsGeoJson: jsonb("bounds_geo_json").notNull(),
    elevationData: jsonb("elevation_data").notNull(),
    slopeData: jsonb("slope_data").notNull(),
    resolutionM: text("resolution_m"),
    source: text("source").notNull().default("open_meteo"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("green_elevation_grids_course_hole_idx").on(
      table.courseId,
      table.holeNumber
    ),
  ]
);

export const mappingRequests = pgTable("mapping_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => golfCourses.id, { onDelete: "cascade" }),
  externalCourseId: text("external_course_id"),
  courseName: text("course_name").notNull(),
  status: mappingRequestStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  events: many(events),
  golfCourses: many(golfCourses),
  mappingRequests: many(mappingRequests),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [events.orgId],
    references: [organizations.id],
  }),
  registrations: many(registrations),
  registrationGroups: many(registrationGroups),
  pairingGroups: many(pairingGroups),
  flights: many(flights),
  sponsorPackages: many(sponsorPackages),
  sponsorPurchases: many(sponsorPurchases),
  waitlistEntries: many(waitlistEntries),
  holeScores: many(holeScores),
  eventHoles: many(eventHoles),
  mappingRequests: many(mappingRequests),
}));

export const flightsRelations = relations(flights, ({ one, many }) => ({
  event: one(events, {
    fields: [flights.eventId],
    references: [events.id],
  }),
  registrations: many(registrations),
  pairingGroups: many(pairingGroups),
}));

export const registrationGroupsRelations = relations(
  registrationGroups,
  ({ one, many }) => ({
    event: one(events, {
      fields: [registrationGroups.eventId],
      references: [events.id],
    }),
    registrations: many(registrations),
  })
);

export const sponsorPackagesRelations = relations(
  sponsorPackages,
  ({ one, many }) => ({
    event: one(events, {
      fields: [sponsorPackages.eventId],
      references: [events.id],
    }),
    purchases: many(sponsorPurchases),
  })
);

export const sponsorPurchasesRelations = relations(
  sponsorPurchases,
  ({ one }) => ({
    event: one(events, {
      fields: [sponsorPurchases.eventId],
      references: [events.id],
    }),
    package: one(sponsorPackages, {
      fields: [sponsorPurchases.packageId],
      references: [sponsorPackages.id],
    }),
  })
);

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  event: one(events, {
    fields: [waitlistEntries.eventId],
    references: [events.id],
  }),
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
  flight: one(flights, {
    fields: [pairingGroups.flightId],
    references: [flights.id],
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
  registrationGroup: one(registrationGroups, {
    fields: [registrations.registrationGroupId],
    references: [registrationGroups.id],
  }),
  flight: one(flights, {
    fields: [registrations.flightId],
    references: [flights.id],
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
export type Flight = typeof flights.$inferSelect;
export type RegistrationGroup = typeof registrationGroups.$inferSelect;
export type SponsorPackage = typeof sponsorPackages.$inferSelect;
export type SponsorPurchase = typeof sponsorPurchases.$inferSelect;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type PairingGroup = typeof pairingGroups.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type HoleScore = typeof holeScores.$inferSelect;
export type EventHole = typeof eventHoles.$inferSelect;
export type GolfCourse = typeof golfCourses.$inferSelect;
export type CourseHole = typeof courseHoles.$inferSelect;
export type CourseTee = typeof courseTees.$inferSelect;
export type HoleFeature = typeof holeFeatures.$inferSelect;
export type GreenTarget = typeof greenTargets.$inferSelect;
export type GreenElevationGrid = typeof greenElevationGrids.$inferSelect;
export type MappingRequest = typeof mappingRequests.$inferSelect;
export type CourseAccess = typeof courseAccess.$inferSelect;

export const golfCoursesRelations = relations(golfCourses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [golfCourses.orgId],
    references: [organizations.id],
  }),
  courseHoles: many(courseHoles),
  courseTees: many(courseTees),
  holeFeatures: many(holeFeatures),
  greenTargets: many(greenTargets),
  greenElevationGrids: many(greenElevationGrids),
  mappingRequests: many(mappingRequests),
  courseAccess: many(courseAccess),
}));

export const courseAccessRelations = relations(courseAccess, ({ one }) => ({
  course: one(golfCourses, {
    fields: [courseAccess.courseId],
    references: [golfCourses.id],
  }),
}));

export const courseHolesRelations = relations(courseHoles, ({ one }) => ({
  course: one(golfCourses, {
    fields: [courseHoles.courseId],
    references: [golfCourses.id],
  }),
}));

export const courseTeesRelations = relations(courseTees, ({ one }) => ({
  course: one(golfCourses, {
    fields: [courseTees.courseId],
    references: [golfCourses.id],
  }),
}));

export const holeFeaturesRelations = relations(holeFeatures, ({ one }) => ({
  course: one(golfCourses, {
    fields: [holeFeatures.courseId],
    references: [golfCourses.id],
  }),
}));

export const greenTargetsRelations = relations(greenTargets, ({ one }) => ({
  course: one(golfCourses, {
    fields: [greenTargets.courseId],
    references: [golfCourses.id],
  }),
}));

export const greenElevationGridsRelations = relations(
  greenElevationGrids,
  ({ one }) => ({
    course: one(golfCourses, {
      fields: [greenElevationGrids.courseId],
      references: [golfCourses.id],
    }),
  })
);

export const mappingRequestsRelations = relations(mappingRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [mappingRequests.orgId],
    references: [organizations.id],
  }),
  event: one(events, {
    fields: [mappingRequests.eventId],
    references: [events.id],
  }),
  course: one(golfCourses, {
    fields: [mappingRequests.courseId],
    references: [golfCourses.id],
  }),
}));
