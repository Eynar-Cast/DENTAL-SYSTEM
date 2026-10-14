import { requireAuth, requireRoles, obtenerIP, hashPassword } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio, esEmail } from "@/lib/validations";

const ROLES_PERMITIDOS = ["admin", "recepcionista", "odontologo"];

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede gestionar usuarios", 403);

  const result = await query(
    `SELECT u.id_usuario, u.email, u.activo, u.fecha_creacion,
            per.documento_identidad, per.nombres, per.apellidos,
            COALESCE(array_agg(r.nombre_rol) FILTER (WHERE r.nombre_rol IS NOT NULL), '{}') AS roles
     FROM usuario u
     JOIN persona per ON per.id_persona = u.id_persona
     LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
     LEFT JOIN rol r ON r.id_rol = ur.id_rol
     GROUP BY u.id_usuario, u.email, u.activo, u.fecha_creacion, per.documento_identidad, per.nombres, per.apellidos
     ORDER BY u.id_usuario`
  );

  return jsonOk(result.rows);
}

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede crear usuarios", 403);

  const body = await request.json().catch(() => ({}));
  const ip = obtenerIP(request);

  const documento = textoLimpio(body.documento_identidad);
  const nombres = textoLimpio(body.nombres);
  const apellidos = textoLimpio(body.apellidos);
  const email = textoLimpio(body.email);
  const password = body.password;
  const roles = Array.isArray(body.roles) ? body.roles : [];
  const esPersonalOdontologo = body.es_personal === true;
  const idEspecialidad = body.id_especialidad || null;

  if (!documento) return jsonError("El documento de identidad es obligatorio", 400);
  if (!nombres || !apellidos) return jsonError("Nombres y apellidos son obligatorios", 400);
  if (!esEmail(email)) return jsonError("Ingresa un email válido", 400);
  if (!password || String(password).length < 6) {
    return jsonError("La contraseña debe tener al menos 6 caracteres", 400);
  }
  if (roles.length === 0) return jsonError("Selecciona al menos un rol", 400);
  if (roles.some((r) => !ROLES_PERMITIDOS.includes(r))) {
    return jsonError("Uno de los roles seleccionados no es válido", 400);
  }

  try {
    const result = await withTransaction(async (client) => {
      // Verificar si el email ya está registrado en usuario
      const emailExiste = await client.query(`SELECT 1 FROM usuario WHERE email = $1`, [email]);
      if (emailExiste.rows.length > 0) {
        throw Object.assign(new Error("El email ya está registrado"), { code: "23505" });
      }

      // Verificar si ya existe una persona con este documento
      let idPersona;
      const personaExistente = await client.query(
        `SELECT id_persona FROM persona WHERE documento_identidad = $1`,
        [documento]
      );

      if (personaExistente.rows.length > 0) {
        // Usar la persona existente
        idPersona = personaExistente.rows[0].id_persona;
        
        // Actualizar nombres/apellidos si son diferentes (opcional)
        await client.query(
          `UPDATE persona SET nombres = $1, apellidos = $2 WHERE id_persona = $3`,
          [nombres, apellidos, idPersona]
        );
      } else {
        // Crear nueva persona
        const ciudadResult = await client.query(`SELECT id_ciudad FROM ciudad LIMIT 1`);
        const idCiudad = ciudadResult.rows[0]?.id_ciudad;

        const personaResult = await client.query(
          `INSERT INTO persona (documento_identidad, nombres, apellidos, fecha_nacimiento, id_ciudad)
           VALUES ($1, $2, $3, '1990-01-01', $4) RETURNING id_persona`,
          [documento, nombres, apellidos, idCiudad]
        );
        idPersona = personaResult.rows[0].id_persona;
      }

      // Verificar si esta persona ya tiene usuario
      const usuarioExistente = await client.query(`SELECT 1 FROM usuario WHERE id_persona = $1`, [idPersona]);
      if (usuarioExistente.rows.length > 0) {
        throw Object.assign(new Error("Esta persona ya tiene una cuenta de usuario"), { code: "23505" });
      }

      // Vincular el usuario a un miembro del personal (si corresponde)
      if (esPersonalOdontologo) {
        // Verificar si ya es personal
        const personalExistente = await client.query(`SELECT 1 FROM personal WHERE id_persona = $1`, [idPersona]);
        if (personalExistente.rows.length === 0) {
          await client.query(
            `INSERT INTO personal (id_persona, id_especialidad, numero_colegiatura, activo)
             VALUES ($1, $2, NULL, TRUE)`,
            [idPersona, idEspecialidad || null]
          );
        }
      }

      const passwordHash = await hashPassword(password);
      const usuarioResult = await client.query(
        `INSERT INTO usuario (id_persona, email, password_hash, activo)
         VALUES ($1, $2, $3, TRUE) RETURNING id_usuario`,
        [idPersona, email, passwordHash]
      );
      const idUsuario = usuarioResult.rows[0].id_usuario;

      for (const rol of roles) {
        const rolResult = await client.query(`SELECT id_rol FROM rol WHERE nombre_rol = $1`, [rol]);
        if (rolResult.rows.length > 0) {
          await client.query(
            `INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`,
            [idUsuario, rolResult.rows[0].id_rol]
          );
        }
      }

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "usuario",
        operacion: "INSERT",
        idRegistro: idUsuario,
        valorNuevo: { id_usuario: idUsuario, email, roles, documento, nombres, apellidos },
        ip,
      });

      return idUsuario;
    });

    return jsonOk({ id_usuario: result, mensaje: "Usuario creado exitosamente" }, 201);
  } catch (err) {
    if (err.code === "23505") return jsonError(err.message || "El email o documento ya está registrado.", 409);
    console.error("Error creando usuario:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}
