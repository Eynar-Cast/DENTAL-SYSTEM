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
    `SELECT c.*, per.nombres AS usuario_nombres, per.apellidos AS usuario_apellidos
     FROM caja c
     JOIN usuario u ON u.id_usuario = c.id_usuario_apertura
     JOIN persona per ON per.id_persona = u.id_persona
     WHERE c.estado = 'abierta'
     ORDER BY c.id_caja DESC LIMIT 1`
  );

  if (cajaResult.rows.length === 0) {
    return jsonOk({ estado: "cerrada", caja: null, ingresos_dia: 0, egresos_dia: 0 });
  }

  const caja = cajaResult.rows[0];

  const ingresosResult = await query(
    `SELECT COALESCE(SUM(monto), 0) AS total FROM cobro WHERE id_caja = $1 AND anulado = FALSE`,
    [caja.id_caja]
  );
  const egresosResult = await query(
    `SELECT COALESCE(SUM(monto), 0) AS total FROM gasto WHERE id_caja = $1 AND anulado = FALSE`,
    [caja.id_caja]
  );

  const ingresos = Number(ingresosResult.rows[0].total);
  const egresos = Number(egresosResult.rows[0].total);

  return jsonOk({
    estado: "abierta",
    caja: {
      ...caja,
      monto_inicial: Number(caja.monto_inicial),
      fecha_apertura: caja.fecha_apertura,
      usuario_nombres: caja.usuario_nombres,
      usuario_apellidos: caja.usuario_apellidos,
    },
    ingresos_dia: ingresos,
    egresos_dia: egresos,
    saldo_esperado: Number(caja.monto_inicial) + ingresos - egresos,
  });
}
