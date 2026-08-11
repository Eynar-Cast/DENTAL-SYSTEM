import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio, esFechaISO } from "@/lib/validations";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista", "odontologo"])) {
    return jsonError("No tienes permisos para ver citas", 403);
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const fecha = searchParams.get("fecha");
  const idPersonal = searchParams.get("id_personal");
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (fecha && !esFechaISO(fecha)) return jsonError("La fecha no es válida", 400);

  let sql = `SELECT c.id_cita, c.motivo, c.fecha_hora,
                    e.id_estado, e.descripcion AS estado,
                    pac.id_paciente,
                    per_pac.documento_identidad AS paciente_ci,
                    per_pac.nombres AS paciente_nombres,
                    per_pac.apellidos AS paciente_apellidos,
                    per_pers.nombres AS odontologo_nombres,
                    per_pers.apellidos AS odontologo_apellidos
             FROM cita c
             JOIN estado_cita e ON e.id_estado = c.id_estado
             JOIN paciente pac ON pac.id_paciente = c.id_paciente
             JOIN persona per_pac ON per_pac.id_persona = pac.id_persona
             JOIN personal pe ON pe.id_personal = c.id_personal
             JOIN persona per_pers ON per_pers.id_persona = pe.id_persona
             WHERE 1=1`;

  const params = [];
  if (estado) {
    params.push(estado);
    sql += ` AND LOWER(e.descripcion) = LOWER($${params.length})`;
  }
  if (fecha) {
    params.push(fecha);
    sql += ` AND c.fecha_hora::date = $${params.length}`;
  }
  if (idPersonal) {
    params.push(Number(idPersonal));
    sql += ` AND c.id_personal = $${params.length}`;
  }
  // El odontólogo solo ve su propia agenda por defecto
  if (!idPersonal && requireRoles(session, ["odontologo"]) && !requireRoles(session, ["admin"])) {
    const personalResult = await query(
      `SELECT id_personal FROM personal WHERE id_persona = $1`,
      [session.idPersona || null]
    );
    if (personalResult.rows.length > 0) {
      params.push(personalResult.rows[0].id_personal);
      sql += ` AND c.id_personal = $${params.length}`;
    }
  }

  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    sql += ` AND (LOWER(per_pac.nombres) LIKE $${idx} OR LOWER(per_pac.apellidos) LIKE $${idx}
                  OR LOWER(per_pers.nombres) LIKE $${idx} OR LOWER(per_pers.apellidos) LIKE $${idx})`;
  }

  sql += ` ORDER BY c.fecha_hora DESC LIMIT 200`;

  const result = await query(sql, params);
  return jsonOk(result.rows);
}

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para agendar citas", 403);
  }

  const body = await request.json().catch(() => ({}));
  const ip = obtenerIP(request);

  const idPaciente = Number(body.id_paciente);
  const idPersonal = Number(body.id_personal);
  const fechaHora = body.fecha_hora;
  const motivo = textoLimpio(body.motivo);

  if (!Number.isInteger(idPaciente)) return jsonError("Selecciona un paciente", 400);
  if (!Number.isInteger(idPersonal)) return jsonError("Selecciona un odontólogo", 400);
  if (!fechaHora || isNaN(Date.parse(fechaHora))) {
    return jsonError("Fecha y hora de la cita son obligatorias", 400);
  }
  if (!motivo) return jsonError("El motivo de la cita es obligatorio", 400);

  try {
    const result = await query(
      `INSERT INTO cita (id_paciente, id_personal, motivo, fecha_hora, id_estado)
       VALUES ($1, $2, $3, $4, (SELECT id_estado FROM estado_cita WHERE descripcion = 'agendada'))
       RETURNING id_cita`,
      [idPaciente, idPersonal, motivo, new Date(fechaHora).toISOString()]
    );

    const idCita = result.rows[0].id_cita;

    await registrarAuditoria({
      idUsuario: session.idUsuario,
      idSesion: session.idSesion,
      tabla: "cita",
      operacion: "INSERT",
      idRegistro: idCita,
      valorNuevo: { id_cita: idCita, id_paciente: idPaciente, id_personal: idPersonal, fecha_hora: fechaHora },
      ip,
    });

    return jsonOk({ id_cita: idCita, mensaje: "Cita creada exitosamente" }, 201);
  } catch (err) {
    if (err.code === "23505") {
      return jsonError("El odontólogo ya tiene una cita en ese horario. Selecciona otra hora.", 409);
    }
    if (err.code === "23503") {
      return jsonError("El paciente o el odontólogo seleccionado no existe.", 400);
    }
    console.error("Error creando cita:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}
