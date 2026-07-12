ALTER TABLE "characters"
  ADD COLUMN IF NOT EXISTS "highest_ability_score" integer;

ALTER TABLE "characters"
  DROP CONSTRAINT IF EXISTS "characters_highest_ability_score_check";

ALTER TABLE "characters"
  ADD CONSTRAINT "characters_highest_ability_score_check"
  CHECK ("highest_ability_score" IS NULL OR "highest_ability_score" BETWEEN 1 AND 30);