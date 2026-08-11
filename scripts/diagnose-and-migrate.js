// scripts/diagnose-and-migrate.js
// Diagnostica la conexión, corre schema.sql, y verifica -- todo en la
// misma conexión/sesión para eliminar dudas de que sean bases distintas.
// Uso: node scripts/diagnose-and-migrate.js

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

async function main() {
  loadEnvLocal();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    console.log("=== DIAGNÓSTICO DE CONEXIÓN ===");
    const info = await client.query(
      "SELECT current_database() AS db, current_user AS usuario, current_schema() AS schema, inet_server_addr() AS server_ip;"
    );
    console.log(info.rows[0]);

    console.log("\n=== TABLAS EN TODOS LOS SCHEMAS (no solo public) ===");
    const allTables = await client.query(
      `SELECT table_schema, table_name 
       FROM information_schema.tables 
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema') 
       ORDER BY table_schema, table_name;`
    );
    console.log(`Encontradas: ${allTables.rows.length}`);
    allTables.rows.forEach((r) => console.log(`- ${r.table_schema}.${r.table_name}`));

    console.log("\n=== EJECUTANDO schema.sql EN ESTA MISMA CONEXIÓN ===");
    const schemaPath = path.join(process.cwd(), "scripts", "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");

    try {
      await client.query(sql);
      console.log("✓ schema.sql ejecutado sin errores.");
    } catch (err) {
      console.log("✗ ERROR al ejecutar schema.sql:");
      console.log(err.message);
      console.log("\nDetalle completo del error:");
      console.log(err);
    }

    console.log("\n=== VERIFICANDO TABLAS DESPUÉS DE LA MIGRACIÓN (misma conexión) ===");
    const afterTables = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
    );
    console.log(`Tablas en public ahora: ${afterTables.rows.length}`);
    afterTables.rows.forEach((r) => console.log("-", r.table_name));
  } catch (err) {
    console.error("Error general:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();