ALTER TABLE "spiritual_instruments"
  ADD COLUMN IF NOT EXISTS "expanded_content" text;
--> statement-breakpoint
ALTER TABLE "spiritual_instruments"
  ADD COLUMN IF NOT EXISTS "has_expanded_content" boolean DEFAULT false NOT NULL;
