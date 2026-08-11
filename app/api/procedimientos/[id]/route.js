import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio } from "@/lib/validations";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede editar procedimientos", 403);
  }

  const { id } = await context.params;
  const idProcedimiento = Number(id);
  if (!Number.isInteger(idProcedimiento)) return jsonError("Id inválido", 400);

  const procResult = await query(
    `SELECT id_procedimiento, nombre, descripcion FROM procedimiento WHERE id_procedimiento = $1`,
    [idProcedimiento]
  );
  if (procResult.rows.length === 0) return jsonError("Procedimiento no encontrado", 404);

  const anterior = procResult.rows[0];
  const body = await request.json().catch(() => ({}));

  const nombre = body.nombre !== undefined ? textoLimpio(body.nombre) : anterior.nombre;
  const descripcion = body.descripcion !== undefined ? textoLimpio(body.descripcion) : anterior.descripcion;

  await query(
    `UPDATE procedimiento SET nombre = $1, descripcion = $2 WHERE id_procedimiento = $3`,
    [nombre, descripcion || null, idProcedimiento]
  );

  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "procedimiento",
    operacion: "UPDATE",
    idRegistro: idProcedimiento,
    valorAnterior: anterior,
    valorNuevo: { id_procedimiento: idProcedimiento, nombre, descripcion },
    ip: obtenerIP(request),
  });

  return jsonOk({ mensaje: "Procedimiento actualizado" });
}
