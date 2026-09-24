import { query } from "@/lib/db";
import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio } from "@/lib/validations";

export async function GET() {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);

  const result = await query(
    `SELECT id_especialidad, nombre_especialidad FROM especialidad ORDER BY nombre_especialidad`
  );
  return jsonOk(result.rows);
}

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede crear especialidades", 403);
  }
  const body = await request.json().catch(() => ({}));
  const nombre = textoLimpio(body.nombre_especialidad || body.nombre);
  if (!nombre) return jsonError("El nombre de la especialidad es obligatorio", 400);
  if (nombre.length < 3) return jsonError("El nombre debe tener al menos 3 caracteres", 400);
  if (nombre.length > 100) return jsonError("El nombre no puede exceder 100 caracteres", 400);
  try {
    const result = await query(
      `INSERT INTO especialidad (nombre_especialidad) VALUES ($1) RETURNING id_especialidad`,
      [nombre]
    );
    const id = result.rows[0].id_especialidad;
    await registrarAuditoria({
      idUsuario: session.idUsuario,
      idSesion: session.idSesion,
      tabla: "especialidad",
      operacion: "INSERT",
      idRegistro: id,
      valorNuevo: { id_especialidad: id, nombre_especialidad: nombre },
      ip: obtenerIP(request),
    });
    return jsonOk({ id_especialidad: id, nombre_especialidad: nombre, mensaje: "Especialidad creada" }, 201);
  } catch (err) {
    if (err.code === "23505") return jsonError("Ya existe una especialidad con ese nombre", 409);
    console.error("Error creando especialidad:", err);
    return jsonError("Error interno del servidor", 500);
  }
}
