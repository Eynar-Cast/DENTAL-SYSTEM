// scripts/verify-db.js
// Lista todas las tablas y conteos de las tablas semilla, para confirmar
// que la migración se aplicó correctamente en la base apuntada por DATABASE_URL.
// Uso: node scripts/verify-db.js

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
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

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: No se encontró DATABASE_URL en .env.local");
    process.exit(1);
  }

  // Mostrar (parcialmente) a qué host nos estamos conectando, para confirmar
  const hostMatch = process.env.DATABASE_URL.match(/@([^/]+)\//);
  console.log("Conectando a host:", hostMatch ? hostMatch[1] : "(no detectado)");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const tablesResult = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
    );

    console.log(`\nTablas encontradas: ${tablesResult.rows.length}\n`);
    tablesResult.rows.forEach((row) => console.log("-", row.table_name));

    if (tablesResult.rows.length === 0) {
      console.log("\n⚠ No hay ninguna tabla en esta base. La migración no se aplicó aquí.");
      return;
    }

    console.log("\n--- Verificando datos semilla ---");
    const seedTables = ["estado_cita", "grupo_sanguineo", "rol", "tipo_signo_vital", "pais"];
    for (const table of seedTables) {
      try {
        const r = await pool.query(`SELECT COUNT(*) FROM ${table};`);
        console.log(`${table}: ${r.rows[0].count} filas`);
      } catch (e) {
        console.log(`${table}: no existe o error (${e.message})`);
      }
    }
  } catch (err) {
    console.error("Error al consultar la base:", err.message);
  } finally {
    await pool.end();
  }
}

main();