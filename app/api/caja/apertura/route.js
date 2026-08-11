import { requireAuth, requireRoles, obtenerIP } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { registrarAuditoria } from "@/lib/audit";
import { esNumeroNoNegativo } from "@/lib/validations";

export async function POST(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin", "recepcionista"])) {
    return jsonError("No tienes permisos para abrir la caja", 403);
  }

  const body = await request.json().catch(() => ({}));
  const montoInicial = Number(body.monto_inicial || 0);
  if (!esNumeroNoNegativo(montoInicial)) {
    return jsonError("El monto inicial debe ser un número no negativo", 400);
  }

  const abierta = await query(`SELECT id_caja FROM caja WHERE estado = 'abierta' LIMIT 1`);
  if (abierta.rows.length > 0) {
    return jsonError("Ya existe una caja abierta para esta jornada. Ciérrala antes de abrir otra.", 409);
  }

  const result = await query(
    `INSERT INTO caja (monto_inicial, id_usuario_apertura, estado)
     VALUES ($1, $2, 'abierta') RETURNING id_caja`,
    [montoInicial, session.idUsuario]
  );

  await registrarAuditoria({
    idUsuario: session.idUsuario,
    idSesion: session.idSesion,
    tabla: "caja",
    operacion: "INSERT",
    idRegistro: result.rows[0].id_caja,
    valorNuevo: { id_caja: result.rows[0].id_caja, monto_inicial: montoInicial, estado: "abierta" },
    ip: obtenerIP(request),
  });

  return jsonOk({ id_caja: result.rows[0].id_caja, mensaje: "Caja abierta" }, 201);
}
