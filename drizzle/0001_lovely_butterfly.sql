CREATE TYPE "public"."platform_tier" AS ENUM('starter', 'pro');--> statement-breakpoint
CREATE TABLE "flights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"leader_name" text NOT NULL,
	"leader_email" text NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"logo_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "platform_tier" "platform_tier" DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "primary_color" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "accent_color" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "waitlist_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "group_registration_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "max_group_size" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "sms_reminders_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "early_bird_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "early_bird_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "sms_reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pairing_groups" ADD COLUMN "flight_id" uuid;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "registration_group_id" uuid;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "flight_id" uuid;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "sms_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "entry_fee_paid_cents" integer;--> statement-breakpoint
ALTER TABLE "flights" ADD CONSTRAINT "flights_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_groups" ADD CONSTRAINT "registration_groups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_packages" ADD CONSTRAINT "sponsor_packages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_purchases" ADD CONSTRAINT "sponsor_purchases_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_purchases" ADD CONSTRAINT "sponsor_purchases_package_id_sponsor_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."sponsor_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "flights_event_name_idx" ON "flights" USING btree ("event_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_event_email_idx" ON "waitlist_entries" USING btree ("event_id","email");--> statement-breakpoint
ALTER TABLE "pairing_groups" ADD CONSTRAINT "pairing_groups_flight_id_flights_id_fk" FOREIGN KEY ("flight_id") REFERENCES "public"."flights"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_registration_group_id_registration_groups_id_fk" FOREIGN KEY ("registration_group_id") REFERENCES "public"."registration_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_flight_id_flights_id_fk" FOREIGN KEY ("flight_id") REFERENCES "public"."flights"("id") ON DELETE set null ON UPDATE no action;