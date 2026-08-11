// scripts/db-state.js
// Muestra conteos actuales de tablas operativas para decidir limpieza.
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

async function main() {
  loadEnvLocal();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const tablas = ["cobro","gasto","detalle_presupuesto","presupuesto","atencion_procedimiento","diagnostico_atencion","signo_vital","atencion","cita","sesion_usuario","auditoria","paciente","personal","usuario","persona","precio_historial","caja"];
  for (const t of tablas) {
    try {
      const r = await pool.query(`SELECT COUNT(*) AS c FROM ${t}`);
      console.log(t.padEnd(22), r.rows[0].c);
    } catch (e) {
      console.log(t.padEnd(22), "ERR", e.message);
    }
  }
  await pool.end();
}

main();
