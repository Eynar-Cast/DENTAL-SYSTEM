import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio } from "@/lib/validations";

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede registrar personal", 403);
  }

  const body = await request.json().catch(() => ({}));
  const persona = body.persona || {};
  const ip = obtenerIP(request);

  const documento = textoLimpio(persona.documento_identidad);
  const nombres = textoLimpio(persona.nombres);
  const apellidos = textoLimpio(persona.apellidos);
  const colegiatura = textoLimpio(body.numero_colegiatura);

  if (!documento) return jsonError("El documento de identidad es obligatorio", 400);
  if (!nombres) return jsonError("Los nombres son obligatorios", 400);
  if (!apellidos) return jsonError("Los apellidos son obligatorios", 400);
  if (!persona.fecha_nacimiento) return jsonError("La fecha de nacimiento es obligatoria", 400);
  if (!persona.id_ciudad) return jsonError("La ciudad es obligatoria", 400);
  if (!body.id_especialidad) return jsonError("La especialidad es obligatoria", 400);
  if (body.es_odontologo && !colegiatura) {
    return jsonError("El número de colegiatura es obligatorio para odontólogos", 400);
  }

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

      const personalResult = await client.query(
        `INSERT INTO personal (id_persona, id_especialidad, numero_colegiatura, fecha_contratacion, activo)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id_personal`,
        [
          idPersona,
          body.id_especialidad,
          body.es_odontologo ? colegiatura : null,
          body.fecha_contratacion || new Date().toISOString().slice(0, 10),
        ]
      );
      const idPersonal = personalResult.rows[0].id_personal;

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "personal",
        operacion: "INSERT",
        idRegistro: idPersonal,
        valorNuevo: { id_personal: idPersonal, id_persona: idPersona, documento, nombres, apellidos },
        ip,
      });

      return { idPersonal, idPersona };
    });

    return jsonOk(
      {
        id_personal: result.idPersonal,
        id_persona: result.idPersona,
        mensaje: "Personal registrado exitosamente",
      },
      201
    );
  } catch (err) {
    if (err.code === "23505") {
      return jsonError("El documento de identidad o número de colegiatura ya está registrado.", 409);
    }
    if (err.code === "23503") {
      return jsonError("La ciudad o especialidad seleccionada no existe.", 400);
    }
    console.error("Error registrando personal:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}
