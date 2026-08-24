import { drizzle } from "drizzle-orm/neon-http";

const databaseUrl =
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is not configured"
  );
}

export const db =
  drizzle(databaseUrl);