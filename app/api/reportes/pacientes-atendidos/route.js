import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const ROLES = ["admin"];

async function adminSession() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ROLES)) return jsonError("Solo el administrador puede ver reportes", 403);
  return session;
}

export async function GET(request) {
  const session = await adminSession();
  if (session instanceof Response) return session;

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  let sql = `SELECT c.fecha_hora::date AS fecha, COUNT(DISTINCT c.id_paciente) AS pacientes,
                    COUNT(*) AS citas_atendidas
             FROM cita c
             JOIN estado_cita e ON e.id_estado = c.id_estado
             WHERE e.descripcion = 'atendida'`;
  const params = [];
  if (desde) { params.push(desde); sql += ` AND c.fecha_hora::date >= $${params.length}`; }
  if (hasta) { params.push(hasta); sql += ` AND c.fecha_hora::date <= $${params.length}`; }
  sql += ` GROUP BY c.fecha_hora::date ORDER BY c.fecha_hora::date`;

  const result = await query(sql, params);
  return jsonOk(result.rows);
}
