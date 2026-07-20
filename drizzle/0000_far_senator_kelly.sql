CREATE TYPE "public"."course_access_role" AS ENUM('course_admin', 'course_editor');--> statement-breakpoint
CREATE TYPE "public"."course_access_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."course_onboarding_status" AS ENUM('draft', 'scorecard', 'mapping', 'submitted', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."event_format" AS ENUM('stroke', 'scramble', 'best_ball', 'match_play', 'head_to_head', 'ryder_cup', 'stableford', 'alternate_shot', 'shamble');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."feature_source" AS ENUM('overpass', 'manual');--> statement-breakpoint
CREATE TYPE "public"."golf_course_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."golf_data_quality" AS ENUM('geometry_only', 'geometry_targets', 'full');--> statement-breakpoint
CREATE TYPE "public"."green_target_type" AS ENUM('front', 'middle', 'back');--> statement-breakpoint
CREATE TYPE "public"."hole_feature_type" AS ENUM('green', 'tee', 'fairway', 'hole_line', 'bunker', 'water', 'rough', 'out_of_bounds', 'cartpath', 'scrub', 'tree');--> statement-breakpoint
CREATE TYPE "public"."holes" AS ENUM('9', '18');--> statement-breakpoint
CREATE TYPE "public"."mapping_request_status" AS ENUM('pending', 'draft_ready', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."nine_side" AS ENUM('front', 'back');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'comped', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."ryder_match_type" AS ENUM('singles', 'fourball', 'foursomes');--> statement-breakpoint
CREATE TYPE "public"."scoring_status" AS ENUM('disabled', 'open', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."start_format" AS ENUM('shotgun', 'tee_times');--> statement-breakpoint
CREATE TYPE "public"."target_computed_from" AS ENUM('polygon_centroid', 'polygon_perimeter', 'manual');--> statement-breakpoint
CREATE TYPE "public"."team_side" AS ENUM('a', 'b', 'team');--> statement-breakpoint
CREATE TABLE "course_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"clerk_user_id" text,
	"invite_email" text,
	"role" "course_access_role" DEFAULT 'course_admin' NOT NULL,
	"status" "course_access_status" DEFAULT 'pending' NOT NULL,
	"invited_by_clerk_id" text NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_holes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"par" integer NOT NULL,
	"yardage" integer,
	"tee_yardages" jsonb,
	"stroke_index" integer,
	"ladies_stroke_index" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_tees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"tee_key" text NOT NULL,
	"tee_name" text NOT NULL,
	"tee_color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"course_rating" text,
	"slope" integer,
	"total_yardage" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_holes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"par" integer NOT NULL,
	"yardage" integer,
	"stroke_index" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"course_name" text NOT NULL,
	"external_course_id" text,
	"course_address" text,
	"course_city" text,
	"course_state" text,
	"course_phone" text,
	"course_website" text,
	"selected_tee_key" text,
	"tee_name" text,
	"course_rating" text,
	"course_slope" integer,
	"course_total_yardage" integer,
	"nine_side" "nine_side",
	"format" "event_format" DEFAULT 'scramble' NOT NULL,
	"holes" "holes" DEFAULT '18' NOT NULL,
	"max_players" integer DEFAULT 72 NOT NULL,
	"entry_fee_cents" integer DEFAULT 0 NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	"registration_opens" timestamp with time zone,
	"registration_closes" timestamp with time zone,
	"platform_paid_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"stripe_platform_session_id" text,
	"scoring_status" "scoring_status" DEFAULT 'disabled' NOT NULL,
	"scoring_code" text,
	"scoring_finalized_at" timestamp with time zone,
	"team_a_name" text,
	"team_b_name" text,
	"start_format" "start_format" DEFAULT 'tee_times' NOT NULL,
	"shotgun_start_time" text,
	"first_tee_time" text,
	"tee_time_interval_minutes" integer DEFAULT 10,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "golf_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"external_course_id" text,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"country" text DEFAULT 'US' NOT NULL,
	"latitude" text,
	"longitude" text,
	"hole_count" integer DEFAULT 18 NOT NULL,
	"status" "golf_course_status" DEFAULT 'draft' NOT NULL,
	"onboarding_status" "course_onboarding_status" DEFAULT 'draft' NOT NULL,
	"data_quality" "golf_data_quality" DEFAULT 'geometry_only' NOT NULL,
	"mapped_hole_count" integer DEFAULT 0 NOT NULL,
	"scorecard_image_url" text,
	"review_notes" text,
	"submitted_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verified_by_clerk_id" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "green_elevation_grids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"grid_width" integer NOT NULL,
	"grid_height" integer NOT NULL,
	"bounds_geo_json" jsonb NOT NULL,
	"elevation_data" jsonb NOT NULL,
	"slope_data" jsonb NOT NULL,
	"resolution_m" text,
	"source" text DEFAULT 'open_meteo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "green_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"target_type" "green_target_type" NOT NULL,
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"computed_from" "target_computed_from" DEFAULT 'polygon_perimeter' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hole_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"feature_type" "hole_feature_type" NOT NULL,
	"geometry" jsonb NOT NULL,
	"osm_id" text,
	"source" "feature_source" DEFAULT 'overpass' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hole_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"hole_number" integer NOT NULL,
	"registration_id" uuid,
	"pairing_group_id" uuid,
	"team_side" "team_side",
	"strokes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"external_course_id" text,
	"course_name" text NOT NULL,
	"status" "mapping_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_clerk_id" text NOT NULL,
	"contact_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_owner_clerk_id_unique" UNIQUE("owner_clerk_id")
);
--> statement-breakpoint
CREATE TABLE "pairing_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"tee_time" text,
	"starting_hole" integer,
	"match_type" "ryder_match_type",
	"scoring_code" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"pairing_group_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"handicap" text,
	"team_side" "team_side",
	"scoring_code" text,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_course_id_golf_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."golf_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_holes" ADD CONSTRAINT "course_holes_course_id_golf_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."golf_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_tees" ADD CONSTRAINT "course_tees_course_id_golf_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."golf_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_holes" ADD CONSTRAINT "event_holes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golf_courses" ADD CONSTRAINT "golf_courses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "green_elevation_grids" ADD CONSTRAINT "green_elevation_grids_course_id_golf_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."golf_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "green_targets" ADD CONSTRAINT "green_targets_course_id_golf_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."golf_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hole_features" ADD CONSTRAINT "hole_features_course_id_golf_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."golf_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hole_scores" ADD CONSTRAINT "hole_scores_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hole_scores" ADD CONSTRAINT "hole_scores_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hole_scores" ADD CONSTRAINT "hole_scores_pairing_group_id_pairing_groups_id_fk" FOREIGN KEY ("pairing_group_id") REFERENCES "public"."pairing_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_requests" ADD CONSTRAINT "mapping_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_requests" ADD CONSTRAINT "mapping_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_requests" ADD CONSTRAINT "mapping_requests_course_id_golf_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."golf_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_groups" ADD CONSTRAINT "pairing_groups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_pairing_group_id_pairing_groups_id_fk" FOREIGN KEY ("pairing_group_id") REFERENCES "public"."pairing_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_access_course_user_idx" ON "course_access" USING btree ("course_id","clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_access_course_email_idx" ON "course_access" USING btree ("course_id","invite_email");--> statement-breakpoint
CREATE UNIQUE INDEX "course_holes_course_hole_idx" ON "course_holes" USING btree ("course_id","hole_number");--> statement-breakpoint
CREATE UNIQUE INDEX "course_tees_course_key_idx" ON "course_tees" USING btree ("course_id","tee_key");--> statement-breakpoint
CREATE UNIQUE INDEX "event_holes_event_hole_idx" ON "event_holes" USING btree ("event_id","hole_number");--> statement-breakpoint
CREATE UNIQUE INDEX "golf_courses_external_course_idx" ON "golf_courses" USING btree ("external_course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "green_elevation_grids_course_hole_idx" ON "green_elevation_grids" USING btree ("course_id","hole_number");--> statement-breakpoint
CREATE UNIQUE INDEX "green_targets_course_hole_type_idx" ON "green_targets" USING btree ("course_id","hole_number","target_type");--> statement-breakpoint
CREATE UNIQUE INDEX "hole_features_course_osm_id_idx" ON "hole_features" USING btree ("course_id","osm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hole_scores_event_hole_registration_idx" ON "hole_scores" USING btree ("event_id","hole_number","registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hole_scores_event_hole_group_idx" ON "hole_scores" USING btree ("event_id","hole_number","pairing_group_id","team_side");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_event_email_idx" ON "registrations" USING btree ("event_id","email");