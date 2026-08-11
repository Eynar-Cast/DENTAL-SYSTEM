// scripts/create-admin.js
// Crea la primera Persona + Usuario admin para poder hacer login.
// Uso: node scripts/create-admin.js "Tu Nombre" "Tu Apellido" tu@email.com tuPassword123

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

  const [nombres, apellidos, email, password] = process.argv.slice(2);

  if (!nombres || !apellidos || !email || !password) {
    console.error(
      'Uso: node scripts/create-admin.js "Nombre" "Apellido" email@ejemplo.com contraseña123'
    );
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Asegurar que exista al menos un país/ciudad para poder crear la Persona
    const ciudadResult = await client.query(
      `SELECT id_ciudad FROM ciudad LIMIT 1`
    );

    let idCiudad;
    if (ciudadResult.rows.length > 0) {
      idCiudad = ciudadResult.rows[0].id_ciudad;
    } else {
      const paisResult = await client.query(`SELECT id_pais FROM pais LIMIT 1`);
      const idPais = paisResult.rows[0].id_pais;
      const nuevaCiudad = await client.query(
        `INSERT INTO ciudad (nombre_ciudad, id_pais) VALUES ('La Paz', $1) RETURNING id_ciudad`,
        [idPais]
      );
      idCiudad = nuevaCiudad.rows[0].id_ciudad;
      console.log("Ciudad 'La Paz' creada automáticamente.");
    }

    // 2. Crear Persona
    const documento = `ADMIN-${Date.now()}`;
    const personaResult = await client.query(
      `INSERT INTO persona (documento_identidad, nombres, apellidos, fecha_nacimiento, id_ciudad)
       VALUES ($1, $2, $3, '1990-01-01', $4)
       RETURNING id_persona`,
      [documento, nombres, apellidos, idCiudad]
    );
    const idPersona = personaResult.rows[0].id_persona;

    // 3. Crear Usuario con contraseña hasheada
    const passwordHash = await bcrypt.hash(password, 10);
    const usuarioResult = await client.query(
      `INSERT INTO usuario (id_persona, email, password_hash, activo)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id_usuario`,
      [idPersona, email, passwordHash]
    );
    const idUsuario = usuarioResult.rows[0].id_usuario;

    // 4. Asignar rol admin
    const rolResult = await client.query(
      `SELECT id_rol FROM rol WHERE nombre_rol = 'admin' LIMIT 1`
    );
    if (rolResult.rows.length > 0) {
      await client.query(
        `INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`,
        [idUsuario, rolResult.rows[0].id_rol]
      );
    }

    await client.query("COMMIT");

    console.log("\n✓ Usuario administrador creado exitosamente:");
    console.log(`  Email: ${email}`);
    console.log(`  ID Usuario: ${idUsuario}`);
    console.log("\nYa puedes iniciar sesión con este email y la contraseña que ingresaste.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ Error al crear el usuario:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();