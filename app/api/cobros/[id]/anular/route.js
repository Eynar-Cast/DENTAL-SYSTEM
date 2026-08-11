import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio } from "@/lib/validations";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede anular cobros", 403);
  }

  const { id } = await context.params;
  const idCobro = Number(id);
  if (!Number.isInteger(idCobro)) return jsonError("Id inválido", 400);

  const body = await request.json().catch(() => ({}));
  const motivo = textoLimpio(body.motivo);
  if (!motivo) return jsonError("El motivo de anulación es obligatorio", 400);

  const cobroResult = await query(
    `SELECT id_cobro, id_presupuesto, anulado FROM cobro WHERE id_cobro = $1`,
    [idCobro]
  );
  if (cobroResult.rows.length === 0) return jsonError("Cobro no encontrado", 404);
  if (cobroResult.rows[0].anulado) return jsonError("El cobro ya está anulado", 409);

  const anterior = cobroResult.rows[0];

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE cobro SET anulado = TRUE, motivo_anulacion = $1 WHERE id_cobro = $2`,
      [motivo, idCobro]
    );

    // Si no queda ningún cobro activo, el presupuesto vuelve a 'pendiente'
    await client.query(
      `UPDATE presupuesto SET estado = 'pendiente'
       WHERE id_presupuesto = $1 AND NOT EXISTS (
         SELECT 1 FROM cobro WHERE id_presupuesto = $1 AND anulado = FALSE
       )`,
      [anterior.id_presupuesto]
    );

    await registrarAuditoria({
      idUsuario: session.idUsuario,
      idSesion: session.idSesion,
      tabla: "cobro",
      operacion: "UPDATE",
      idRegistro: idCobro,
      valorAnterior: anterior,
      valorNuevo: { id_cobro: idCobro, anulado: true, motivo_anulacion: motivo },
      ip: obtenerIP(request),
    });
  });

  return jsonOk({ id_cobro: idCobro, mensaje: "Cobro anulado" });
}
