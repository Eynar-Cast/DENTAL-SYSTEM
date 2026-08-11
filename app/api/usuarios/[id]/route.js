import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";

const ROLES_PERMITIDOS = ["admin", "recepcionista", "odontologo"];

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede gestionar usuarios", 403);

  const { id } = await context.params;
  const idUsuario = Number(id);
  if (!Number.isInteger(idUsuario)) return jsonError("Id inválido", 400);

  const body = await request.json().catch(() => ({}));

  const usuarioResult = await query(
    `SELECT u.id_usuario, u.email, u.activo,
            COALESCE(array_agg(r.nombre_rol) FILTER (WHERE r.nombre_rol IS NOT NULL), '{}') AS roles
     FROM usuario u
     LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
     LEFT JOIN rol r ON r.id_rol = ur.id_rol
     WHERE u.id_usuario = $1
     GROUP BY u.id_usuario, u.email, u.activo`,
    [idUsuario]
  );
  if (usuarioResult.rows.length === 0) return jsonError("Usuario no encontrado", 404);
  const anterior = usuarioResult.rows[0];

  if (Array.isArray(body.roles)) {
    if (body.roles.length === 0) return jsonError("Selecciona al menos un rol", 400);
    const invalidos = body.roles.filter((r) => !ROLES_PERMITIDOS.includes(r));
    if (invalidos.length > 0) return jsonError("Uno de los roles seleccionados no es válido", 400);
  }

  // Salvaguardas anti-bloqueo
  const esSiMismo = idUsuario === session.idUsuario;
  if (esSiMismo) {
    if (typeof body.activo === "boolean" && body.activo === false) {
      return jsonError("No puedes desactivar tu propia cuenta", 400);
    }
    if (Array.isArray(body.roles) && !body.roles.includes("admin")) {
      return jsonError("No puedes quitarte tu propio rol de administrador", 400);
    }
  }

  const rolesActuales = anterior.roles || [];
  const pierdeAdmin =
    rolesActuales.includes("admin") &&
    ((typeof body.activo === "boolean" && body.activo === false) ||
      (Array.isArray(body.roles) && !body.roles.includes("admin")));

  if (pierdeAdmin) {
    const adminsResult = await query(
      `SELECT COUNT(*) FROM usuario u
       JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
       JOIN rol r ON r.id_rol = ur.id_rol
       WHERE r.nombre_rol = 'admin' AND u.activo = TRUE`
    );
    if (Number(adminsResult.rows[0].count) <= 1) {
      return jsonError("No puedes desactivar ni quitar el rol del último administrador activo", 400);
    }
  }

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
