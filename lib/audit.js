import { query } from "@/lib/db";

// Registra un evento de auditoría. Se llama desde las API routes tras
// cada INSERT/UPDATE/DELETE sobre tablas sensibles.
// TODO lo llaman las rutas, por lo que nunca se eliminan datos,
// simplemente se inactivan/anulan y se audita el cambio.
export async function registrarAuditoria({
  idUsuario = null,
  idSesion = null,
  tabla,
  operacion,
  idRegistro = null,
  valorAnterior = null,
  valorNuevo = null,
  ip = null,
  client = null,
}) {
  try {
    // Si se pasa un client de withTransaction, la auditoría corre dentro
    // de la misma transacción (atómica con la operación). Si no, usa el pool.
    const db = client || query;
    await db(
      `INSERT INTO auditoria
        (id_usuario, id_sesion, tabla_afectada, operacion, id_registro_afectado,
         valor_anterior, valor_nuevo, ip_origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        idUsuario,
        idSesion,
        tabla,
        operacion,
        idRegistro,
        valorAnterior != null ? JSON.stringify(valorAnterior) : null,
        valorNuevo != null ? JSON.stringify(valorNuevo) : null,
        ip || null,
      ]
    );
  } catch (err) {
    // La auditoría nunca debe romper la operación principal.
    console.error("Error registrando auditoría:", err);
  }
}