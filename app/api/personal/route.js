import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista", "odontologo"])) {
    return jsonError("No tienes permisos para ver el personal", 403);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const soloOdontologos = searchParams.get("odontologos") === "true";

  let sql = `SELECT p.id_personal, per.documento_identidad, per.nombres, per.apellidos,
              p.numero_colegiatura, p.fecha_contratacion, p.activo,
              e.id_especialidad, e.nombre_especialidad
       FROM personal p
       JOIN persona per ON per.id_persona = p.id_persona
       JOIN especialidad e ON e.id_especialidad = p.id_especialidad
       WHERE 1=1`;
  const params = [];

  if (soloOdontologos) {
    params.push("Recepción", "Asistencia Dental");
    sql += ` AND e.nombre_especialidad NOT IN ($1, $2) AND p.activo = TRUE`;
  }
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (LOWER(per.nombres) LIKE $${params.length}
          OR LOWER(per.apellidos) LIKE $${params.length}
          OR LOWER(per.documento_identidad) LIKE $${params.length}
          OR LOWER(e.nombre_especialidad) LIKE $${params.length})`;
  }
  sql += ` ORDER BY per.apellidos, per.nombres LIMIT 200`;

  const result = await query(sql, params);

  return jsonOk(result.rows);
}
