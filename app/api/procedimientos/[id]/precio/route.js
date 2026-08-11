import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { esNumeroNoNegativo } from "@/lib/validations";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede cambiar precios", 403);
  }

  const { id } = await context.params;
  const idProcedimiento = Number(id);
  if (!Number.isInteger(idProcedimiento)) return jsonError("Id inválido", 400);

  const body = await request.json().catch(() => ({}));
  const monto = Number(body.monto);
  if (!esNumeroNoNegativo(monto)) return jsonError("El monto debe ser un número no negativo", 400);

  const procResult = await query(
    `SELECT id_procedimiento, nombre, precio_actual FROM procedimiento WHERE id_procedimiento = $1`,
    [idProcedimiento]
  );
  if (procResult.rows.length === 0) return jsonError("Procedimiento no encontrado", 404);

  const anterior = procResult.rows[0];

  const result = await withTransaction(async (client) => {
    await client.query(
      `UPDATE procedimiento SET precio_actual = $1 WHERE id_procedimiento = $2`,
      [monto, idProcedimiento]
    );

    const historial = await client.query(
      `INSERT INTO precio_historial (id_procedimiento, monto, id_usuario)
       VALUES ($1, $2, $3) RETURNING id_precio`,
      [idProcedimiento, monto, session.idUsuario]
    );

    await registrarAuditoria({
      idUsuario: session.idUsuario,
      idSesion: session.idSesion,
      tabla: "precio_historial",
      operacion: "INSERT",
      idRegistro: historial.rows[0].id_precio,
      valorAnterior: { precio_actual: Number(anterior.precio_actual) },
      valorNuevo: { precio_actual: monto },
      ip: obtenerIP(request),
    });

    return historial.rows[0].id_precio;
  });

  return jsonOk({
    mensaje: "Precio actualizado",
    precio_historial_id: result,
  });
}
