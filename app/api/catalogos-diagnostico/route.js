import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);

  const result = await query(
    `SELECT codigo_diagnostico, descripcion FROM catalogo_diagnostico ORDER BY codigo_diagnostico`
  );
  return jsonOk(result.rows);
}
