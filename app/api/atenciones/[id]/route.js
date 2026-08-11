import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(_request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "odontologo"])) {
    return jsonError("Sin permisos", 403);
  }

  const { id } = await context.params;
  const idAtencion = Number(id);
  if (!Number.isInteger(idAtencion)) return jsonError("Id inválido", 400);

  const atenResult = await query(
    `SELECT a.id_atencion, a.motivo_consulta, a.sintomas_referidos, a.notas_odontologo,
            c.id_cita, c.fecha_hora, c.motivo AS motivo_cita,
            per_pac.nombres AS paciente_nombres, per_pac.apellidos AS paciente_apellidos,
            per_odo.nombres AS odontologo_nombres, per_odo.apellidos AS odontologo_apellidos
     FROM atencion a
     JOIN cita c ON c.id_cita = a.id_cita
     JOIN paciente pac ON pac.id_paciente = c.id_paciente
     JOIN persona per_pac ON per_pac.id_persona = pac.id_persona
     JOIN personal pe ON pe.id_personal = c.id_personal
     JOIN persona per_odo ON per_odo.id_persona = pe.id_persona
     WHERE a.id_atencion = $1`,
    [idAtencion]
  );
  if (atenResult.rows.length === 0) return jsonError("Atención no encontrada", 404);

  const atencion = atenResult.rows[0];

  const signos = await query(
    `SELECT sv.id_signo, tsv.nombre AS tipo, tsv.unidad, sv.valor
     FROM signo_vital sv JOIN tipo_signo_vital tsv ON tsv.id_tipo = sv.id_tipo
     WHERE sv.id_atencion = $1`,
    [idAtencion]
  );

  const diagnosticos = await query(
    `SELECT da.codigo_diagnostico, cd.descripcion, da.observaciones
     FROM diagnostico_atencion da JOIN catalogo_diagnostico cd
       ON cd.codigo_diagnostico = da.codigo_diagnostico
     WHERE da.id_atencion = $1`,
    [idAtencion]
  );

  const procedimientos = await query(
    `SELECT ap.id_procedimiento, pr.nombre AS procedimiento, ap.cantidad, pr.precio_actual
     FROM atencion_procedimiento ap JOIN procedimiento pr ON pr.id_procedimiento = ap.id_procedimiento
     WHERE ap.id_atencion = $1`,
    [idAtencion]
  );

  return jsonOk({
    atencion,
    signos_vitales: signos.rows,
    diagnosticos: diagnosticos.rows,
    procedimientos: procedimientos.rows,
  });
}
