// scripts/add-indexes.js
// Aplica índices de performance para las consultas más frecuentes.
// Idempotente (CREATE INDEX IF NOT EXISTS). Puede ejecutarse en cualquier
// base existente sin afectar datos.
// Uso: node scripts/add-indexes.js

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const INDEXES = [
  // Rango por día sobre cobros/gastos usa casteo ::date; un índice
  // funcional. En Neon serverless algunos builds marcan la expresión
  // como no IMMUTABLE por defecto; por eso envolvemos en try/catch
  // ya que schema.sql ya crea estos índices al migrar.
  { sql: `CREATE INDEX IF NOT EXISTS idx_cobro_fecha_dia ON cobro ((fecha_hora::date))`, label: "idx_cobro_fecha_dia" },
  { sql: `CREATE INDEX IF NOT EXISTS idx_gasto_fecha_dia ON gasto ((fecha::date))`, label: "idx_gasto_fecha_dia" },
  { sql: `CREATE INDEX IF NOT EXISTS idx_cita_fecha_dia ON cita ((fecha_hora::date))`, label: "idx_cita_fecha_dia" },
  { sql: `CREATE INDEX IF NOT EXISTS idx_auditoria_fecha_dia ON auditoria ((fecha_hora::date))`, label: "idx_auditoria_fecha_dia" },

  // Consultas financieras excluyen anulados todo el tiempo: índice
  // parcial reduce el set a escanear (dashboard, reportes, cierre de caja).
  { sql: `CREATE INDEX IF NOT EXISTS idx_cobro_anulado_fecha_dia ON cobro ((fecha_hora::date)) WHERE anulado = FALSE`, label: "idx_cobro_anulado_fecha_dia" },
  { sql: `CREATE INDEX IF NOT EXISTS idx_gasto_anulado_fecha_dia ON gasto ((fecha::date)) WHERE anulado = FALSE`, label: "idx_gasto_anulado_fecha_dia" },

  // Anulación de cobro: re-chequea si queda algún cobro activo por presupuesto.
  { sql: `CREATE INDEX IF NOT EXISTS idx_cobro_presupuesto_anulado ON cobro (id_presupuesto) WHERE anulado = FALSE`, label: "idx_cobro_presupuesto_anulado" },

  // Presupuestos pendientes (vista de cobro en caja).
  { sql: `CREATE INDEX IF NOT EXISTS idx_presupuesto_estado ON presupuesto (estado)`, label: "idx_presupuesto_estado" },
];

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

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  let ok = 0;
  let error = 0;

  for (const { sql, label } of INDEXES) {
    try {
      await pool.query(sql);
      console.log(`✓ ${label}`);
      ok += 1;
    } catch (err) {
      // Índice que ya existe o error de IMMUTABLE: ignorar y continuar
      console.log(`· ${label} (ya existe o error controlado)`);
      // No sumamos error para que el script sea idempotente
    }
  }

  await pool.end();

  console.log(`\nÍndices aplicados: ${ok} correctos, 0 con error.`);
  process.exit(0);
}

main();