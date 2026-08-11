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
  let sqlDia = `SELECT d.fecha,
                       COALESCE(i.ingresos, 0) AS ingresos,
                       COALESCE(e.egresos, 0) AS egresos,
                       COALESCE(i.ingresos, 0) - COALESCE(e.egresos, 0) AS utilidad
                FROM (
                  SELECT d.fecha::date AS fecha FROM generate_series(
                    COALESCE($1::date, CURRENT_DATE - INTERVAL '30 days'),
                    COALESCE($2::date, CURRENT_DATE),
                    '1 day'
                  ) d(fecha)
                ) d
                LEFT JOIN (
                  SELECT cb.fecha_hora::date AS fecha, SUM(cb.monto) AS ingresos
                  FROM cobro cb WHERE cb.anulado = FALSE GROUP BY cb.fecha_hora::date
                ) i ON i.fecha = d.fecha
                LEFT JOIN (
                  SELECT g.fecha::date AS fecha, SUM(g.monto) AS egresos
                  FROM gasto g WHERE g.anulado = FALSE GROUP BY g.fecha::date
                ) e ON e.fecha = d.fecha
                WHERE COALESCE(i.ingresos, 0) + COALESCE(e.egresos, 0) > 0
                ORDER BY d.fecha`;
  const diario = await query(sqlDia, [desde || null, hasta || null]);

  // Mensual
  const paramsMes = [];
  let sqlCobros = `SELECT TO_CHAR(cb.fecha_hora, 'YYYY-MM') AS mes, SUM(cb.monto) AS ingresos
                   FROM cobro cb WHERE cb.anulado = FALSE`;
  if (desde) { paramsMes.push(desde); sqlCobros += ` AND cb.fecha_hora::date >= $${paramsMes.length}`; }
  if (hasta) { paramsMes.push(hasta); sqlCobros += ` AND cb.fecha_hora::date <= $${paramsMes.length}`; }
  sqlCobros += ` GROUP BY 1`;

  let sqlGastos = `SELECT TO_CHAR(g.fecha, 'YYYY-MM') AS mes, SUM(g.monto) AS egresos
                   FROM gasto g WHERE g.anulado = FALSE`;
  if (desde) { paramsMes.push(desde); sqlGastos += ` AND g.fecha::date >= $${paramsMes.length}`; }
  if (hasta) { paramsMes.push(hasta); sqlGastos += ` AND g.fecha::date <= $${paramsMes.length}`; }
  sqlGastos += ` GROUP BY 1`;

  const sqlMes = `SELECT COALESCE(i.mes, e.mes) AS mes,
                         COALESCE(i.ingresos, 0) AS ingresos,
                         COALESCE(e.egresos, 0) AS egresos,
                         COALESCE(i.ingresos, 0) - COALESCE(e.egresos, 0) AS utilidad
                  FROM (${sqlCobros}) i
                  FULL JOIN (${sqlGastos}) e ON e.mes = i.mes
                  ORDER BY mes`;
  const mensual = await query(sqlMes, paramsMes);

  return jsonOk({ diario: diario.rows, mensual: mensual.rows });
}
