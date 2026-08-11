import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);

  const { searchParams } = new URL(request.url);
  const idPais = searchParams.get("id_pais") || "1";

  const result = await query(
    `SELECT id_ciudad, nombre_ciudad, id_pais FROM ciudad WHERE id_pais = $1 ORDER BY nombre_ciudad`,
    [idPais]
  );
  return jsonOk(result.rows);
}
