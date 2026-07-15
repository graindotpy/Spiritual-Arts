ALTER TABLE "spiritual_instruments"
  ADD COLUMN IF NOT EXISTS "actions" jsonb DEFAULT '[]'::jsonb NOT NULL;
