CREATE TABLE IF NOT EXISTS "card_game_states" (
  "id" varchar PRIMARY KEY,
  "state" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
