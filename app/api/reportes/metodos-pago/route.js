import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede ver reportes", 403);

  const result = await query(
    `SELECT mp.descripcion AS metodo_pago, COUNT(*) AS cantidad, COALESCE(SUM(cb.monto),0) AS total
     FROM cobro cb
     JOIN metodo_pago mp ON mp.id_metodo_pago = cb.id_metodo_pago
     WHERE cb.anulado = FALSE
     GROUP BY mp.descripcion
     ORDER BY total DESC`
  );

  return jsonOk(result.rows);
}
