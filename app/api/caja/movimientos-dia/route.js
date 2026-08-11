import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para ver la caja", 403);
  }

  const cajaResult = await query(
    `SELECT id_caja FROM caja WHERE estado = 'abierta' ORDER BY id_caja DESC LIMIT 1`
  );

  // Si no hay caja abierta, se muestran los movimientos de hoy.
  // Se incluyen los anulados para que la vista refleje el estado real y el
  // historial de anulaciones de la jornada.
  let whereCobro = `DATE(fecha_hora) = CURRENT_DATE`;
  let whereGasto = `DATE(fecha) = CURRENT_DATE`;
  let params = [];
  if (cajaResult.rows.length > 0) {
    params = [cajaResult.rows[0].id_caja];
    whereCobro = `id_caja = $1`;
    whereGasto = `id_caja = $1`;
  }

  const cobros = await query(
    `SELECT cb.id_cobro, 'cobro' AS tipo, cb.monto, cb.fecha_hora, cb.anulado,
            mp.descripcion AS metodo_pago, pr.estado AS presupuesto_estado,
            per.nombres AS paciente_nombres, per.apellidos AS paciente_apellidos
     FROM cobro cb
     JOIN metodo_pago mp ON mp.id_metodo_pago = cb.id_metodo_pago
     JOIN presupuesto pr ON pr.id_presupuesto = cb.id_presupuesto
     JOIN paciente pac ON pac.id_paciente = pr.id_paciente
     JOIN persona per ON per.id_persona = pac.id_persona
     WHERE ${whereCobro}
     ORDER BY cb.fecha_hora DESC LIMIT 200`,
    params
  );

  const gastos = await query(
    `SELECT g.id_gasto, 'gasto' AS tipo, g.monto, g.fecha AS fecha_hora, g.anulado,
            cg.nombre AS categoria, g.motivo
     FROM gasto g
     JOIN categoria_gasto cg ON cg.id_categoria = g.id_categoria
     WHERE ${whereGasto}
     ORDER BY g.fecha DESC LIMIT 200`,
    params
  );

  const movimientos = [
    ...cobros.rows.map((r) => ({ ...r, fecha_hora: r.fecha_hora, monto: Number(r.monto) })),
    ...gastos.rows.map((r) => ({ ...r, fecha_hora: r.fecha_hora, monto: Number(r.monto) })),
  ].sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

  return jsonOk({ movimientos, id_caja: cajaResult.rows[0]?.id_caja || null });
}
