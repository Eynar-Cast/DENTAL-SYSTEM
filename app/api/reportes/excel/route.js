import * as XLSX from "xlsx";
import { requireAuth, requireRoles } from "@/lib/auth";
import { query } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { validarRangoFechas } from "@/lib/validations";

// Exporta reportes a Excel. Parámetros: ?tipo=...&desde=...&hasta=...
// Tipos: resumen-dia, movimientos, pacientes-atendidos, tratamientos,
//        ranking-tratamientos, metodos-pago, cierres-caja
const REPORTES = {
  "resumen-dia": {
    titulo: "Resumen financiero por día",
    sql: (desde, hasta) => `SELECT d.fecha,
      COALESCE(i.ingresos,0) AS ingresos,
      COALESCE(e.egresos,0) AS egresos,
      COALESCE(i.ingresos,0) - COALESCE(e.egresos,0) AS utilidad
    FROM generate_series(COALESCE($1::date, CURRENT_DATE - INTERVAL '30 days'), COALESCE($2::date, CURRENT_DATE), '1 day') d(fecha)
    LEFT JOIN (SELECT cb.fecha_hora::date AS fecha, SUM(cb.monto) AS ingresos FROM cobro cb WHERE cb.anulado=FALSE GROUP BY 1) i ON i.fecha=d.fecha
    LEFT JOIN (SELECT g.fecha::date AS fecha, SUM(g.monto) AS egresos FROM gasto g WHERE g.anulado=FALSE GROUP BY 1) e ON e.fecha=d.fecha
    WHERE COALESCE(i.ingresos,0) + COALESCE(e.egresos,0) > 0
    ORDER BY d.fecha DESC`,
    columnas: ["Fecha", "Ingresos", "Egresos", "Utilidad"],
    map: (r) => [r.fecha, Number(r.ingresos), Number(r.egresos), Number(r.utilidad)],
  },
  movimientos: {
    titulo: "Movimientos (cobros y gastos)",
    sql: (desde, hasta) => `SELECT cb.fecha_hora AS fecha, 'Cobro' AS tipo, cb.monto,
      per.nombres || ' ' || per.apellidos AS detalle
      FROM cobro cb
      JOIN presupuesto pr ON pr.id_presupuesto=cb.id_presupuesto
      JOIN paciente pac ON pac.id_paciente=pr.id_paciente
      JOIN persona per ON per.id_persona=pac.id_persona
      WHERE cb.anulado=FALSE AND ($1::date IS NULL OR cb.fecha_hora::date >= $1::date) AND ($2::date IS NULL OR cb.fecha_hora::date <= $2::date)
      UNION ALL
      SELECT g.fecha AS fecha, 'Gasto' AS tipo, g.monto, g.motivo AS detalle
      FROM gasto g WHERE g.anulado=FALSE AND ($1::date IS NULL OR g.fecha::date >= $1::date) AND ($2::date IS NULL OR g.fecha::date <= $2::date)
      ORDER BY fecha DESC`,
    columnas: ["Fecha", "Tipo", "Monto", "Detalle"],
    map: (r) => [r.fecha, r.tipo, Number(r.monto), r.detalle],
  },
  "pacientes-atendidos": {
    titulo: "Pacientes y citas atendidos por día",
    sql: (desde, hasta) => `SELECT c.fecha_hora::date AS fecha, COUNT(DISTINCT c.id_paciente) AS pacientes, COUNT(*) AS citas
      FROM cita c JOIN estado_cita e ON e.id_estado=c.id_estado
      WHERE e.descripcion='atendida' AND ($1::date IS NULL OR c.fecha_hora::date>=$1::date) AND ($2::date IS NULL OR c.fecha_hora::date<=$2::date)
      GROUP BY 1 ORDER BY 1 DESC`,
    columnas: ["Fecha", "Pacientes", "Citas atendidas"],
    map: (r) => [r.fecha, r.pacientes, r.citas],
  },
  tratamientos: {
    titulo: "Tratamientos realizados",
    sql: (desde, hasta) => `SELECT c.fecha_hora::date AS fecha, pr.nombre AS tratamiento,
      per.nombres || ' ' || per.apellidos AS odontologo, SUM(ap.cantidad) AS cantidad
      FROM atencion_procedimiento ap
      JOIN atencion a ON a.id_atencion=ap.id_atencion
      JOIN cita c ON c.id_cita=a.id_cita
      JOIN personal p ON p.id_personal=c.id_personal
      JOIN persona per ON per.id_persona=p.id_persona
      JOIN procedimiento pr ON pr.id_procedimiento=ap.id_procedimiento
      JOIN estado_cita e ON e.id_estado=c.id_estado
      WHERE e.descripcion='atendida'
        AND ($1::date IS NULL OR c.fecha_hora::date>=$1::date) AND ($2::date IS NULL OR c.fecha_hora::date<=$2::date)
      GROUP BY 1,2,3 ORDER BY 1 DESC`,
    columnas: ["Fecha", "Tratamiento", "Odontólogo", "Cantidad"],
    map: (r) => [r.fecha, r.tratamiento, r.odontologo, Number(r.cantidad)],
  },
  "ranking-tratamientos": {
    titulo: "Ranking de tratamientos",
    sql: (desde, hasta) => `SELECT pr.nombre AS tratamiento, SUM(ap.cantidad) AS total
      FROM atencion_procedimiento ap
      JOIN atencion a ON a.id_atencion=ap.id_atencion
      JOIN cita c ON c.id_cita=a.id_cita
      JOIN estado_cita e ON e.id_estado=c.id_estado
      JOIN procedimiento pr ON pr.id_procedimiento=ap.id_procedimiento
      WHERE e.descripcion='atendida'
        AND ($1::date IS NULL OR c.fecha_hora::date>=$1::date) AND ($2::date IS NULL OR c.fecha_hora::date<=$2::date)
      GROUP BY 1 ORDER BY total DESC LIMIT 10`,
    columnas: ["Tratamiento", "Total realizados"],
    map: (r) => [r.tratamiento, Number(r.total)],
  },
  "metodos-pago": {
    titulo: "Métodos de pago utilizados",
    sql: (desde, hasta) => `SELECT mp.descripcion AS metodo, COUNT(*) AS cantidad, COALESCE(SUM(cb.monto),0) AS total
      FROM cobro cb JOIN metodo_pago mp ON mp.id_metodo_pago=cb.id_metodo_pago
      WHERE cb.anulado=FALSE
        AND ($1::date IS NULL OR cb.fecha_hora::date>=$1::date) AND ($2::date IS NULL OR cb.fecha_hora::date<=$2::date)
      GROUP BY 1 ORDER BY total DESC`,
    columnas: ["Método de pago", "Cantidad", "Total"],
    map: (r) => [r.metodo, Number(r.cantidad), Number(r.total)],
  },
  "cierres-caja": {
    titulo: "Historial de cierres de caja",
    sql: (desde, hasta) => `SELECT c.id_caja, c.fecha_apertura, c.fecha_cierre, c.monto_inicial,
      (SELECT COALESCE(SUM(cb.monto),0) FROM cobro cb WHERE cb.id_caja=c.id_caja AND cb.anulado=FALSE) AS ingresos,
      (SELECT COALESCE(SUM(g.monto),0) FROM gasto g WHERE g.id_caja=c.id_caja AND g.anulado=FALSE) AS egresos,
      c.monto_declarado_cierre, c.diferencia
      FROM caja c WHERE c.estado='cerrada'
        AND ($1::date IS NULL OR c.fecha_cierre::date>=$1::date) AND ($2::date IS NULL OR c.fecha_cierre::date<=$2::date)
      ORDER BY c.fecha_cierre DESC LIMIT 100`,
    columnas: ["# Caja", "Apertura", "Cierre", "Monto inicial", "Ingresos", "Egresos", "Declarado", "Diferencia"],
    map: (r) => [r.id_caja, r.fecha_apertura, r.fecha_cierre, Number(r.monto_inicial), Number(r.ingresos), Number(r.egresos), Number(r.monto_declarado_cierre), Number(r.diferencia)],
  },
};

export async function GET(request) {
  const session = await requireAuth();
  if (!session) return jsonError("No autenticado", 401);
  if (!requireRoles(session, ["admin"])) return jsonError("Solo el administrador puede exportar reportes", 403);

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") || "resumen-dia";
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const errFechas = validarRangoFechas(desde, hasta);
  if (errFechas) return jsonError(errFechas, 400);

  const definicion = REPORTES[tipo];
  if (!definicion) return jsonError("Tipo de reporte no válido", 400);

  let filas;
  try {
    const sqlText = definicion.sql(desde, hasta);
    const usaParams = sqlText.includes("$1");
    const result = await query(sqlText, usaParams ? [desde || null, hasta || null] : []);
    filas = result.rows;
  } catch (err) {
    console.error("Error generando Excel:", err);
    return jsonError("Error generando el reporte", 500);
  }

  const datos = [
    definicion.columnas,
    ...filas.map(definicion.map),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(datos);
  XLSX.utils.book_append_sheet(wb, ws, definicion.titulo.slice(0, 30));
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-${tipo}.xlsx"`,
    },
  });
}