-- Bring databases created by the historical migrations in line with
-- shared/schema.ts without rewriting already-applied migration history.

-- DatabaseStorage reads the lexicographically first pool when legacy data
-- contains duplicates, so retain that same row before installing the unique
-- constraint. Re-running this statement is harmless.
DELETE FROM "spirit_die_pools" AS duplicate
USING "spirit_die_pools" AS canonical
WHERE duplicate."character_id" = canonical."character_id"
  AND duplicate."id" > canonical."id";
--> statement-breakpoint

-- A deployment may already have received the unique index through
-- `drizzle-kit push`. Attach it when possible; otherwise create the named
-- unique constraint directly.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.spirit_die_pools'::regclass
      AND conname = 'spirit_die_pool_character_unique'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_class AS index_relation
      JOIN pg_namespace AS index_namespace
        ON index_namespace.oid = index_relation.relnamespace
      JOIN pg_index AS index_metadata
        ON index_metadata.indexrelid = index_relation.oid
      WHERE index_namespace.nspname = 'public'
        AND index_relation.relname = 'spirit_die_pool_character_unique'
        AND index_metadata.indrelid = 'public.spirit_die_pools'::regclass
        AND index_metadata.indisunique
    ) THEN
      ALTER TABLE "spirit_die_pools"
        ADD CONSTRAINT "spirit_die_pool_character_unique"
        UNIQUE USING INDEX "spirit_die_pool_character_unique";
    ELSIF EXISTS (
      SELECT 1
      FROM pg_class AS index_relation
      JOIN pg_namespace AS index_namespace
        ON index_namespace.oid = index_relation.relnamespace
      WHERE index_namespace.nspname = 'public'
        AND index_relation.relname = 'spirit_die_pool_character_unique'
    ) THEN
      RAISE EXCEPTION
        'Index spirit_die_pool_character_unique exists but is not a usable unique index';
    ELSE
      ALTER TABLE "spirit_die_pools"
        ADD CONSTRAINT "spirit_die_pool_character_unique"
        UNIQUE ("character_id");
    END IF;
  END IF;
END
$migration$;
--> statement-breakpoint

-- These columns were nullable in 0000 but are non-nullable in the current
-- application schema. Preserve legacy rows using their existing defaults.
UPDATE "active_effects"
SET "level" = 1
WHERE "level" IS NULL;
--> statement-breakpoint
ALTER TABLE "active_effects"
  ALTER COLUMN "level" SET NOT NULL;
--> statement-breakpoint
UPDATE "trackers"
SET "current_value" = 0
WHERE "current_value" IS NULL;
--> statement-breakpoint
ALTER TABLE "trackers"
  ALTER COLUMN "current_value" SET NOT NULL;
--> statement-breakpoint

-- Add missing foreign keys as NOT VALID first. PostgreSQL still enforces a
-- NOT VALID foreign key for every new or changed row, while an unexpected
-- orphan in legacy data cannot make this deployment fail.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.spirit_die_pools'::regclass
      AND conname = 'spirit_die_pools_character_id_characters_id_fk'
  ) THEN
    ALTER TABLE "spirit_die_pools"
      ADD CONSTRAINT "spirit_die_pools_character_id_characters_id_fk"
      FOREIGN KEY ("character_id") REFERENCES "characters" ("id")
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.techniques'::regclass
      AND conname = 'techniques_character_id_characters_id_fk'
  ) THEN
    ALTER TABLE "techniques"
      ADD CONSTRAINT "techniques_character_id_characters_id_fk"
      FOREIGN KEY ("character_id") REFERENCES "characters" ("id")
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.glossary_terms'::regclass
      AND conname = 'glossary_terms_character_id_characters_id_fk'
  ) THEN
    ALTER TABLE "glossary_terms"
      ADD CONSTRAINT "glossary_terms_character_id_characters_id_fk"
      FOREIGN KEY ("character_id") REFERENCES "characters" ("id")
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.active_effects'::regclass
      AND conname = 'active_effects_character_id_characters_id_fk'
  ) THEN
    ALTER TABLE "active_effects"
      ADD CONSTRAINT "active_effects_character_id_characters_id_fk"
      FOREIGN KEY ("character_id") REFERENCES "characters" ("id")
      ON DELETE CASCADE NOT VALID;
  END IF;
END
$migration$;
--> statement-breakpoint

-- Validate each new key when the legacy rows are already clean. If an orphan
-- exists, leave the key NOT VALID rather than deleting data; it still protects
-- all future writes and can be validated after the orphan is reconciled.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.spirit_die_pools'::regclass
      AND conname = 'spirit_die_pools_character_id_characters_id_fk'
      AND NOT convalidated
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "spirit_die_pools" AS child
      LEFT JOIN "characters" AS parent ON parent."id" = child."character_id"
      WHERE parent."id" IS NULL
    ) THEN
      ALTER TABLE "spirit_die_pools"
        VALIDATE CONSTRAINT "spirit_die_pools_character_id_characters_id_fk";
    ELSE
      RAISE WARNING
        'spirit_die_pools foreign key remains NOT VALID because legacy orphan rows exist';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.techniques'::regclass
      AND conname = 'techniques_character_id_characters_id_fk'
      AND NOT convalidated
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "techniques" AS child
      LEFT JOIN "characters" AS parent ON parent."id" = child."character_id"
      WHERE parent."id" IS NULL
    ) THEN
      ALTER TABLE "techniques"
        VALIDATE CONSTRAINT "techniques_character_id_characters_id_fk";
    ELSE
      RAISE WARNING
        'techniques foreign key remains NOT VALID because legacy orphan rows exist';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.glossary_terms'::regclass
      AND conname = 'glossary_terms_character_id_characters_id_fk'
      AND NOT convalidated
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "glossary_terms" AS child
      LEFT JOIN "characters" AS parent ON parent."id" = child."character_id"
      WHERE parent."id" IS NULL
    ) THEN
      ALTER TABLE "glossary_terms"
        VALIDATE CONSTRAINT "glossary_terms_character_id_characters_id_fk";
    ELSE
      RAISE WARNING
        'glossary_terms foreign key remains NOT VALID because legacy orphan rows exist';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.active_effects'::regclass
      AND conname = 'active_effects_character_id_characters_id_fk'
      AND NOT convalidated
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "active_effects" AS child
      LEFT JOIN "characters" AS parent ON parent."id" = child."character_id"
      WHERE parent."id" IS NULL
    ) THEN
      ALTER TABLE "active_effects"
        VALIDATE CONSTRAINT "active_effects_character_id_characters_id_fk";
    ELSE
      RAISE WARNING
        'active_effects foreign key remains NOT VALID because legacy orphan rows exist';
    END IF;
  END IF;
END
$migration$;
--> statement-breakpoint

-- Indexes declared by shared/schema.ts but absent from migration 0000.
CREATE INDEX IF NOT EXISTS "techniques_character_idx"
  ON "techniques" USING btree ("character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "glossary_terms_character_idx"
  ON "glossary_terms" USING btree ("character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "active_effects_character_idx"
  ON "active_effects" USING btree ("character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trackers_character_idx"
  ON "trackers" USING btree ("character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dm_stacks_user_idx"
  ON "dm_stacks" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dm_glossary_user_idx"
  ON "dm_glossary" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dm_scratchpads_user_idx"
  ON "dm_scratchpads" USING btree ("user_id");
