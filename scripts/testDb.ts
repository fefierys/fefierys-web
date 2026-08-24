import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({
  path: ".env.local",
});

async function main() {
  const { db } =
    await import("../lib/db");

  const result =
    await db.execute(
      sql`
        SELECT
          current_database() AS database,
          version() AS postgres_version,
          NOW() AS current_time
      `
    );

  console.log(
    "Database connection successful ✅"
  );

  console.log(result.rows);
}

main().catch((error) => {
  console.error(
    "Database connection failed ❌"
  );

  console.error(error);

  process.exit(1);
});