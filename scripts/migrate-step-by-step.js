// scripts/migrate-step-by-step.js
// Ejecuta cada sentencia de schema.sql por separado, con BEGIN/COMMIT
// explícitos, e imprime el resultado de cada una. Así vemos exactamente
// en qué statement (si alguno) está el problema.
// Uso: node scripts/migrate-step-by-step.js

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

// Split naive por ';' al final de línea, ignorando líneas de comentario '--'
function splitStatements(sql) {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  loadEnvLocal();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    const schemaPath = path.join(process.cwd(), "scripts", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");
    const statements = splitStatements(sql);

    console.log(`Total de statements a ejecutar: ${statements.length}\n`);

    await client.query("BEGIN");
    console.log("BEGIN ejecutado.\n");

    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.replace(/\s+/g, " ").slice(0, 70);
      try {
        const result = await client.query(stmt);
        successCount++;
        console.log(`[${i + 1}/${statements.length}] OK (${result.command}) -> ${preview}...`);
      } catch (err) {
        console.log(`[${i + 1}/${statements.length}] FALLÓ -> ${preview}...`);
        console.log(`   Error: ${err.message}`);
        console.log("\nHaciendo ROLLBACK por el error anterior.");
        await client.query("ROLLBACK");
        process.exit(1);
      }
    }

    console.log(`\n${successCount} statements ejecutados correctamente. Haciendo COMMIT...`);
    await client.query("COMMIT");
    console.log("COMMIT confirmado.\n");

    // Verificar usando pg_tables (catálogo directo, no information_schema)
    const check = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
    );
    console.log(`=== Verificación final: ${check.rows.length} tablas en public ===`);
    check.rows.forEach((r) => console.log("-", r.tablename));
  } catch (err) {
    console.error("Error general del script:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();