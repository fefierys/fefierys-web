import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const sql = neon(databaseUrl);

async function verifySequenceUpdate() {
  const results = await sql.transaction([
    // Tabla temporal: no modifica las tablas reales de Fefierys.
    sql`
      CREATE TEMP TABLE fefierys_http_sequence_probe (
        id integer PRIMARY KEY,
        quote_id integer NOT NULL,
        sequence integer NOT NULL CHECK (sequence >= 1),
        UNIQUE (quote_id, sequence)
      ) ON COMMIT DROP
    `,

    // Dos ilustraciones con tres etapas cada una.
    sql`
      INSERT INTO fefierys_http_sequence_probe
        (id, quote_id, sequence)
      VALUES
        (1, 1, 1),
        (2, 1, 2),
        (3, 1, 3),
        (4, 1, 4),
        (5, 1, 5),
        (6, 1, 6)
    `,

    // Primera fase: mover las posiciones actuales a un rango libre.
    sql`
      UPDATE fefierys_http_sequence_probe
      SET sequence = sequence + 100
      WHERE quote_id = 1
    `,

    // Crear una etapa nueva en una posición temporal libre.
    sql`
      INSERT INTO fefierys_http_sequence_probe
        (id, quote_id, sequence)
      VALUES (7, 1, 1007)
    `,

    // Segunda fase: ordenar los registros existentes.
    // Los IDs 4, 5 y 6 pasan a las posiciones 5, 6 y 7.
    sql`
      UPDATE fefierys_http_sequence_probe
      SET sequence = CASE
        WHEN id <= 3 THEN id
        ELSE id + 1
      END
      WHERE quote_id = 1 AND id <= 6
    `,

    // La etapa nueva pasa a la posición 4.
    sql`
      UPDATE fefierys_http_sequence_probe
      SET sequence = 4
      WHERE id = 7 AND quote_id = 1
    `,

    sql`
      SELECT id, sequence
      FROM fefierys_http_sequence_probe
      WHERE quote_id = 1
      ORDER BY sequence
    `,
  ]);

  const actual = results[6].map((row) => ({
    id: row.id,
    sequence: row.sequence,
  }));

  const expected = [
    { id: 1, sequence: 1 },
    { id: 2, sequence: 2 },
    { id: 3, sequence: 3 },
    { id: 7, sequence: 4 },
    { id: 4, sequence: 5 },
    { id: 5, sequence: 6 },
    { id: 6, sequence: 7 },
  ];

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Unexpected sequence result: ${JSON.stringify(actual)}`,
    );
  }

  console.log("PASS: HTTP transaction preserved IDs and reordered stages.");
  console.table(actual);
}

async function verifyUniqueConstraint() {
  try {
    await sql.transaction([
      sql`
        CREATE TEMP TABLE fefierys_http_sequence_probe (
          id integer PRIMARY KEY,
          quote_id integer NOT NULL,
          sequence integer NOT NULL CHECK (sequence >= 1),
          UNIQUE (quote_id, sequence)
        ) ON COMMIT DROP
      `,

      sql`
        INSERT INTO fefierys_http_sequence_probe
          (id, quote_id, sequence)
        VALUES (1, 1, 1)
      `,

      // Debe fallar: intenta repetir una secuencia ocupada.
      sql`
        INSERT INTO fefierys_http_sequence_probe
          (id, quote_id, sequence)
        VALUES (2, 1, 1)
      `,
    ]);
  } catch (error) {
    if (error.code !== "23505") {
      throw error;
    }

    console.log("PASS: duplicate sequence was rejected.");
    return;
  }

  throw new Error("Expected a unique-constraint error.");
}

await verifySequenceUpdate();
await verifyUniqueConstraint();

console.log("All HTTP sequence checks passed.");