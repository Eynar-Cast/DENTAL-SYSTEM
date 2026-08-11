import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(_request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para ver presupuestos", 403);
  }

  const { id } = await context.params;
  const idPresupuesto = Number(id);
  if (!Number.isInteger(idPresupuesto)) return jsonError("Id inválido", 400);

  const presupuestoResult = await query(
    `SELECT pr.id_presupuesto, pr.fecha_emision, pr.total, pr.estado,
            per.nombres AS paciente_nombres, per.apellidos AS paciente_apellidos,
            per.documento_identidad AS paciente_ci
     FROM presupuesto pr
     JOIN paciente pac ON pac.id_paciente = pr.id_paciente
     JOIN persona per ON per.id_persona = pac.id_persona
     WHERE pr.id_presupuesto = $1`,
    [idPresupuesto]
  );
  if (presupuestoResult.rows.length === 0) return jsonError("Presupuesto no encontrado", 404);

  const detalle = await query(
    `SELECT dp.id_procedimiento, pr.nombre AS procedimiento, dp.precio_unitario, dp.cantidad,
            (dp.precio_unitario * dp.cantidad) AS subtotal
     FROM detalle_presupuesto dp
     JOIN procedimiento pr ON pr.id_procedimiento = dp.id_procedimiento
     WHERE dp.id_presupuesto = $1`,
    [idPresupuesto]
  );

  const cobros = await query(
    `SELECT cb.id_cobro, cb.monto, cb.fecha_hora, cb.anulado, cb.motivo_anulacion,
            mp.descripcion AS metodo_pago, per.nombres AS usuario_nombres
     FROM cobro cb
     JOIN metodo_pago mp ON mp.id_metodo_pago = cb.id_metodo_pago
     JOIN usuario u ON u.id_usuario = cb.id_usuario
     JOIN persona per ON per.id_persona = u.id_persona
     WHERE cb.id_presupuesto = $1
     ORDER BY cb.fecha_hora DESC`,
    [idPresupuesto]
  );

  return jsonOk({
    presupuesto: presupuestoResult.rows[0],
    detalle: detalle.rows,
    cobros: cobros.rows,
  });
}
