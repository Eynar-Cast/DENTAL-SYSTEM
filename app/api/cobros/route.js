import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
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

  try {
    const result = await withTransaction(async (client) => {
      // Bloquear la caja abierta: serializa cobro/gasto vs. cierre de caja
      // (el cierre también bloquea esta misma fila).
      const cajaLock = await client.query(
        `SELECT id_caja FROM caja WHERE estado = 'abierta' ORDER BY id_caja DESC LIMIT 1 FOR UPDATE`
      );
      if (cajaLock.rows.length === 0) {
        const e = new Error("NO_CAJA");
        e.code = "NO_CAJA";
        throw e;
      }
      const idCaja = cajaLock.rows[0].id_caja;

      // Releer el presupuesto DENTRO de la transacción con lock (FOR UPDATE):
      // dos cobros concurrentes ya no pueden leer 'pendiente' los dos.
      const presupuestoResult = await client.query(
        `SELECT id_presupuesto, total, estado FROM presupuesto WHERE id_presupuesto = $1 FOR UPDATE`,
        [idPresupuesto]
      );
      if (presupuestoResult.rows.length === 0) {
        const e = new Error("NOT_FOUND");
        e.code = "NOT_FOUND";
        throw e;
      }

      const presupuesto = presupuestoResult.rows[0];
      if (presupuesto.estado === "pagado") {
        const e = new Error("YA_PAGADO");
        e.code = "YA_PAGADO";
        throw e;
      }

      if (Math.abs(monto - Number(presupuesto.total)) > 0.001) {
        const e = new Error("MONTO_INCORRECTO");
        e.code = "MONTO_INCORRECTO";
        throw e;
      }

      const cobroResult = await client.query(
        `INSERT INTO cobro (id_presupuesto, id_caja, id_metodo_pago, monto, id_usuario)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_cobro`,
        [idPresupuesto, idCaja, idMetodoPago, monto, session.idUsuario]
      );
      const idCobro = cobroResult.rows[0].id_cobro;

      // Barrera final: solo marca pagado si seguía en 'pendiente'.
      const updateResult = await client.query(
        `UPDATE presupuesto SET estado = 'pagado' WHERE id_presupuesto = $1 AND estado = 'pendiente'`,
        [idPresupuesto]
      );
      if (updateResult.rowCount === 0) {
        const e = new Error("YA_PAGADO");
        e.code = "YA_PAGADO";
        throw e;
      }

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "cobro",
        operacion: "INSERT",
        idRegistro: idCobro,
        valorNuevo: { id_cobro: idCobro, id_presupuesto: idPresupuesto, monto },
        ip,
        client,
      });

      return idCobro;
    });

    return jsonOk({ id_cobro: result, mensaje: "Pago registrado" }, 201);
  } catch (err) {
    switch (err.code) {
      case "NO_CAJA":
        return jsonError("No hay una caja abierta. Abre la caja para registrar cobros.", 400);
      case "NOT_FOUND":
        return jsonError("Presupuesto no encontrado", 404);
      case "YA_PAGADO":
        return jsonError("Este presupuesto ya está pagado.", 409);
      case "MONTO_INCORRECTO":
        return jsonError("El monto debe ser igual al total del presupuesto.", 400);
      case "23503":
        return jsonError("El presupuesto o método de pago no existe.", 400);
      default:
        console.error("Error registrando cobro:", err);
        return jsonError("Error interno del servidor.", 500);
    }
  }
}
