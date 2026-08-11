import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { esNumeroPositivo } from "@/lib/validations";

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para registrar cobros", 403);
  }

  const body = await request.json().catch(() => ({}));
  const idPresupuesto = Number(body.id_presupuesto);
  const idMetodoPago = Number(body.id_metodo_pago);
  const monto = Number(body.monto);
  const ip = obtenerIP(request);

  if (!Number.isInteger(idPresupuesto)) return jsonError("Selecciona un presupuesto", 400);
  if (!Number.isInteger(idMetodoPago)) return jsonError("Selecciona un método de pago", 400);
  if (!esNumeroPositivo(monto)) return jsonError("El monto debe ser un número mayor a cero", 400);

  // Regla de negocio: solo se puede cobrar con caja abierta
  const cajaResult = await query(`SELECT id_caja FROM caja WHERE estado = 'abierta' ORDER BY id_caja DESC LIMIT 1`);
  if (cajaResult.rows.length === 0) {
    return jsonError("No hay una caja abierta. Abre la caja para registrar cobros.", 400);
  }
  const idCaja = cajaResult.rows[0].id_caja;

  const presupuestoResult = await query(
    `SELECT id_presupuesto, total, estado FROM presupuesto WHERE id_presupuesto = $1`,
    [idPresupuesto]
  );
  if (presupuestoResult.rows.length === 0) return jsonError("Presupuesto no encontrado", 404);

  const presupuesto = presupuestoResult.rows[0];
  if (presupuesto.estado === "pagado") {
    return jsonError("Este presupuesto ya está pagado.", 409);
  }

  if (Math.abs(monto - Number(presupuesto.total)) > 0.001) {
    return jsonError(`El monto debe ser igual al total del presupuesto (Bs ${Number(presupuesto.total).toFixed(2)}).`, 400);
  }

  try {
    const result = await withTransaction(async (client) => {
      const cobroResult = await client.query(
        `INSERT INTO cobro (id_presupuesto, id_caja, id_metodo_pago, monto, id_usuario)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_cobro`,
        [idPresupuesto, idCaja, idMetodoPago, monto, session.idUsuario]
      );
      const idCobro = cobroResult.rows[0].id_cobro;

      await client.query(
        `UPDATE presupuesto SET estado = 'pagado' WHERE id_presupuesto = $1`,
        [idPresupuesto]
      );

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "cobro",
        operacion: "INSERT",
        idRegistro: idCobro,
        valorNuevo: { id_cobro: idCobro, id_presupuesto: idPresupuesto, monto },
        ip,
      });

      return idCobro;
    });

    return jsonOk({ id_cobro: result, mensaje: "Pago registrado" }, 201);
  } catch (err) {
    if (err.code === "23503") {
      return jsonError("El presupuesto o método de pago no existe.", 400);
    }
    console.error("Error registrando cobro:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}
