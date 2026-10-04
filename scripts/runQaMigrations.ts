import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

config({
  path: ".env.qa.local",
  override: true,
});

const EXPECTED_QA_HOST =
  "ep-autumn-firefly-awezfp7r.c-12.us-east-1.aws.neon.tech";

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_UNPOOLED no está definida en .env.qa.local",
    );
  }

  const parsedUrl = new URL(connectionString);

  if (parsedUrl.hostname !== EXPECTED_QA_HOST) {
    throw new Error(
      [
        "QA migration aborted.",
        `Expected host: ${EXPECTED_QA_HOST}`,
        `Received host: ${parsedUrl.hostname}`,
      ].join("\n"),
    );
  }

  console.log("Running QA migrations with drizzle-orm + pg");
  console.log(`Host: ${parsedUrl.hostname}`);
  console.log(`Database: ${parsedUrl.pathname.replace("/", "")}`);
  console.log("");

  const pool = new Pool({
    connectionString,
  });

  const db = drizzle(pool);

  try {
    await migrate(db, {
      migrationsFolder: "./drizzle",
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });

    console.log("");
    console.log("QA migrations completed successfully.");
  } catch (error) {
    console.error("");
    console.error("QA migration failed.");
    console.error("");

    console.error(error);

    if (
      error &&
      typeof error === "object" &&
      "cause" in error &&
      error.cause
    ) {
      console.error("");
      console.error("Underlying PostgreSQL error:");
      console.error(error.cause);
    }

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Unexpected migration runner error:");
  console.error(error);
  process.exitCode = 1;
});