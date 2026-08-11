import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";

export async function PATCH(request, context) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede activar/inactivar pacientes", 403);
  }

  const { id } = await context.params;
  const idPaciente = Number(id);
  if (!Number.isInteger(idPaciente)) return jsonError("Id de paciente inválido", 400);

  const body = await request.json().catch(() => ({}));
  if (typeof body.activo !== "boolean") {
    return jsonError("El campo 'activo' es obligatorio", 400);
  }

  const pacResult = await query(
    `SELECT pac.id_paciente, pac.activo FROM paciente pac WHERE pac.id_paciente = $1`,
    [idPaciente]
  );
  if (pacResult.rows.length === 0) return jsonError("Paciente no encontrado", 404);

  const anterior = pacResult.rows[0];
  await query(
    `UPDATE paciente SET activo = $1 WHERE id_paciente = $2`,
    [body.activo, idPaciente]
  );

  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "paciente",
    operacion: "UPDATE",
    idRegistro: idPaciente,
    valorAnterior: anterior,
    valorNuevo: { id_paciente: idPaciente, activo: body.activo },
    ip: obtenerIP(request),
  });

  return jsonOk({
    id_paciente: idPaciente,
    activo: body.activo,
    mensaje: body.activo ? "Paciente activado" : "Paciente inactivado",
  });
}
