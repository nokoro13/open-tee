ALTER TABLE "events" ADD COLUMN "registration_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "pairings_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "scorecards_ready_at" timestamp with time zone;