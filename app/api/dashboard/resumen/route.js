import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);

  // Solo admin y recepción ven las cifras financieras
  const finanzas = requireRoles(session, ["admin", "recepcionista"]);

  // Citas del día
  const citasDia = await query(
    `SELECT c.id_cita, c.motivo, c.fecha_hora, e.descripcion AS estado,
            per_pac.nombres AS paciente_nombres, per_pac.apellidos AS paciente_apellidos,
            per_odo.nombres AS odontologo_nombres, per_odo.apellidos AS odontologo_apellidos
     FROM cita c
     JOIN estado_cita e ON e.id_estado = c.id_estado
     JOIN paciente pac ON pac.id_paciente = c.id_paciente
     JOIN persona per_pac ON per_pac.id_persona = pac.id_persona
     JOIN personal pe ON pe.id_personal = c.id_personal
     JOIN persona per_odo ON per_odo.id_persona = pe.id_persona
     WHERE c.fecha_hora::date = CURRENT_DATE
     ORDER BY c.fecha_hora`
  );

  const citasHoy = citasDia.rows;
  const atendidosHoy = citasHoy.filter((c) => c.estado === "atendida").length;

  const resumenResult = await query(
    `SELECT
       (SELECT COALESCE(SUM(monto),0) FROM cobro WHERE fecha_hora::date = CURRENT_DATE AND anulado = FALSE) AS ingresos_dia,
       (SELECT COALESCE(SUM(monto),0) FROM gasto WHERE fecha::date = CURRENT_DATE AND anulado = FALSE) AS egresos_dia,
       (SELECT COUNT(*) FROM paciente WHERE activo = TRUE) AS pacientes_activos,
       (SELECT COUNT(*) FROM cita WHERE fecha_hora::date = CURRENT_DATE AND id_estado = (SELECT id_estado FROM estado_cita WHERE descripcion = 'agendada')) AS citas_agendadas_hoy`
  );

  const r = resumenResult.rows[0];

  let ingresosDia = null;
  let egresosDia = null;
  let cajaInfo = null;
  if (finanzas) {
    ingresosDia = Number(r.ingresos_dia);
    egresosDia = Number(r.egresos_dia);

    const caja = await query(
      `SELECT c.*, per.nombres AS usuario_nombres, per.apellidos AS usuario_apellidos
       FROM caja c JOIN usuario u ON u.id_usuario = c.id_usuario_apertura
       JOIN persona per ON per.id_persona = u.id_persona
       WHERE c.estado = 'abierta' ORDER BY c.id_caja DESC LIMIT 1`
    );
    cajaInfo = caja.rows[0]
      ? {
          id_caja: caja.rows[0].id_caja,
          estado: "abierta",
          monto_inicial: Number(caja.rows[0].monto_inicial),
          usuario: `${caja.rows[0].usuario_nombres} ${caja.rows[0].usuario_apellidos || ""}`,
        }
      : null;
  }

  const tratamientos = await query(
    `SELECT pr.nombre AS tratamiento, SUM(ap.cantidad) AS total
     FROM atencion_procedimiento ap
     JOIN procedimiento pr ON pr.id_procedimiento = ap.id_procedimiento
     GROUP BY pr.nombre ORDER BY total DESC LIMIT 5`
  );

  const proximasCitas = await query(
    `SELECT c.id_cita, c.fecha_hora, c.motivo,
            per_pac.nombres AS paciente_nombres, per_pac.apellidos AS paciente_apellidos,
            per_odo.nombres AS odontologo_nombres, per_odo.apellidos AS odontologo_apellidos
     FROM cita c
     JOIN estado_cita e ON e.id_estado = c.id_estado
     JOIN paciente pac ON pac.id_paciente = c.id_paciente
     JOIN persona per_pac ON per_pac.id_persona = pac.id_persona
     JOIN personal pe ON pe.id_personal = c.id_personal
     JOIN persona per_odo ON per_odo.id_persona = pe.id_persona
     WHERE c.fecha_hora >= NOW() AND e.descripcion = 'agendada'
     ORDER BY c.fecha_hora LIMIT 5`
  );

  return jsonOk({
    finanzas,
    citas_hoy: citasHoy,
    total_citas_hoy: citasHoy.length,
    pacientes_atendidos_hoy: atendidosHoy,
    citas_agendadas_hoy: Number(r.citas_agendadas_hoy),
    ingresos_dia: ingresosDia,
    egresos_dia: egresosDia,
    utilidad_dia: ingresosDia !== null && egresosDia !== null ? ingresosDia - egresosDia : null,
    pacientes_activos: Number(r.pacientes_activos),
    caja: cajaInfo,
    tratamientos_mas_realizados: tratamientos.rows,
    proximas_citas: proximasCitas.rows,
  });
}
