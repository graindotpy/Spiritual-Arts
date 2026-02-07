import "dotenv/config";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "../db";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const fromBase = process.env.R2_OLD_BASE_URL || "";
const toBase = process.env.R2_PUBLIC_BASE_URL || "";

if (!fromBase || !toBase) {
  console.error("Missing R2_OLD_BASE_URL or R2_PUBLIC_BASE_URL.");
  process.exit(1);
}

const from = fromBase.replace(/\/+$/, "");
const to = toBase.replace(/\/+$/, "");

async function updatePortraitUrls() {
  const result = await db.execute(sql`
    UPDATE characters
    SET portrait_url = replace(portrait_url, ${from}, ${to})
    WHERE portrait_url LIKE ${from + "%"}
  `);
  return result.rowCount || 0;
}

async function updateImageUrlsInText() {
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
  return updated;
}

async function main() {
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

main().catch((error) => {
  console.error("Rewrite failed:", error);
  process.exit(1);
});
