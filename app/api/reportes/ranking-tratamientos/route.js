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
    `SELECT pr.nombre AS tratamiento, SUM(ap.cantidad) AS total
     FROM atencion_procedimiento ap
     JOIN atencion a ON a.id_atencion = ap.id_atencion
     JOIN cita c ON c.id_cita = a.id_cita
     JOIN estado_cita e ON e.id_estado = c.id_estado
     JOIN procedimiento pr ON pr.id_procedimiento = ap.id_procedimiento
     WHERE e.descripcion = 'atendida'
       AND ($1::date IS NULL OR c.fecha_hora::date >= $1::date)
       AND ($2::date IS NULL OR c.fecha_hora::date <= $2::date)
     GROUP BY pr.nombre
     ORDER BY total DESC
     LIMIT 10`,
    [desde || null, hasta || null]
  );

  return jsonOk(result.rows);
}