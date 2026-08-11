import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede ver reportes", 403);

  const result = await query(
    `SELECT TO_CHAR(cb.fecha_hora, 'YYYY-MM') AS mes, COALESCE(SUM(cb.monto),0) AS ingresos
     FROM cobro cb
     WHERE cb.anulado = FALSE
     GROUP BY TO_CHAR(cb.fecha_hora, 'YYYY-MM')
     ORDER BY mes DESC LIMIT 12`
  );

  return jsonOk(result.rows.reverse());
}
