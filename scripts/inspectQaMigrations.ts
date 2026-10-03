import { config } from "dotenv";
import { Client } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

config({
  path: ".env.qa.local",
  override: true,
});

type JournalEntry = {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type Journal = {
  version: string;
  dialect: string;
  entries: JournalEntry[];
};

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_UNPOOLED no está definida en .env.qa.local",
    );
  }

  const databaseUrl = new URL(connectionString);

  console.log("QA database:");
  console.log(`Host: ${databaseUrl.hostname}`);
  console.log(`Database: ${databaseUrl.pathname.replace("/", "")}`);
  console.log("");

  const journalPath = join(
    process.cwd(),
    "drizzle",
    "meta",
    "_journal.json",
  );

  const journal = JSON.parse(
    readFileSync(journalPath, "utf8"),
  ) as Journal;

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();

    const result = await client.query<{
      id: number;
      hash: string;
      created_at: string;
    }>(`
      SELECT
        id,
        hash,
        created_at::text
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at;
    `);

    console.log("Applied migrations in QA:");
    console.log("");

    const applied = result.rows.map((row) => {
      const journalEntry = journal.entries.find(
        (entry) => String(entry.when) === row.created_at,
      );

      return {
        id: row.id,
        created_at: row.created_at,
        migration: journalEntry?.tag ?? "UNKNOWN",
      };
    });

    console.table(applied);

    const latestCreatedAt =
      result.rows.length > 0
        ? BigInt(result.rows[result.rows.length - 1].created_at)
        : 0n;

    const pending = journal.entries.filter(
      (entry) => BigInt(entry.when) > latestCreatedAt,
    );

    console.log("");
    console.log("Pending migrations according to local journal:");
    console.log("");

    console.table(
      pending.map((entry) => ({
        idx: entry.idx,
        when: entry.when,
        migration: entry.tag,
      })),
    );

    console.log("");
    console.log(
      `Applied: ${result.rows.length} / Local journal: ${journal.entries.length}`,
    );
    console.log(`Pending: ${pending.length}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration inspection failed:");
  console.error(error);
  process.exitCode = 1;
});