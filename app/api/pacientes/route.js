import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { requerido, esEmail, textoLimpio } from "@/lib/validations";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista", "odontologo"])) {
    return jsonError("No tienes permisos para ver pacientes", 403);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  let result;
  if (q) {
    result = await query(
      `SELECT pac.id_paciente, per.documento_identidad, per.nombres, per.apellidos,
              per.fecha_nacimiento, gs.descripcion AS grupo_sanguineo, pac.activo
       FROM paciente pac
       JOIN persona per ON per.id_persona = pac.id_persona
       LEFT JOIN grupo_sanguineo gs ON gs.id_grupo_sanguineo = pac.id_grupo_sanguineo
       WHERE LOWER(per.nombres) LIKE '%' || $1 || '%'
          OR LOWER(per.apellidos) LIKE '%' || $1 || '%'
          OR LOWER(per.documento_identidad) LIKE '%' || $1 || '%'
       ORDER BY per.apellidos, per.nombres
       LIMIT 200`,
      [q]
    );
  } else {
    result = await query(
      `SELECT pac.id_paciente, per.documento_identidad, per.nombres, per.apellidos,
              per.fecha_nacimiento, gs.descripcion AS grupo_sanguineo, pac.activo
       FROM paciente pac
       JOIN persona per ON per.id_persona = pac.id_persona
       LEFT JOIN grupo_sanguineo gs ON gs.id_grupo_sanguineo = pac.id_grupo_sanguineo
       ORDER BY per.apellidos, per.nombres
       LIMIT 200`
    );
  }

  return jsonOk(result.rows);
}

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para crear pacientes", 403);
  }

  const body = await request.json().catch(() => ({}));
  const persona = body.persona || {};
  const ip = obtenerIP(request);

  const documento = textoLimpio(persona.documento_identidad);
  const nombres = textoLimpio(persona.nombres);
  const apellidos = textoLimpio(persona.apellidos);

  if (!documento) return jsonError("El documento de identidad es obligatorio", 400);
  if (!nombres) return jsonError("Los nombres son obligatorios", 400);
  if (!apellidos) return jsonError("Los apellidos son obligatorios", 400);
  if (!persona.fecha_nacimiento) return jsonError("La fecha de nacimiento es obligatoria", 400);
  if (!persona.id_ciudad) return jsonError("La ciudad es obligatoria", 400);

  const telefonos = Array.isArray(body.telefonos) ? body.telefonos : [];

  try {
    const result = await withTransaction(async (client) => {
      const personaResult = await client.query(
        `INSERT INTO persona (documento_identidad, nombres, apellidos, fecha_nacimiento, id_ciudad, direccion_calle)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id_persona`,
        [
          documento,
          nombres,
          apellidos,
          persona.fecha_nacimiento,
          persona.id_ciudad,
          persona.direccion_calle || null,
        ]
      );
      const idPersona = personaResult.rows[0].id_persona;

      for (const tel of telefonos) {
        const t = textoLimpio(tel);
        if (!t) continue;
        await client.query(
          `INSERT INTO telefono_persona (id_persona, numero_telefono) VALUES ($1, $2)`,
          [idPersona, t]
        );
      }

      const pacResult = await client.query(
        `INSERT INTO paciente (id_persona, id_grupo_sanguineo, activo)
         VALUES ($1, $2, TRUE)
         RETURNING id_paciente`,
        [idPersona, body.id_grupo_sanguineo || null]
      );
      const idPaciente = pacResult.rows[0].id_paciente;

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "paciente",
        operacion: "INSERT",
        idRegistro: idPaciente,
        valorNuevo: { id_paciente: idPaciente, documento, nombres, apellidos },
        ip,
      });

      return idPaciente;
    });

    return jsonOk({ id_paciente: result, mensaje: "Paciente creado exitosamente" }, 201);
  } catch (err) {
    if (err.code === "23505") {
      return jsonError("El documento de identidad ya está registrado.", 409);
    }
    if (err.code === "23503") {
      return jsonError("La ciudad o grupo sanguíneo seleccionado no existe.", 400);
    }
    console.error("Error creando paciente:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}
