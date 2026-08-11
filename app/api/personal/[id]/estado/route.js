import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede activar/inactivar personal", 403);
  }

  const { id } = await context.params;
  const idPersonal = Number(id);
  if (!Number.isInteger(idPersonal)) return jsonError("Id de personal inválido", 400);

  const body = await request.json().catch(() => ({}));
  if (typeof body.activo !== "boolean") {
    return jsonError("El campo 'activo' es obligatorio", 400);
  }

  const perResult = await query(
    `SELECT p.id_personal, p.activo FROM personal p WHERE p.id_personal = $1`,
    [idPersonal]
  );
  if (perResult.rows.length === 0) return jsonError("Personal no encontrado", 404);

  const anterior = perResult.rows[0];
  await query(`UPDATE personal SET activo = $1 WHERE id_personal = $2`, [body.activo, idPersonal]);

  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "personal",
    operacion: "UPDATE",
    idRegistro: idPersonal,
    valorAnterior: anterior,
    valorNuevo: { id_personal: idPersonal, activo: body.activo },
    ip: obtenerIP(request),
  });

  return jsonOk({
    id_personal: idPersonal,
    activo: body.activo,
    mensaje: body.activo ? "Personal activado" : "Personal inactivado",
  });
}
