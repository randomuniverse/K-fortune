DO $$ BEGIN
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "link_token" text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_link_token_unique" UNIQUE("link_token");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
