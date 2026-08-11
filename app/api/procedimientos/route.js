import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio, esNumeroNoNegativo } from "@/lib/validations";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista", "odontologo"])) {
    return jsonError("Sin permisos", 403);
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  let sql = `SELECT id_procedimiento, nombre, descripcion, precio_actual, activo
             FROM procedimiento WHERE 1=1`;
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND LOWER(nombre) LIKE $${params.length}`;
  }
  sql += ` ORDER BY nombre LIMIT 200`;

  const result = await query(sql, params);
  return jsonOk(result.rows);
}

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) {
    return jsonError("Solo el administrador puede crear procedimientos", 403);
  }

  const body = await request.json().catch(() => ({}));
  const ip = obtenerIP(request);

  const nombre = textoLimpio(body.nombre);
  const descripcion = textoLimpio(body.descripcion);
  const precio = Number(body.precio_actual);

  if (!nombre) return jsonError("El nombre es obligatorio", 400);
  if (!esNumeroNoNegativo(precio)) return jsonError("El precio debe ser un número no negativo", 400);

  try {
    const result = await withTransaction(async (client) => {
      const procResult = await client.query(
        `INSERT INTO procedimiento (nombre, descripcion, precio_actual, activo)
         VALUES ($1, $2, $3, TRUE) RETURNING id_procedimiento`,
        [nombre, descripcion || null, precio]
      );
      const idProcedimiento = procResult.rows[0].id_procedimiento;

      await client.query(
        `INSERT INTO precio_historial (id_procedimiento, monto, id_usuario) VALUES ($1, $2, $3)`,
        [idProcedimiento, precio, session.idUsuario]
      );

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "procedimiento",
        operacion: "INSERT",
        idRegistro: idProcedimiento,
        valorNuevo: { id_procedimiento: idProcedimiento, nombre, precio_actual: precio },
        ip,
      });

      return idProcedimiento;
    });

    return jsonOk({ id_procedimiento: result, mensaje: "Procedimiento creado exitosamente" }, 201);
  } catch (err) {
    if (err.code === "23505") return jsonError("Ya existe un procedimiento con ese nombre.", 409);
    console.error("Error creando procedimiento:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}
