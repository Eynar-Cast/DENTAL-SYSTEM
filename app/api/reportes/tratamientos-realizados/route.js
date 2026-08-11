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

  let sql = `SELECT c.fecha_hora::date AS fecha,
                    pr.nombre AS tratamiento,
                    per.nombres AS odontologo_nombres, per.apellidos AS odontologo_apellidos,
                    SUM(ap.cantidad) AS cantidad
             FROM atencion_procedimiento ap
             JOIN atencion a ON a.id_atencion = ap.id_atencion
             JOIN cita c ON c.id_cita = a.id_cita
             JOIN personal p ON p.id_personal = c.id_personal
             JOIN persona per ON per.id_persona = p.id_persona
             JOIN procedimiento pr ON pr.id_procedimiento = ap.id_procedimiento
             JOIN estado_cita e ON e.id_estado = c.id_estado
             WHERE e.descripcion = 'atendida'`;
  const params = [];
  if (desde) { params.push(desde); sql += ` AND c.fecha_hora::date >= $${params.length}`; }
  if (hasta) { params.push(hasta); sql += ` AND c.fecha_hora::date <= $${params.length}`; }
  sql += ` GROUP BY c.fecha_hora::date, pr.nombre, per.nombres, per.apellidos
           ORDER BY c.fecha_hora::date DESC, cantidad DESC`;

  const result = await query(sql, params);
  return jsonOk(result.rows);
}
