import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio } from "@/lib/validations";

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["odontologo", "admin"])) {
    return jsonError("Solo el odontólogo puede registrar atenciones", 403);
  }

  const body = await request.json().catch(() => ({}));
  const atencion = body.atencion || {};
  const ip = obtenerIP(request);

  const idCita = Number(atencion.id_cita);
  if (!Number.isInteger(idCita)) return jsonError("Selecciona una cita atendida", 400);

  const motivoConsulta = textoLimpio(atencion.motivo_consulta);
  const sintomas = textoLimpio(atencion.sintomas_referidos);
  const notas = textoLimpio(atencion.notas_odontologo);
  if (!motivoConsulta) return jsonError("El motivo de consulta es obligatorio", 400);

  // Solo sobre citas en estado 'atendida'
  const citaResult = await query(
    `SELECT c.id_cita, c.id_paciente, e.descripcion AS estado FROM cita c
     JOIN estado_cita e ON e.id_estado = c.id_estado WHERE c.id_cita = $1`,
    [idCita]
  );
  if (citaResult.rows.length === 0) return jsonError("La cita no existe", 404);
  if (citaResult.rows[0].estado !== "atendida") {
    return jsonError("La cita debe estar en estado 'atendida' para registrar la atención", 400);
  }

  // Ya existe una atención para esta cita
  const existente = await query(`SELECT id_atencion FROM atencion WHERE id_cita = $1`, [idCita]);
  if (existente.rows.length > 0) {
    return jsonError("Esta cita ya tiene una atención registrada", 409);
  }

  const signos = Array.isArray(body.signos_vitales) ? body.signos_vitales : [];
  const diagnosticos = Array.isArray(body.diagnosticos) ? body.diagnosticos : [];
  const procedimientos = Array.isArray(body.procedimientos) ? body.procedimientos : [];

  try {
    const result = await withTransaction(async (client) => {
      const atenResult = await client.query(
        `INSERT INTO atencion (id_cita, motivo_consulta, sintomas_referidos, notas_odontologo)
         VALUES ($1, $2, $3, $4)
         RETURNING id_atencion`,
        [idCita, motivoConsulta, sintomas, notas]
      );
      const idAtencion = atenResult.rows[0].id_atencion;

      for (const sv of signos) {
        if (!sv.id_tipo || sv.valor === undefined) continue;
        await client.query(
          `INSERT INTO signo_vital (id_atencion, id_tipo, valor) VALUES ($1, $2, $3)`,
          [idAtencion, sv.id_tipo, Number(sv.valor)]
        );
      }

      for (const dx of diagnosticos) {
        if (!dx.codigo_diagnostico) continue;
        await client.query(
          `INSERT INTO diagnostico_atencion (id_atencion, codigo_diagnostico, observaciones)
           VALUES ($1, $2, $3)`,
          [idAtencion, dx.codigo_diagnostico, dx.observaciones || null]
        );
      }

      for (const proc of procedimientos) {
        if (!proc.id_procedimiento || !proc.cantidad) continue;
        await client.query(
          `INSERT INTO atencion_procedimiento (id_atencion, id_procedimiento, cantidad)
           VALUES ($1, $2, $3)`,
          [idAtencion, proc.id_procedimiento, Number(proc.cantidad)]
        );
      }

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "atencion",
        operacion: "INSERT",
        idRegistro: idAtencion,
        valorNuevo: {
          id_atencion: idAtencion,
          id_cita: idCita,
          motivo_consulta: motivoConsulta,
          procedimientos: procedimientos.length,
          diagnosticos: diagnosticos.length,
        },
        ip,
      });

      return idAtencion;
    });

    return jsonOk({ id_atencion: result, mensaje: "Atención registrada" }, 201);
  } catch (err) {
    if (err.code === "23503") {
      return jsonError("Código de diagnóstico o procedimiento no válido.", 400);
    }
    if (err.code === "23505") {
      return jsonError("Un signo vital ya fue registrado en esta atención.", 409);
    }
    console.error("Error registrando atención:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "odontologo"])) {
    return jsonError("No tienes permisos para ver atenciones", 403);
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  let sql = `SELECT a.id_atencion, a.motivo_consulta, c.fecha_hora,
                    per_pac.nombres AS paciente_nombres, per_pac.apellidos AS paciente_apellidos,
                    per_odo.nombres AS odontologo_nombres, per_odo.apellidos AS odontologo_apellidos
             FROM atencion a
             JOIN cita c ON c.id_cita = a.id_cita
             JOIN paciente pac ON pac.id_paciente = c.id_paciente
             JOIN persona per_pac ON per_pac.id_persona = pac.id_persona
             JOIN personal pe ON pe.id_personal = c.id_personal
             JOIN persona per_odo ON per_odo.id_persona = pe.id_persona
             WHERE 1=1`;
  const params = [];
  if (desde) {
    params.push(desde);
    sql += ` AND c.fecha_hora::date >= $${params.length}`;
  }
  if (hasta) {
    params.push(hasta);
    sql += ` AND c.fecha_hora::date <= $${params.length}`;
  }
  sql += ` ORDER BY c.fecha_hora DESC LIMIT 200`;

  const result = await query(sql, params);
  return jsonOk(result.rows);
}
