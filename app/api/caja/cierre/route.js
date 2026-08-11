import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
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

  const cajaResult = await query(`SELECT * FROM caja WHERE estado = 'abierta' ORDER BY id_caja DESC LIMIT 1`);
  if (cajaResult.rows.length === 0) {
    return jsonError("No hay una caja abierta para cerrar", 400);
  }

  const caja = cajaResult.rows[0];

  const ingresosResult = await query(
    `SELECT COALESCE(SUM(monto), 0) AS total FROM cobro WHERE id_caja = $1 AND anulado = FALSE`,
    [caja.id_caja]
  );
  const egresosResult = await query(
    `SELECT COALESCE(SUM(monto), 0) AS total FROM gasto WHERE id_caja = $1 AND anulado = FALSE`,
    [caja.id_caja]
  );

  const ingresos = Number(ingresosResult.rows[0].total);
  const egresos = Number(egresosResult.rows[0].total);
  const saldoEsperado = Number(caja.monto_inicial) + ingresos - egresos;
  const diferencia = montoDeclarado - saldoEsperado;

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE caja
       SET estado = 'cerrada', fecha_cierre = NOW(),
           monto_declarado_cierre = $1, diferencia = $2
       WHERE id_caja = $3`,
      [montoDeclarado, diferencia, caja.id_caja]
    );

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
    });
  });

  return jsonOk({
    id_caja: caja.id_caja,
    ingresos,
    egresos,
    saldo_esperado: saldoEsperado,
    monto_declarado: montoDeclarado,
    diferencia,
    mensaje: "Caja cerrada",
  });
}
