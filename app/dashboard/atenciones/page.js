"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { usePermisos } from "@/components/ui/DashboardShell";
import AtencionForm from "@/components/atenciones/AtencionForm";
import { formatFechaHora, formatMoneda } from "@/lib/utils";

export default function AtencionesPage({ user }) {
  const { esOdontologo, esAdmin } = usePermisos(user);
  const puedeRegistrar = esOdontologo || esAdmin;

  const [atenciones, setAtenciones] = useState(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [detalleData, setDetalleData] = useState(null);
  const toast = useToast();

  async function cargar() {
    try {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const data = await apiGet(`/api/atenciones?${params.toString()}`);
      setAtenciones(data);
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  useEffect(() => {
    let activo = true;
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    apiGet(`/api/atenciones?${params.toString()}`)
      .then((data) => { if (activo) setAtenciones(data); })
      .catch((e) => { if (activo) toast.push("error", e.message); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  async function verDetalle(id) {
    setDetalle(null);
    try {
      const data = await apiGet(`/api/atenciones/${id}`);
      setDetalleData(data);
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  if (!atenciones) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Atenciones clínicas</h1>
          <p>Registro de atenciones odontológicas a partir de citas atendidas.</p>
        </div>
        {puedeRegistrar && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Registrar atención</button>
        )}
      </div>

      <div className="mini-stats">
        <StatCard icon="◆" label="Atenciones en vista" value={atenciones.length} accent="teal" />
        <StatCard icon="☑" label="Semanas de cobertura" value="—" accent="blue" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{atenciones.length} atención(es)</span>
      </div>

      {atenciones.length === 0 ? (
        <div className="card"><EmptyState icon="◆" message="No se encontraron atenciones" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Paciente</th>
                <th>Odontólogo</th>
                <th>Motivo de consulta</th>
                <th style={{ textAlign: "right" }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {atenciones.map((a) => (
                <tr key={a.id_atencion}>
                  <td>{formatFechaHora(a.fecha_hora)}</td>
                  <td>{a.paciente_nombres} {a.paciente_apellidos}</td>
                  <td>{a.odontologo_nombres} {a.odontologo_apellidos}</td>
                  <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.motivo_consulta}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(a.id_atencion)}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <AtencionForm open onClose={() => setShowForm(false)} onSaved={() => { cargar(); toast.push("success", "Atención registrada"); }} />}

      {detalleData && (
        <Modal open={true} title={`Atención #${detalleData.atencion.id_atencion}`} onClose={() => setDetalleData(null)} wide>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600 }}>{detalleData.atencion.paciente_nombres} {detalleData.atencion.paciente_apellidos}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {formatFechaHora(detalleData.atencion.fecha_hora)} · {detalleData.atencion.odontologo_nombres} {detalleData.atencion.odontologo_apellidos}
            </div>
          </div>

          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Motivo de consulta</h4>
          <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 13 }}>{detalleData.atencion.motivo_consulta}</p>

          {detalleData.atencion.sintomas_referidos && (
            <>
              <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Síntomas referidos</h4>
              <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 13 }}>{detalleData.atencion.sintomas_referidos}</p>
            </>
          )}
          {detalleData.atencion.notas_odontologo && (
            <>
              <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Notas del odontólogo</h4>
              <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 13 }}>{detalleData.atencion.notas_odontologo}</p>
            </>
          )}

          <h4 style={{ margin: "16px 0 8px", fontSize: 14 }}>Signos vitales</h4>
          {detalleData.signos_vitales.length === 0 ? (
            <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Sin signos registrados</p>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {detalleData.signos_vitales.map((s) => (
                <span key={s.id_signo} className="badge badge-blue">{s.tipo}: {s.valor} {s.unidad}</span>
              ))}
            </div>
          )}

          <h4 style={{ margin: "16px 0 8px", fontSize: 14 }}>Diagnósticos</h4>
          {detalleData.diagnosticos.length === 0 ? (
            <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Sin diagnósticos registrados</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-muted)", fontSize: 13 }}>
              {detalleData.diagnosticos.map((d, i) => (
                <li key={i}><b>{d.codigo_diagnostico}</b> — {d.descripcion}</li>
              ))}
            </ul>
          )}

          <h4 style={{ margin: "16px 0 8px", fontSize: 14 }}>Procedimientos realizados</h4>
          {detalleData.procedimientos.length === 0 ? (
            <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Sin procedimientos registrados</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Procedimiento</th>
                    <th>Cantidad</th>
                    <th>P. unitario</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleData.procedimientos.map((p, i) => (
                    <tr key={i}>
                      <td>{p.procedimiento}</td>
                      <td>{p.cantidad}</td>
                      <td>{formatMoneda(p.precio_actual)}</td>
                      <td>{formatMoneda(Number(p.precio_actual) * Number(p.cantidad))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}