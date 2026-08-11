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

  // Diario
  let sqlDia = `SELECT cb.fecha_hora::date AS fecha, COALESCE(SUM(cb.monto),0) AS ingresos
                FROM cobro cb WHERE cb.anulado = FALSE`;
  const paramsDia = [];
  if (desde) { paramsDia.push(desde); sqlDia += ` AND cb.fecha_hora::date >= $${paramsDia.length}`; }
  if (hasta) { paramsDia.push(hasta); sqlDia += ` AND cb.fecha_hora::date <= $${paramsDia.length}`; }
  sqlDia += ` GROUP BY cb.fecha_hora::date ORDER BY cb.fecha_hora::date`;
  const diario = await query(sqlDia, paramsDia);

  // Mensual
  let sqlMes = `SELECT TO_CHAR(cb.fecha_hora, 'YYYY-MM') AS mes, COALESCE(SUM(cb.monto),0) AS ingresos
                  FROM cobro cb WHERE cb.anulado = FALSE`;
  const paramsMes = [];
  if (desde) { paramsMes.push(desde); sqlMes += ` AND cb.fecha_hora::date >= $${paramsMes.length}`; }
  if (hasta) { paramsMes.push(hasta); sqlMes += ` AND cb.fecha_hora::date <= $${paramsMes.length}`; }
  sqlMes += ` GROUP BY TO_CHAR(cb.fecha_hora, 'YYYY-MM') ORDER BY mes`;
  const mensual = await query(sqlMes, paramsMes);

  return jsonOk({ diario: diario.rows, mensual: mensual.rows });
}
