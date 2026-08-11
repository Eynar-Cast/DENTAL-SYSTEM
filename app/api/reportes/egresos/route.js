import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede ver reportes", 403);

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  let sqlDia = `SELECT g.fecha::date AS fecha, COALESCE(SUM(g.monto),0) AS egresos
                FROM gasto g WHERE g.anulado = FALSE`;
  const paramsDia = [];
  if (desde) { paramsDia.push(desde); sqlDia += ` AND g.fecha::date >= $${paramsDia.length}`; }
  if (hasta) { paramsDia.push(hasta); sqlDia += ` AND g.fecha::date <= $${paramsDia.length}`; }
  sqlDia += ` GROUP BY g.fecha::date ORDER BY g.fecha::date`;
  const diario = await query(sqlDia, paramsDia);

  let sqlMes = `SELECT TO_CHAR(g.fecha, 'YYYY-MM') AS mes, COALESCE(SUM(g.monto),0) AS egresos
                  FROM gasto g WHERE g.anulado = FALSE`;
  const paramsMes = [];
  if (desde) { paramsMes.push(desde); sqlMes += ` AND g.fecha::date >= $${paramsMes.length}`; }
  if (hasta) { paramsMes.push(hasta); sqlMes += ` AND g.fecha::date <= $${paramsMes.length}`; }
  sqlMes += ` GROUP BY TO_CHAR(g.fecha, 'YYYY-MM') ORDER BY mes`;
  const mensual = await query(sqlMes, paramsMes);

  return jsonOk({ diario: diario.rows, mensual: mensual.rows });
}
