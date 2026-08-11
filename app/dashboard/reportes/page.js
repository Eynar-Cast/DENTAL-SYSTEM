"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { usePermisos } from "@/components/ui/DashboardShell";
import { formatFechaHora, formatMoneda } from "@/lib/utils";

const TABS = [
  { key: "utilidad", label: "Resumen financiero", tipoExcel: "resumen-dia" },
  { key: "ingresos", label: "Ingresos", tipoExcel: "movimientos" },
  { key: "egresos", label: "Egresos", tipoExcel: null },
  { key: "pacientes-atendidos", label: "Pacientes atendidos", tipoExcel: "pacientes-atendidos" },
  { key: "tratamientos-realizados", label: "Tratamientos realizados", tipoExcel: "tratamientos" },
  { key: "ranking-tratamientos", label: "Ranking de tratamientos", tipoExcel: "ranking-tratamientos" },
  { key: "metodos-pago", label: "Métodos de pago", tipoExcel: "metodos-pago" },
  { key: "comparacion-ingresos", label: "Ingresos mensuales", tipoExcel: null },
  { key: "cierres-caja", label: "Cierres de caja", tipoExcel: "cierres-caja" },
];

export default function ReportesPage({ user }) {
  const { esAdmin } = usePermisos(user);
  const [tab, setTab] = useState("utilidad");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [resultado, setResultado] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (!esAdmin) return;
    let activo = true;
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);

    apiGet(`/api/reportes/${tab}?${params.toString()}`)
      .then((d) => { if (activo) setResultado({ tab, data: d }); })
      .catch((e) => { if (activo) toast.push("error", e.message); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, desde, hasta, esAdmin]);

  const data = resultado && resultado.tab === tab ? resultado.data : null;

  if (!esAdmin) {
    return (
      <div className="card">
        <EmptyState icon="◉" message="Solo el administrador puede ver reportes" />
      </div>
    );
  }

  const excelUrl = `/api/reportes/excel?tipo=${encodeURIComponent(TABS.find((t) => t.key === tab)?.tipoExcel || "")}&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reportes</h1>
          <p>Indicadores y estadísticas del consultorio.</p>
        </div>
        {TABS.find((t) => t.key === tab)?.tipoExcel && (
          <a className="btn btn-primary" href={excelUrl} download>⬇ Exportar Excel</a>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`pill ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <label className="label" style={{ marginBottom: 0 }}>Desde</label>
        <input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 160 }} />
        <label className="label" style={{ marginBottom: 0 }}>Hasta</label>
        <input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 160 }} />
      </div>

      {!data && <LoadingSpinner />}
      {data && <TablaReporte tab={tab} data={data} />}
    </div>
  );
}

function TablaReporte({ tab, data }) {
  if (["utilidad", "ingresos", "egresos"].includes(tab)) {
    return (
      <>
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Diario</h3>
          {data.diario.length === 0 ? <EmptyState icon="◉" message="Sin datos en el rango seleccionado" /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Ingresos</th><th>Egresos</th>{tab === "utilidad" && <th>Utilidad</th>}</tr></thead>
                <tbody>
                  {data.diario.map((r, i) => (
                    <tr key={i}>
                      <td>{formatFechaHora(r.fecha)}</td>
                      <td className="mono">{tab === "ingresos" || tab === "utilidad" ? formatMoneda(r.ingresos) : "—"}</td>
                      <td className="mono">{tab === "egresos" || tab === "utilidad" ? formatMoneda(r.egresos) : "—"}</td>
                      {tab === "utilidad" && <td className="mono">{formatMoneda(r.utilidad)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Mensual</h3>
          {data.mensual.length === 0 ? <EmptyState icon="◉" message="Sin datos mensuales" /> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Mes</th><th>Ingresos</th><th>Egresos</th>{tab === "utilidad" && <th>Utilidad</th>}</tr></thead>
                <tbody>
                  {data.mensual.map((r, i) => (
                    <tr key={i}>
                      <td>{r.mes}</td>
                      <td className="mono">{tab === "ingresos" || tab === "utilidad" ? formatMoneda(r.ingresos) : "—"}</td>
                      <td className="mono">{tab === "egresos" || tab === "utilidad" ? formatMoneda(r.egresos) : "—"}</td>
                      {tab === "utilidad" && <td className="mono">{formatMoneda(r.utilidad)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  if (tab === "pacientes-atendidos") return <Tabla columnas={["Fecha", "Pacientes", "Citas atendidas"]} filas={data.map((r) => [formatFechaHora(r.fecha), r.pacientes, r.citas_atendidas])} />;
  if (tab === "tratamientos-realizados") return <Tabla columnas={["Fecha", "Tratamiento", "Odontólogo", "Cantidad"]} filas={data.map((r) => [formatFechaHora(r.fecha), r.tratamiento, `${r.odontologo_nombres} ${r.odontologo_apellidos}`, r.cantidad])} />;
  if (tab === "ranking-tratamientos") return <Tabla columnas={["Tratamiento", "Total realizados"]} filas={data.map((r) => [r.tratamiento, r.total])} />;
  if (tab === "metodos-pago") return <Tabla columnas={["Método de pago", "Cantidad", "Total"]} filas={data.map((r) => [r.metodo_pago, r.cantidad, formatMoneda(r.total)])} />;
  if (tab === "comparacion-ingresos") return <Tabla columnas={["Mes", "Ingresos"]} filas={data.map((r) => [r.mes, formatMoneda(r.ingresos)])} />;
  if (tab === "cierres-caja") {
    return <Tabla columnas={["#", "Apertura", "Cierre", "Inicial", "Ingresos", "Egresos", "Declarado", "Diferencia"]}
      filas={data.map((r) => [
        `#${r.id_caja}`, formatFechaHora(r.fecha_apertura), formatFechaHora(r.fecha_cierre),
        formatMoneda(r.monto_inicial), formatMoneda(r.ingresos), formatMoneda(r.egresos),
        formatMoneda(r.monto_declarado_cierre), formatMoneda(r.diferencia),
      ])} />;
  }
  return null;
}

function Tabla({ columnas, filas }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      {filas.length === 0 ? <EmptyState icon="◉" message="Sin datos para mostrar" /> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>{columnas.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((celda, j) => <td key={j}>{celda}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}