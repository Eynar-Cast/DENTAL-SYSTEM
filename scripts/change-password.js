// scripts/change-password.js
// Cambia la contraseña de un usuario sin pasar por la UI.
// Uso: node scripts/change-password.js email@ejemplo.com nuevaContrasena123

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
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

  const [email, password] = process.argv.slice(2);

  if (!email || !password || String(password).length < 6) {
    console.error(
      'Uso: node scripts/change-password.js email@ejemplo.com nuevaContrasena123'
    );
    console.error("La contraseña debe tener al menos 6 caracteres.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const usuarioResult = await pool.query(
      `SELECT id_usuario, email FROM usuario WHERE email = LOWER($1)`,
      [String(email).trim().toLowerCase()]
    );

    if (usuarioResult.rows.length === 0) {
      console.error("✗ No se encontró un usuario con ese email.");
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    await pool.query(
      `UPDATE usuario SET password_hash = $1 WHERE id_usuario = $2`,
      [passwordHash, usuarioResult.rows[0].id_usuario]
    );

    console.log(
      `\n✓ Contraseña actualizada para ${usuarioResult.rows[0].email} (id ${usuarioResult.rows[0].id_usuario}).`
    );
  } catch (err) {
    console.error("✗ Error actualizando la contraseña:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();