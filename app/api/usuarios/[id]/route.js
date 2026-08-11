import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede gestionar usuarios", 403);

  const { id } = await context.params;
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario)) return jsonError("Id inválido", 400);

  const body = await request.json().catch(() => ({}));

  const usuarioResult = await query(
    `SELECT id_usuario, email, activo FROM usuario WHERE id_usuario = $1`,
    [idUsuario]
  );
  if (usuarioResult.rows.length === 0) return jsonError("Usuario no encontrado", 404);
  const anterior = usuarioResult.rows[0];

  if (typeof body.activo === "boolean") {
    await query(`UPDATE usuario SET activo = $1 WHERE id_usuario = $2`, [body.activo, idUsuario]);
  }

  if (Array.isArray(body.roles)) {
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM usuario_rol WHERE id_usuario = $1`, [idUsuario]);
      for (const rol of body.roles) {
        const rolResult = await client.query(`SELECT id_rol FROM rol WHERE nombre_rol = $1`, [rol]);
        if (rolResult.rows.length > 0) {
          await client.query(
            `INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`,
            [idUsuario, rolResult.rows[0].id_rol]
          );
        }
      }
    });
  }

  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "usuario",
    operacion: "UPDATE",
    idRegistro: idUsuario,
    valorAnterior: anterior,
    valorNuevo: { id_usuario: idUsuario, activo: body.activo, roles: body.roles },
    ip: obtenerIP(request),
  });

  return jsonOk({ id_usuario: idUsuario, mensaje: "Usuario actualizado" });
}
