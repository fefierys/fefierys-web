import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
  path: ".env.qa.local",
  override: true,
});

const databaseUrl = process.env.DATABASE_URL_UNPOOLED;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL_UNPOOLED no está definida en .env.qa.local",
  );
}

const parsedUrl = new URL(databaseUrl);

const expectedQaHost =
  "ep-autumn-firefly-awezfp7r.c-12.us-east-1.aws.neon.tech";

if (parsedUrl.hostname !== expectedQaHost) {
  throw new Error(
    [
      "La migración fue abortada porque DATABASE_URL_UNPOOLED",
      "no apunta a la base de datos QA esperada.",
      "",
      `Expected: ${expectedQaHost}`,
      `Received: ${parsedUrl.hostname}`,
    ].join("\n"),
  );
}

console.log("Drizzle QA migration config:");
console.log(`Host: ${parsedUrl.hostname}`);
console.log(`Database: ${parsedUrl.pathname.replace("/", "")}`);

export default defineConfig({
  schema: "./lib/db/schema/**/*.ts",
  out: "./drizzle",

  dialect: "postgresql",

  dbCredentials: {
    url: databaseUrl,
  },

  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
});