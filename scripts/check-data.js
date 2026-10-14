const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
    console.error('ERROR: No DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Usuarios con roles
    const usuarios = await pool.query(`
      SELECT u.id_usuario, u.email, u.activo, p.documento_identidad, p.nombres, p.apellidos,
             array_agg(r.nombre_rol) FILTER (WHERE r.nombre_rol IS NOT NULL) as roles
      FROM usuario u
      JOIN persona p ON p.id_persona = u.id_persona
      LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
      LEFT JOIN rol r ON r.id_rol = ur.id_rol
      GROUP BY u.id_usuario, u.email, u.activo, p.documento_identidad, p.nombres, p.apellidos
      ORDER BY u.id_usuario
    `);
    console.log('=== USUARIOS ===');
    console.table(usuarios.rows);

    // Todas las personas
    const personas = await pool.query(`
      SELECT id_persona, documento_identidad, nombres, apellidos, fecha_nacimiento
      FROM persona ORDER BY id_persona
    `);
    console.log('\n=== PERSONAS ===');
    console.table(personas.rows);

    // Personal
    const personal = await pool.query(`
      SELECT per.id_personal, p.documento_identidad, p.nombres, p.apellidos, e.nombre_especialidad, per.activo
      FROM personal per
      JOIN persona p ON p.id_persona = per.id_persona
      JOIN especialidad e ON e.id_especialidad = per.id_especialidad
      ORDER BY per.id_personal
    `);
    console.log('\n=== PERSONAL ===');
    console.table(personal.rows);

    // Pacientes
    const pacientes = await pool.query(`
      SELECT pac.id_paciente, p.documento_identidad, p.nombres, p.apellidos, pac.activo
      FROM paciente pac
      JOIN persona p ON p.id_persona = pac.id_persona
      ORDER BY pac.id_paciente
    `);
    console.log('\n=== PACIENTES ===');
    console.table(pacientes.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();