import dotenv from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "@shared/schema";

dotenv.config({ quiet: true });
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local", override: true, quiet: true });
}

neonConfig.webSocketConstructor = ws;

function createDatabaseConnection(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool, schema });

  return { db, pool };
}

export type Database = ReturnType<typeof createDatabaseConnection>["db"];

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL must be set when NODE_ENV=production");
}

export const databaseConnection = databaseUrl
  ? createDatabaseConnection(databaseUrl)
  : null;

export function requireDatabase(): Database {
  if (!databaseConnection) {
    throw new Error("DATABASE_URL must be set for this operation");
  }
  return databaseConnection.db;
}
