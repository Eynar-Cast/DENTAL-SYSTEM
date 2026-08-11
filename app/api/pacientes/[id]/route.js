import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(_request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista", "odontologo"])) {
    return jsonError("No tienes permisos para ver pacientes", 403);
  }

  const { id } = await context.params;
  const idPaciente = Number(id);
  if (!Number.isInteger(idPaciente)) return jsonError("Id de paciente inválido", 400);

  const pacResult = await query(
    `SELECT pac.id_paciente, pac.activo, gs.descripcion AS grupo_sanguineo,
            per.documento_identidad, per.nombres, per.apellidos, per.fecha_nacimiento,
            per.direccion_calle, cid.id_ciudad, cid.nombre_ciudad, pai.nombre_pais
     FROM paciente pac
     JOIN persona per ON per.id_persona = pac.id_persona
     LEFT JOIN grupo_sanguineo gs ON gs.id_grupo_sanguineo = pac.id_grupo_sanguineo
     LEFT JOIN ciudad cid ON cid.id_ciudad = per.id_ciudad
     LEFT JOIN pais pai ON pai.id_pais = cid.id_pais
     WHERE pac.id_paciente = $1`,
    [idPaciente]
  );

  if (pacResult.rows.length === 0) {
    return jsonError("Paciente no encontrado", 404);
  }

  const paciente = pacResult.rows[0];

  const telefonosResult = await query(
    `SELECT numero_telefono FROM telefono_persona WHERE id_persona = (
       SELECT id_persona FROM paciente WHERE id_paciente = $1)`,
    [idPaciente]
  );
  paciente.telefonos = telefonosResult.rows.map((r) => r.numero_telefono);

  const citasResult = await query(
    `SELECT c.id_cita, c.motivo, c.fecha_hora, e.descripcion AS estado,
            per.nombres AS odontologo_nombres, per.apellidos AS odontologo_apellidos
     FROM cita c
     JOIN estado_cita e ON e.id_estado = c.id_estado
     JOIN personal p ON p.id_personal = c.id_personal
     JOIN persona per ON per.id_persona = p.id_persona
     WHERE c.id_paciente = $1
     ORDER BY c.fecha_hora DESC`,
    [idPaciente]
  );

  const atencionesResult = await query(
    `SELECT a.id_atencion, a.id_cita, a.motivo_consulta, a.sintomas_referidos, a.notas_odontologo,
            c.fecha_hora,
            per.nombres AS odontologo_nombres, per.apellidos AS odontologo_apellidos
     FROM atencion a
     JOIN cita c ON c.id_cita = a.id_cita
     JOIN personal p ON p.id_personal = c.id_personal
     JOIN persona per ON per.id_persona = p.id_persona
     WHERE c.id_paciente = $1
     ORDER BY c.fecha_hora DESC`,
    [idPaciente]
  );

  const atencionesIds = atencionesResult.rows.map((a) => a.id_atencion);
  let procedimientos = [];
  let diagnosticos = [];
  let signos = [];
  if (atencionesIds.length > 0) {
    const procResult = await query(
      `SELECT ap.id_atencion, pr.nombre AS procedimiento, ap.cantidad, pr.precio_actual
       FROM atencion_procedimiento ap
       JOIN procedimiento pr ON pr.id_procedimiento = ap.id_procedimiento
       WHERE ap.id_atencion = ANY($1)`,
      [atencionesIds]
    );
    procedimientos = procResult.rows;

    const diagResult = await query(
      `SELECT da.id_atencion, da.codigo_diagnostico, cd.descripcion, da.observaciones
       FROM diagnostico_atencion da
       JOIN catalogo_diagnostico cd ON cd.codigo_diagnostico = da.codigo_diagnostico
       WHERE da.id_atencion = ANY($1)`,
      [atencionesIds]
    );
    diagnosticos = diagResult.rows;

    const signoResult = await query(
      `SELECT sv.id_atencion, tsv.nombre AS tipo, tsv.unidad, sv.valor
       FROM signo_vital sv
       JOIN tipo_signo_vital tsv ON tsv.id_tipo = sv.id_tipo
       WHERE sv.id_atencion = ANY($1)`,
      [atencionesIds]
    );
    signos = signoResult.rows;
  }

  const presupuestosResult = await query(
    `SELECT p.id_presupuesto, p.fecha_emision, p.total, p.estado
     FROM presupuesto p
     WHERE p.id_paciente = $1
     ORDER BY p.fecha_emision DESC`,
    [idPaciente]
  );

  const presupuestosIds = presupuestosResult.rows.map((p) => p.id_presupuesto);
  let detallesPresupuesto = [];
  if (presupuestosIds.length > 0) {
    const detResult = await query(
      `SELECT dp.id_presupuesto, pr.nombre AS procedimiento, dp.precio_unitario, dp.cantidad
       FROM detalle_presupuesto dp
       JOIN procedimiento pr ON pr.id_procedimiento = dp.id_procedimiento
       WHERE dp.id_presupuesto = ANY($1)`,
      [presupuestosIds]
    );
    detallesPresupuesto = detResult.rows;
  }

  return jsonOk({
    paciente,
    citas: citasResult.rows,
    atenciones: atencionesResult.rows.map((a) => ({
      ...a,
      procedimientos: procedimientos.filter((p) => p.id_atencion === a.id_atencion),
      diagnosticos: diagnosticos.filter((d) => d.id_atencion === a.id_atencion),
      signos_vitales: signos.filter((s) => s.id_atencion === a.id_atencion),
    })),
    presupuestos: presupuestosResult.rows.map((p) => ({
      ...p,
      detalle: detallesPresupuesto.filter((d) => d.id_presupuesto === p.id_presupuesto),
    })),
  });
}
