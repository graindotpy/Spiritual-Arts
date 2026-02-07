ALTER TABLE "characters"
  ADD COLUMN IF NOT EXISTS "is_dm_only" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "characters"
  ADD COLUMN IF NOT EXISTS "dm_owner_id" varchar;
