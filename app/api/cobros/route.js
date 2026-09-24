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

      // Calcular monto ya pagado y saldo restante (excluye anulados)
      const pagosResult = await client.query(
        `SELECT COALESCE(SUM(monto),0) AS pagado FROM cobro WHERE id_presupuesto = $1 AND anulado = FALSE`,
        [idPresupuesto]
      );
      const montoPagadoPrevio = Number(pagosResult.rows[0].pagado);
      const total = Number(presupuesto.total);
      const saldo = Number((total - montoPagadoPrevio).toFixed(2));

      if (saldo <= 0.001) {
        const e = new Error("YA_PAGADO");
        e.code = "YA_PAGADO";
        throw e;
      }

      if (monto > saldo + 0.001) {
        const e = new Error("MONTO_EXCEDE_SALDO");
        e.code = "MONTO_EXCEDE_SALDO";
        e.saldo = saldo;
        throw e;
      }

      const esPagoTotal = Math.abs(monto - saldo) <= 0.001;
      const nuevoEstado = esPagoTotal ? "pagado" : "parcial";

      const cobroResult = await client.query(
        `INSERT INTO cobro (id_presupuesto, id_caja, id_metodo_pago, monto, id_usuario)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_cobro`,
        [idPresupuesto, idCaja, idMetodoPago, monto, session.idUsuario]
      );
      const idCobro = cobroResult.rows[0].id_cobro;

      // Actualizar estado según si se completó el saldo o queda pendiente
      const updateResult = await client.query(
        `UPDATE presupuesto SET estado = $1 WHERE id_presupuesto = $2 AND estado IN ('pendiente','parcial')`,
        [nuevoEstado, idPresupuesto]
      );
      if (updateResult.rowCount === 0) {
        const e = new Error("YA_PAGADO");
        e.code = "YA_PAGADO";
        throw e;
      }

      const montoPagadoNuevo = Number((montoPagadoPrevio + monto).toFixed(2));
      const saldoRestante = Number((total - montoPagadoNuevo).toFixed(2));

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "cobro",
        operacion: "INSERT",
        idRegistro: idCobro,
        valorNuevo: { id_cobro: idCobro, id_presupuesto: idPresupuesto, monto, monto_pagado: montoPagadoNuevo, saldo_restante: saldoRestante < 0.005 ? 0 : saldoRestante, estado_presupuesto: nuevoEstado },
        ip,
        client,
      });

      return { idCobro, montoPagado: montoPagadoNuevo, saldoRestante: saldoRestante < 0.005 ? 0 : saldoRestante, estado: nuevoEstado, esPagoTotal };
    });

    const mensaje = result.esPagoTotal ? "Pago total registrado" : `Pago parcial registrado. Saldo restante: Bs ${result.saldoRestante.toFixed(2)}`;
    return jsonOk({ id_cobro: result.idCobro, monto_pagado: result.montoPagado, saldo_restante: result.saldoRestante, estado: result.estado, mensaje }, 201);
  } catch (err) {
    switch (err.code) {
      case "NO_CAJA":
        return jsonError("No hay una caja abierta. Abre la caja para registrar cobros.", 400);
      case "NOT_FOUND":
        return jsonError("Presupuesto no encontrado", 404);
      case "YA_PAGADO":
        return jsonError("Este presupuesto ya está pagado.", 409);
      case "MONTO_EXCEDE_SALDO":
        return jsonError(`El monto excede el saldo pendiente (Bs ${Number(err.saldo).toFixed(2)}).`, 400);
      case "23503":
        return jsonError("El presupuesto o método de pago no existe.", 400);
      default:
        console.error("Error registrando cobro:", err);
        return jsonError("Error interno del servidor.", 500);
    }
  }
}
