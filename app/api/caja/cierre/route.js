import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { esNumeroNoNegativo } from "@/lib/validations";

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para cerrar la caja", 403);
  }

  const body = await request.json().catch(() => ({}));
  const montoDeclarado = Number(body.monto_declarado);
  if (!esNumeroNoNegativo(montoDeclarado)) {
    return jsonError("El monto declarado es obligatorio y debe ser un número no negativo", 400);
  }

  try {
    const result = await withTransaction(async (client) => {
      // Bloquear la caja abierta (FOR UPDATE): serializa el cierre contra
      // cobros/gastos en curso, que bloquean esta misma fila. Los saldos se
      // calculan DENTRO de la transacción, por lo que incluyen todo lo
      // confirmado antes del lock y nada posterior.
      const cajaResult = await client.query(
        `SELECT * FROM caja WHERE estado = 'abierta' ORDER BY id_caja DESC LIMIT 1 FOR UPDATE`
      );
      if (cajaResult.rows.length === 0) {
        const e = new Error("NO_CAJA");
        e.code = "NO_CAJA";
        throw e;
      }
      const caja = cajaResult.rows[0];

      const ingresosResult = await client.query(
        `SELECT COALESCE(SUM(monto), 0) AS total FROM cobro WHERE id_caja = $1 AND anulado = FALSE`,
        [caja.id_caja]
      );
      const egresosResult = await client.query(
        `SELECT COALESCE(SUM(monto), 0) AS total FROM gasto WHERE id_caja = $1 AND anulado = FALSE`,
        [caja.id_caja]
      );

      const ingresos = Number(ingresosResult.rows[0].total);
      const egresos = Number(egresosResult.rows[0].total);
      const saldoEsperado = Number(caja.monto_inicial) + ingresos - egresos;
      const diferencia = montoDeclarado - saldoEsperado;

      const updateResult = await client.query(
        `UPDATE caja
         SET estado = 'cerrada', fecha_cierre = NOW(),
             monto_declarado_cierre = $1, diferencia = $2
         WHERE id_caja = $3 AND estado = 'abierta'`,
        [montoDeclarado, diferencia, caja.id_caja]
      );
      if (updateResult.rowCount === 0) {
        const e = new Error("NO_CAJA");
        e.code = "NO_CAJA";
        throw e;
      }

      await registrarAuditoria({
        idUsuario: session.idUsuario,
        idSesion: session.idSesion,
        tabla: "caja",
        operacion: "UPDATE",
        idRegistro: caja.id_caja,
        valorAnterior: { estado: "abierta" },
        valorNuevo: {
          id_caja: caja.id_caja,
          estado: "cerrada",
          monto_declarado: montoDeclarado,
          saldo_esperado: saldoEsperado,
          diferencia,
        },
        ip: obtenerIP(request),
        client,
      });

      return { id_caja: caja.id_caja, ingresos, egresos, saldoEsperado, diferencia };
    });

    return jsonOk({
      id_caja: result.id_caja,
      ingresos: result.ingresos,
      egresos: result.egresos,
      saldo_esperado: result.saldoEsperado,
      monto_declarado: montoDeclarado,
      diferencia: result.diferencia,
      mensaje: "Caja cerrada",
    });
  } catch (err) {
    if (err.code === "NO_CAJA") {
      return jsonError("No hay una caja abierta para cerrar", 400);
    }
    console.error("Error cerrando caja:", err);
    return jsonError("Error interno del servidor.", 500);
  }
}
