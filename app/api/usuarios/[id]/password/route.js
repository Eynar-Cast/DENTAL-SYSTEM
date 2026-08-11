import { requireAuth, requireRoles, obtenerIP, hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede cambiar contraseñas", 403);
  }

  const { id } = await context.params;
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario)) return jsonError("Id inválido", 400);

  const body = await request.json().catch(() => ({}));
  const nuevaPassword = body.password;
  if (!nuevaPassword || String(nuevaPassword).length < 6) {
    return jsonError("La contraseña debe tener al menos 6 caracteres", 400);
  }

  const usuarioResult = await query(`SELECT id_usuario FROM usuario WHERE id_usuario = $1`, [idUsuario]);
  if (usuarioResult.rows.length === 0) return jsonError("Usuario no encontrado", 404);

  const passwordHash = await hashPassword(String(nuevaPassword));
  await query(`UPDATE usuario SET password_hash = $1 WHERE id_usuario = $2`, [passwordHash, idUsuario]);

  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "usuario",
    operacion: "UPDATE",
    idRegistro: idUsuario,
    valorAnterior: { id_usuario: idUsuario },
    valorNuevo: { id_usuario: idUsuario, password: "cambiada" },
    ip: obtenerIP(request),
  });

  return jsonOk({ id_usuario: idUsuario, mensaje: "Contraseña actualizada" });
}