import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio } from "@/lib/validations";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede anular gastos", 403);
  }

  const { id } = await context.params;
  const idGasto = Number(id);
  if (!Number.isInteger(idGasto)) return jsonError("Id inválido", 400);

  const body = await request.json().catch(() => ({}));
  const motivo = textoLimpio(body.motivo);
  if (!motivo) return jsonError("El motivo de anulación es obligatorio", 400);

  const gastoResult = await query(
    `SELECT g.id_gasto, g.id_caja, g.anulado FROM gasto g WHERE g.id_gasto = $1`,
    [idGasto]
  );
  if (gastoResult.rows.length === 0) return jsonError("Gasto no encontrado", 404);
  if (gastoResult.rows[0].anulado) return jsonError("El gasto ya está anulado", 409);

  // No anular movimientos de una jornada ya cerrada: invalidaría el arqueo
  const cajaResult = await query(
    `SELECT estado FROM caja WHERE id_caja = $1`,
    [gastoResult.rows[0].id_caja]
  );
  if (cajaResult.rows.length === 0) return jsonError("La caja del gasto no existe", 409);
  if (cajaResult.rows[0].estado === "cerrada") {
    return jsonError("No puedes anular un gasto de una caja ya cerrada", 409);
  }

  const anterior = gastoResult.rows[0];

  await query(
    `UPDATE gasto SET anulado = TRUE, motivo_anulacion = $1 WHERE id_gasto = $2`,
    [motivo, idGasto]
  );

  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "gasto",
    operacion: "UPDATE",
    idRegistro: idGasto,
    valorAnterior: anterior,
    valorNuevo: { id_gasto: idGasto, anulado: true, motivo_anulacion: motivo },
    ip: obtenerIP(request),
  });

  return jsonOk({ id_gasto: idGasto, mensaje: "Gasto anulado" });
}
