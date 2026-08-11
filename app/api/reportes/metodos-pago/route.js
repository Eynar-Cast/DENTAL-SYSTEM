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
    `SELECT mp.descripcion AS metodo_pago, COUNT(*) AS cantidad, COALESCE(SUM(cb.monto),0) AS total
     FROM cobro cb
     JOIN metodo_pago mp ON mp.id_metodo_pago = cb.id_metodo_pago
     WHERE cb.anulado = FALSE
       AND ($1::date IS NULL OR cb.fecha_hora::date >= $1::date)
       AND ($2::date IS NULL OR cb.fecha_hora::date <= $2::date)
     GROUP BY mp.descripcion
     ORDER BY total DESC`,
    [desde || null, hasta || null]
  );

  return jsonOk(result.rows);
}