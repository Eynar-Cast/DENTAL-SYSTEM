import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);

  const result = await query(
    `SELECT id_metodo_pago, descripcion FROM metodo_pago ORDER BY id_metodo_pago`
  );
  return jsonOk(result.rows);
}
