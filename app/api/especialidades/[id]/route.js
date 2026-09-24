import { query } from "@/lib/db";
import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio } from "@/lib/validations";

export async function PUT(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede editar especialidades", 403);
  const { id } = await context.params;
  const idEspecialidad = Number(id);
  if (!Number.isInteger(idEspecialidad)) return jsonError("Id inválido", 400);
  const body = await request.json().catch(() => ({}));
  const nombre = textoLimpio(body.nombre_especialidad || body.nombre);
  if (!nombre) return jsonError("El nombre es obligatorio", 400);
  if (nombre.length < 3) return jsonError("El nombre debe tener al menos 3 caracteres", 400);
  try {
    const existe = await query(`SELECT id_especialidad FROM especialidad WHERE id_especialidad=$1`, [idEspecialidad]);
    if (existe.rows.length === 0) return jsonError("Especialidad no encontrada", 404);
    const result = await query(`UPDATE especialidad SET nombre_especialidad=$1 WHERE id_especialidad=$2 RETURNING id_especialidad`, [nombre, idEspecialidad]);
    await registrarAuditoria({
      idUsuario: session.idUsuario,
      idSesion: session.idSesion,
      tabla: "especialidad",
      operacion: "UPDATE",
      idRegistro: idEspecialidad,
      valorNuevo: { nombre_especialidad: nombre },
      ip: obtenerIP(request),
    });
    return jsonOk({ id_especialidad: result.rows[0].id_especialidad, mensaje: "Especialidad actualizada" });
  } catch (err) {
    if (err.code === "23505") return jsonError("Ya existe una especialidad con ese nombre", 409);
    console.error(err);
    return jsonError("Error interno", 500);
  }
}

export async function DELETE(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede eliminar especialidades", 403);
  const { id } = await context.params;
  const idEspecialidad = Number(id);
  if (!Number.isInteger(idEspecialidad)) return jsonError("Id inválido", 400);
  const uso = await query(`SELECT COUNT(*) FROM personal WHERE id_especialidad=$1`, [idEspecialidad]);
  if (Number(uso.rows[0].count) > 0) return jsonError("No se puede eliminar: hay personal asignado a esta especialidad", 409);
  const del = await query(`DELETE FROM especialidad WHERE id_especialidad=$1 RETURNING id_especialidad`, [idEspecialidad]);
  if (del.rows.length === 0) return jsonError("Especialidad no encontrada", 404);
  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "especialidad",
    operacion: "DELETE",
    idRegistro: idEspecialidad,
    ip: obtenerIP(request),
  });
  return jsonOk({ mensaje: "Especialidad eliminada" });
}
