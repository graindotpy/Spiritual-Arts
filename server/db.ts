import dotenv from "dotenv";
dotenv.config();
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local", override: true });
}
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const safeDbUrl = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL as string);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "unknown";
  }
})();
console.log(`[db] using DATABASE_URL ${safeDbUrl}`);

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
