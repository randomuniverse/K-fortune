CREATE TABLE IF NOT EXISTS "fortunes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" serial NOT NULL,
	"content" text NOT NULL,
	"fortune_data" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guardian_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"core_energy" text NOT NULL,
	"coherence_score" integer NOT NULL,
	"keywords" text[],
	"past_inference" text,
	"current_state" text NOT NULL,
	"bottleneck" text NOT NULL,
	"solution" text NOT NULL,
	"business_advice" text,
	"love_advice" text,
	"health_advice" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" text NOT NULL,
	"telegram_chat_id" text,
	"telegram_handle" text,
	"link_token" text,
	"name" text NOT NULL,
	"birth_date" text NOT NULL,
	"birth_time" text NOT NULL,
	"gender" text NOT NULL,
	"mbti" text,
	"birth_country" text,
	"birth_city" text,
	"preferred_delivery_time" text DEFAULT '07:00' NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id"),
	CONSTRAINT "users_link_token_unique" UNIQUE("link_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "yearly_fortunes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"year" integer NOT NULL,
	"overall_summary" text NOT NULL,
	"coherence_score" integer NOT NULL,
	"business_fortune" text,
	"love_fortune" text,
	"health_fortune" text,
	"monthly_flow" jsonb,
	"keywords" text[],
	"saju_monthly_flow" jsonb,
	"saju_summary" text,
	"ziwei_monthly_flow" jsonb,
	"ziwei_summary" text,
	"zodiac_monthly_flow" jsonb,
	"zodiac_summary" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fortunes" ADD CONSTRAINT "fortunes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
