import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede activar/inactivar procedimientos", 403);
  }

  const { id } = await context.params;
  const idProcedimiento = Number(id);
  if (!Number.isInteger(idProcedimiento)) return jsonError("Id inválido", 400);

  const body = await request.json().catch(() => ({}));
  if (typeof body.activo !== "boolean") {
    return jsonError("El campo 'activo' es obligatorio", 400);
  }

  const procResult = await query(
    `SELECT id_procedimiento, activo FROM procedimiento WHERE id_procedimiento = $1`,
    [idProcedimiento]
  );
  if (procResult.rows.length === 0) return jsonError("Procedimiento no encontrado", 404);

  const anterior = procResult.rows[0];
  await query(`UPDATE procedimiento SET activo = $1 WHERE id_procedimiento = $2`, [body.activo, idProcedimiento]);

  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "procedimiento",
    operacion: "UPDATE",
    idRegistro: idProcedimiento,
    valorAnterior: anterior,
    valorNuevo: { id_procedimiento: idProcedimiento, activo: body.activo },
    ip: obtenerIP(request),
  });

  return jsonOk({
    id_procedimiento: idProcedimiento,
    activo: body.activo,
    mensaje: body.activo ? "Procedimiento activado" : "Procedimiento inactivado",
  });
}
