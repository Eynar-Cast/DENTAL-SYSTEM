import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { validarRangoFechas } from "@/lib/validations";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede ver reportes", 403);

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const errFechas = validarRangoFechas(desde, hasta);
  if (errFechas) return jsonError(errFechas, 400);

  const result = await query(
    `SELECT TO_CHAR(cb.fecha_hora, 'YYYY-MM') AS mes, COALESCE(SUM(cb.monto),0) AS ingresos
     FROM cobro cb
     WHERE cb.anulado = FALSE
       AND ($1::date IS NULL OR cb.fecha_hora::date >= $1::date)
       AND ($2::date IS NULL OR cb.fecha_hora::date <= $2::date)
     GROUP BY TO_CHAR(cb.fecha_hora, 'YYYY-MM')
     ORDER BY mes DESC LIMIT 12`,
    [desde || null, hasta || null]
  );

  return jsonOk(result.rows.reverse());
}