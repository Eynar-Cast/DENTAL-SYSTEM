import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { esEnteroPositivo } from "@/lib/validations";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para ver presupuestos", 403);
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const idPaciente = searchParams.get("id_paciente");

  let sql = `SELECT pr.id_presupuesto, pr.fecha_emision, pr.total, pr.estado,
                    pac.id_paciente,
                    per.nombres AS paciente_nombres, per.apellidos AS paciente_apellidos,
                    per.documento_identidad AS paciente_ci
             FROM presupuesto pr
             JOIN paciente pac ON pac.id_paciente = pr.id_paciente
             JOIN persona per ON per.id_persona = pac.id_persona
             WHERE 1=1`;
  const params = [];
  if (estado) {
    params.push(estado);
    sql += ` AND pr.estado = $${params.length}`;
  }
  if (idPaciente) {
    params.push(Number(idPaciente));
    sql += ` AND pr.id_paciente = $${params.length}`;
  }
  sql += ` ORDER BY pr.fecha_emision DESC LIMIT 200`;

  const result = await query(sql, params);
  return jsonOk(result.rows);
}

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para generar presupuestos", 403);
  }

  const body = await request.json().catch(() => ({}));
  const idPaciente = Number(body.id_paciente);
  const idCita = body.id_cita ? Number(body.id_cita) : null;
  const detalle = Array.isArray(body.detalle) ? body.detalle : [];
  const ip = obtenerIP(request);

  if (!Number.isInteger(idPaciente)) return jsonError("Selecciona un paciente", 400);
  if (detalle.length === 0) return jsonError("Agrega al menos un procedimiento al presupuesto", 400);

  const idsProcedimiento = detalle.map((d) => Number(d.id_procedimiento));
  for (const d of detalle) {
    if (!Number.isInteger(Number(d.id_procedimiento))) {
      return jsonError("Procedimiento inválido en el detalle", 400);
    }
    if (!esEnteroPositivo(d.cantidad)) {
      return jsonError("La cantidad debe ser un entero mayor a cero", 400);
    }
  }

  try {
    const result = await withTransaction(async (client) => {
      // Precios vigentes del catálogo (no se pueden modificar en caja)
      const preciosResult = await client.query(
        `SELECT id_procedimiento, precio_actual, activo FROM procedimiento WHERE id_procedimiento = ANY($1)`,
        [idsProcedimiento]
      );
      const precios = {};
      for (const p of preciosResult.rows) {
        if (!p.activo) throw { code: "INACTIVO", nombre: p.id_procedimiento };
        precios[p.id_procedimiento] = Number(p.precio_actual);
      }

      const detalles = detalle.map((d) => {
        const idProc = Number(d.id_procedimiento);
        if (!(idProc in precios)) throw { code: "NOEXISTE" };
        const cantidad = Number(d.cantidad);
        return {
          id_procedimiento: idProc,
          precio_unitario: precios[idProc],
          cantidad,
          subtotal: precios[idProc] * cantidad,
        };
      });

      const total = detalles.reduce((sum, d) => sum + d.subtotal, 0);

      const presupuestoResult = await client.query(
        `INSERT INTO presupuesto (id_paciente, id_cita, total, estado)
         VALUES ($1, $2, $3, 'pendiente') RETURNING id_presupuesto`,
        [idPaciente, idCita, total]
      );
      const idPresupuesto = presupuestoResult.rows[0].id_presupuesto;

      for (const d of detalles) {
        await client.query(
          `INSERT INTO detalle_presupuesto (id_presupuesto, id_procedimiento, precio_unitario, cantidad)
           VALUES ($1, $2, $3, $4)`,
          [idPresupuesto, d.id_procedimiento, d.precio_unitario, d.cantidad]
        );
      }

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "presupuesto",
        operacion: "INSERT",
        idRegistro: idPresupuesto,
        valorNuevo: { id_presupuesto: idPresupuesto, id_paciente: idPaciente, total },
        ip,
      });

      return { idPresupuesto, total };
    });

    return jsonOk(
      {
        id_presupuesto: result.idPresupuesto,
        total: result.total,
        estado: "pendiente",
        mensaje: "Presupuesto generado",
      },
      201
    );
  } catch (err) {
    if (err && err.code === "INACTIVO") {
      return jsonError("Un procedimiento del detalle está inactivo. Revisa el catálogo.", 400);
    }
    if (err && err.code === "NOEXISTE") {
      return jsonError("Un procedimiento del detalle no existe.", 400);
    }
    if (err.code === "23503") return jsonError("El paciente o la cita no existen.", 400);
    console.error("Error generando presupuesto:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}
