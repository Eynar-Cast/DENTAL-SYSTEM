import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede ver las sesiones", 403);

  const { searchParams } = new URL(request.url);
  const idUsuario = searchParams.get("id_usuario");

  let sql = `SELECT s.id_sesion, s.fecha_inicio, s.fecha_fin, s.ip_origen, s.user_agent, s.estado,
                    u.email, per.nombres, per.apellidos
             FROM sesion_usuario s
             JOIN usuario u ON u.id_usuario = s.id_usuario
             JOIN persona per ON per.id_persona = u.id_persona
             WHERE 1=1`;
  const params = [];
  if (idUsuario) {
    params.push(Number(idUsuario));
    sql += ` AND s.id_usuario = $${params.length}`;
  }
  sql += ` ORDER BY s.fecha_inicio DESC LIMIT 100`;

  const result = await query(sql, params);
  return jsonOk(result.rows);
}
