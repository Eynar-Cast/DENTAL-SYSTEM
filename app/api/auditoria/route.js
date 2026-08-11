import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede ver la auditoría", 403);

  const { searchParams } = new URL(request.url);
  const tabla = searchParams.get("tabla");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const idUsuario = searchParams.get("id_usuario");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Number(searchParams.get("offset")) || 0;

  const condiciones = [];
  const params = [];
  if (tabla) { params.push(tabla); condiciones.push(`a.tabla_afectada = $${params.length}`); }
  if (desde) { params.push(desde); condiciones.push(`a.fecha_hora::date >= $${params.length}`); }
  if (hasta) { params.push(hasta); condiciones.push(`a.fecha_hora::date <= $${params.length}`); }
  if (idUsuario) { params.push(Number(idUsuario)); condiciones.push(`a.id_usuario = $${params.length}`); }

  const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(" AND ")}` : "";

  const result = await query(
    `SELECT a.id_auditoria, a.tabla_afectada, a.operacion, a.id_registro_afectado,
            a.valor_anterior, a.valor_nuevo, a.fecha_hora, a.ip_origen,
            u.email, per.nombres, per.apellidos
     FROM auditoria a
     LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
     LEFT JOIN persona per ON per.id_persona = u.id_persona
     ${where}
     ORDER BY a.fecha_hora DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM auditoria a${where}`,
    params
  );

  return jsonOk({
    registros: result.rows,
    total: Number(countResult.rows[0].total),
    limit,
    offset,
  });
}
