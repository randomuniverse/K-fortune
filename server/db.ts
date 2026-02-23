import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function runMigrations() {
  console.log("[DB] Running migrations...");
  try {
    let migrationsPath: string;
    if (typeof __dirname !== "undefined") {
      migrationsPath = path.resolve(__dirname, "migrations");
    } else {
      const __filename = fileURLToPath(import.meta.url);
      const __dirnameDerived = path.dirname(__filename);
      migrationsPath = path.resolve(__dirnameDerived, "../migrations");
    }
    console.log("[DB] Migrations path:", migrationsPath);
    await migrate(db, { migrationsFolder: migrationsPath });
    console.log("[DB] Migrations completed successfully.");
  } catch (error) {
    console.error("[DB] Migration failed:", error);
    throw error;
  }
}
