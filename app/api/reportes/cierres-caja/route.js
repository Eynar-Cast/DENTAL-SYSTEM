import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede ver reportes", 403);

  const result = await query(
    `SELECT c.id_caja, c.fecha_apertura, c.fecha_cierre, c.monto_inicial,
            c.monto_declarado_cierre, c.diferencia,
            (SELECT COALESCE(SUM(cb.monto),0) FROM cobro cb WHERE cb.id_caja = c.id_caja AND cb.anulado = FALSE) AS ingresos,
            (SELECT COALESCE(SUM(g.monto),0) FROM gasto g WHERE g.id_caja = c.id_caja AND g.anulado = FALSE) AS egresos
     FROM caja c
     WHERE c.estado = 'cerrada'
     ORDER BY c.fecha_cierre DESC LIMIT 50`
  );

  return jsonOk(result.rows);
}
