// scripts/migrate.js
// Ejecuta scripts/schema.sql contra la base de datos apuntada por DATABASE_URL.
// Uso: node scripts/migrate.js
//
// Requiere que exista .env.local con DATABASE_URL, o que la variable
// esté seteada en el entorno donde corres el comando.

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Cargar .env.local manualmente (sin dependencias extra tipo dotenv)
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
    // Quitar comillas si las tiene
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

async function main() {
  loadEnvLocal();

  if (!process.env.DATABASE_URL) {
    console.error(
      "ERROR: No se encontró DATABASE_URL. Revisa que exista .env.local en la raíz del proyecto con esa variable."
    );
    process.exit(1);
  }

  const schemaPath = path.join(process.cwd(), "scripts", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error(`ERROR: No se encontró ${schemaPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, "utf8");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log("Conectado a la base de datos. Ejecutando schema.sql...\n");
    await client.query(sql);
    console.log("✓ Migración completada exitosamente. Todas las tablas fueron creadas.");
  } catch (err) {
    console.error("✗ Error al ejecutar la migración:\n");
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();