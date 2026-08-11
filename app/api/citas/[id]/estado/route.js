import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista", "odontologo"])) {
    return jsonError("No tienes permisos para cambiar el estado de citas", 403);
  }

  const { id } = await context.params;
  const idCita = Number(id);
  if (!Number.isInteger(idCita)) return jsonError("Id de cita inválido", 400);

  const body = await request.json().catch(() => ({}));

  const citaResult = await query(
    `SELECT c.id_cita, c.fecha_hora, e.descripcion AS estado_actual FROM cita c
     JOIN estado_cita e ON e.id_estado = c.id_estado
     WHERE c.id_cita = $1`,
    [idCita]
  );
  if (citaResult.rows.length === 0) return jsonError("Cita no encontrada", 404);

  const anterior = citaResult.rows[0];

  // Cambio de fecha/hora (reprogramar)
  if (body.fecha_hora && !isNaN(Date.parse(body.fecha_hora))) {
    try {
      await query(`UPDATE cita SET fecha_hora = $1 WHERE id_cita = $2`, [
        new Date(body.fecha_hora).toISOString(),
        idCita,
      ]);
    } catch (err) {
      if (err.code === "23505") {
        return jsonError("El odontólogo ya tiene una cita en ese horario.", 409);
      }
      throw err;
    }
  }

  // Cambio de estado
  if (body.id_estado) {
    const estadoResult = await query(
      `SELECT id_estado, descripcion FROM estado_cita WHERE id_estado = $1`,
      [body.id_estado]
    );
    if (estadoResult.rows.length === 0) {
      return jsonError("Estado de cita no válido", 400);
    }
    await query(`UPDATE cita SET id_estado = $1 WHERE id_cita = $2`, [body.id_estado, idCita]);
  }

  const nuevo = await query(
    `SELECT c.id_cita, e.descripcion AS estado, c.fecha_hora FROM cita c
     JOIN estado_cita e ON e.id_estado = c.id_estado WHERE c.id_cita = $1`,
    [idCita]
  );

  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "cita",
    operacion: "UPDATE",
    idRegistro: idCita,
    valorAnterior: anterior,
    valorNuevo: nuevo.rows[0],
    ip: obtenerIP(request),
  });

  return jsonOk({ id_cita: idCita, mensaje: "Estado actualizado", cita: nuevo.rows[0] });
}
