import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { databaseConnection, requireDatabase } from "../db";

const MIGRATION_FILE = "0003_harden_schema_constraints.sql";

async function main(): Promise<void> {
  const migrationPath = path.join(process.cwd(), "migrations", MIGRATION_FILE);
  const source = await readFile(migrationPath, "utf8");
  const statements = source
    .split(/^\s*-->\s*statement-breakpoint\s*$/mu)
    .map((statement) => statement.trim())
    .filter(Boolean);

  if (statements.length === 0) {
    throw new Error(`${MIGRATION_FILE} contains no executable statements`);
  }

  const database = requireDatabase();
  await database.transaction(async (transaction) => {
    for (const statement of statements) {
      await transaction.execute(sql.raw(statement));
    }
  });

  console.log(`Applied ${MIGRATION_FILE} (${statements.length} statements)`);
}

void main()
  .catch((error: unknown) => {
    console.error("Schema hardening failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await databaseConnection?.pool.end();
  });
