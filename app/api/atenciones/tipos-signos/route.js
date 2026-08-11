import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["odontologo", "admin"])) {
    return jsonError("Sin permisos", 403);
  }

  const result = await query(`SELECT id_tipo, nombre, unidad FROM tipo_signo_vital ORDER BY id_tipo`);
  return jsonOk(result.rows);
}
