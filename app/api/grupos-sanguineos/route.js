import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);

  const result = await query(
    `SELECT id_grupo_sanguineo, descripcion FROM grupo_sanguineo ORDER BY id_grupo_sanguineo`
  );
  return jsonOk(result.rows);
}
