import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
  path: ".env.local",
});

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL_UNPOOLED environment variable is not configured"
  );
}

export default defineConfig({
  dialect: "postgresql",

  schema: "./lib/db/schema/**/*.ts",

  out: "./drizzle",

  dbCredentials: {
    url: databaseUrl,
  },
});