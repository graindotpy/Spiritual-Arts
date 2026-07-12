CREATE TABLE IF NOT EXISTS "spiritual_instruments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "image_url" text,
  "is_revealed" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spiritual_instrument_assignments" (
  "instrument_id" varchar NOT NULL REFERENCES "spiritual_instruments"("id") ON DELETE CASCADE,
  "character_id" varchar NOT NULL REFERENCES "characters"("id") ON DELETE CASCADE,
  CONSTRAINT "instrument_character_unique" UNIQUE("instrument_id", "character_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "instrument_assignments_character_idx"
  ON "spiritual_instrument_assignments" ("character_id");
