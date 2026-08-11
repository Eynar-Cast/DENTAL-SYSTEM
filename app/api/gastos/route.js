import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { textoLimpio, esNumeroPositivo, esFechaISO, esMesISO } from "@/lib/validations";

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para ver gastos", 403);
  }

  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get("fecha");
  const mes = searchParams.get("mes"); // formato YYYY-MM
  const idCategoria = searchParams.get("id_categoria");

  if (fecha && !esFechaISO(fecha)) return jsonError("La fecha no es válida", 400);
  if (mes && !esMesISO(mes)) return jsonError("El mes debe tener formato YYYY-MM", 400);

  let sql = `SELECT g.id_gasto, g.motivo, g.monto, g.fecha, g.anulado, g.motivo_anulacion,
                    cg.id_categoria, cg.nombre AS categoria,
                    per.nombres AS usuario_nombres, per.apellidos AS usuario_apellidos
             FROM gasto g
             JOIN categoria_gasto cg ON cg.id_categoria = g.id_categoria
             JOIN usuario u ON u.id_usuario = g.id_usuario
             JOIN persona per ON per.id_persona = u.id_persona
             WHERE 1=1`;
  const params = [];
  if (fecha) {
    params.push(fecha);
    sql += ` AND g.fecha::date = $${params.length}`;
  }
  if (mes) {
    params.push(mes);
    sql += ` AND TO_CHAR(g.fecha, 'YYYY-MM') = $${params.length}`;
  }
  if (idCategoria) {
    params.push(Number(idCategoria));
    sql += ` AND g.id_categoria = $${params.length}`;
  }
  sql += ` ORDER BY g.fecha DESC LIMIT 200`;

  const result = await query(sql, params);
  return jsonOk(result.rows);
}

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para registrar gastos", 403);
  }

  const body = await request.json().catch(() => ({}));
  const idCategoria = Number(body.id_categoria);
  const motivo = textoLimpio(body.motivo);
  const monto = Number(body.monto);
  const ip = obtenerIP(request);

  if (!Number.isInteger(idCategoria)) return jsonError("Selecciona una categoría de gasto", 400);
  if (!motivo) return jsonError("El motivo del gasto es obligatorio", 400);
  if (!esNumeroPositivo(monto)) return jsonError("El monto debe ser un número mayor a cero", 400);

  try {
    const result = await withTransaction(async (client) => {
      // Bloquear la caja abierta: serializa gasto/cobro vs. cierre de caja.
      // Impide que un gasto quede registrado en una caja recién cerrada.
      const cajaLock = await client.query(
        `SELECT id_caja FROM caja WHERE estado = 'abierta' ORDER BY id_caja DESC LIMIT 1 FOR UPDATE`
      );
      if (cajaLock.rows.length === 0) {
        const e = new Error("NO_CAJA");
        e.code = "NO_CAJA";
        throw e;
      }
      const idCaja = cajaLock.rows[0].id_caja;

      const insertResult = await client.query(
        `INSERT INTO gasto (id_categoria, motivo, monto, id_caja, id_usuario)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_gasto`,
        [idCategoria, motivo, monto, idCaja, session.idUsuario]
      );
      const idGasto = insertResult.rows[0].id_gasto;

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "gasto",
        operacion: "INSERT",
        idRegistro: idGasto,
        valorNuevo: { id_gasto: idGasto, id_categoria: idCategoria, motivo, monto },
        ip,
        client,
      });

      return idGasto;
    });

    return jsonOk({ id_gasto: result, mensaje: "Gasto registrado" }, 201);
  } catch (err) {
    if (err.code === "NO_CAJA") {
      return jsonError("No hay una caja abierta. Abre la caja para registrar gastos.", 400);
    }
    if (err.code === "23503") return jsonError("La categoría seleccionada no existe.", 400);
    console.error("Error registrando gasto:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}
