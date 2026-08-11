import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede ver reportes", 403);

  const result = await query(
    `SELECT pr.nombre AS tratamiento, SUM(ap.cantidad) AS total
     FROM atencion_procedimiento ap
     JOIN procedimiento pr ON pr.id_procedimiento = ap.id_procedimiento
     GROUP BY pr.nombre
     ORDER BY total DESC
     LIMIT 10`
  );

  return jsonOk(result.rows);
}
