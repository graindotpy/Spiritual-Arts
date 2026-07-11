import { sql } from "drizzle-orm";
import { databaseConnection, requireDatabase } from "../db";

const from = (process.env.R2_OLD_BASE_URL ?? "").trim().replace(/\/+$/, "");
const to = (process.env.R2_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");

async function updatePortraitUrls() {
  const db = requireDatabase();
  const result = await db.execute(sql`
    UPDATE characters
    SET portrait_url = replace(portrait_url, ${from}, ${to})
    WHERE portrait_url LIKE ${from + "%"}
  `);
  return result.rowCount || 0;
}

async function updateImageUrlsInText() {
  const db = requireDatabase();
  let updated = 0;
  const tables = [
    { name: "glossary_terms", columns: ["definition", "expanded_content"] },
    { name: "dm_glossary", columns: ["definition", "expanded_content"] },
    { name: "dm_scratchpads", columns: ["content"] },
    { name: "dm_stacks", columns: ["target", "effect"] },
  ];

  for (const table of tables) {
    for (const column of table.columns) {
      const result = await db.execute(sql`
        UPDATE ${sql.raw(table.name)}
        SET ${sql.raw(column)} = replace(${sql.raw(column)}, ${from}, ${to})
        WHERE ${sql.raw(column)} LIKE ${from + "%"} OR ${sql.raw(column)} LIKE ${"%" + from + "%"}
      `);
      updated += result.rowCount || 0;
    }
  }

  const cardStates = await db.execute(sql`
    UPDATE card_game_states
    SET state = replace(state::text, ${from}, ${to})::jsonb
    WHERE state::text LIKE ${"%" + from + "%"}
  `);
  updated += cardStates.rowCount || 0;

  return updated;
}

async function main() {
  if (!from || !to) {
    throw new Error("R2_OLD_BASE_URL and R2_PUBLIC_BASE_URL are required");
  }
  requireDatabase();

  const portraitsUpdated = await updatePortraitUrls();
  const textUpdated = await updateImageUrlsInText();
  console.log(
    JSON.stringify(
      { portraitsUpdated, textUpdated, from, to },
      null,
      2,
    ),
  );
}

void main()
  .catch((error: unknown) => {
    console.error("Rewrite failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await databaseConnection?.pool.end();
  });
