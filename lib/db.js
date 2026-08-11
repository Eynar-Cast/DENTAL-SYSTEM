import { Pool } from "pg";

// Reutilizamos el pool entre invocaciones en desarrollo (hot-reload)
// para no abrir cientos de conexiones. En producción (Vercel serverless)
// cada instancia de función crea su propio pool, lo cual es normal.
let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "Falta la variable de entorno DATABASE_URL. Revisa tu .env.local (desarrollo) o Vercel > Settings > Environment Variables (producción)."
      );
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Neon requiere SSL
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.error("Error inesperado en el pool de PostgreSQL:", err);
    });
  }

  return pool;
}

// Helper principal: query(text, params)
export async function query(text, params) {
  const client = getPool();
  const start = Date.now();
  const result = await client.query(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV !== "production") {
    console.log("Query ejecutada", { text, duration, rows: result.rowCount });
  }

  return result;
}

// Helper para transacciones: withTransaction(async (client) => { ... })
export async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export default getPool;