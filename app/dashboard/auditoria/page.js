"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { usePermisos } from "@/components/ui/DashboardShell";
import { formatFechaHora } from "@/lib/utils";

const TABLAS = ["usuario", "paciente", "personal", "cita", "atencion", "procedimiento", "precio_historial", "caja", "presupuesto", "cobro", "gasto"];

const ESTADOS_SESION = {
  activa: "green",
  cerrada: "slate",
  expirada: "amber",
};

export default function AuditoriaPage({ user }) {
  const { esAdmin } = usePermisos(user);

  const [vista, setVista] = useState("bitacora");
  const [registros, setRegistros] = useState(null);
  const [sesiones, setSesiones] = useState(null);
  const [tabla, setTabla] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [ver, setVer] = useState(null);
  const toast = useToast();

  useEffect(() => {
    let activo = true;
    const params = new URLSearchParams();
    if (tabla) params.set("tabla", tabla);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    params.set("limit", "100");
    apiGet(`/api/auditoria?${params.toString()}`)
      .then((data) => { if (activo) setRegistros(data); })
      .catch((e) => { if (activo) toast.push("error", e.message); });

    apiGet("/api/sesiones")
      .then((data) => { if (activo) setSesiones(data); })
      .catch((e) => { if (activo) toast.push("error", e.message); });

    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla, desde, hasta]);

  if (!esAdmin) {
    return <div className="card"><EmptyState icon="⚿" message="Solo el administrador puede ver la auditoría" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Auditoría</h1>
          <p>Bitácora de operaciones sensibles y sesiones de los usuarios.</p>
        </div>
        <span className="badge badge-white">
          {vista === "bitacora"
            ? `${registros?.total ?? "..."} evento(s)`
            : `${sesiones?.length ?? "..."} sesión(es)`}
        </span>
      </div>

      <div className="tabs">
        <button className={`tab ${vista === "bitacora" ? "active" : ""}`} onClick={() => setVista("bitacora")}>Bitácora</button>
        <button className={`tab ${vista === "sesiones" ? "active" : ""}`} onClick={() => setVista("sesiones")}>Sesiones</button>
      </div>

      {vista === "sesiones" ? (
        <SesionesView sesiones={sesiones} />
      ) : registros ? (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <select className="select" value={tabla} onChange={(e) => setTabla(e.target.value)} style={{ width: 190 }}>
              <option value="">Todas las tablas</option>
              {TABLAS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input className="input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 160 }} />
            <input className="input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 160 }} />
          </div>

          {registros.registros.length === 0 ? (
            <div className="card"><EmptyState icon="⚿" message="No hay eventos de auditoría con esos filtros" /></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Usuario</th>
                    <th>Tabla</th>
                    <th>Operación</th>
                    <th>Registro</th>
                    <th>IP</th>
                    <th style={{ textAlign: "right" }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.registros.map((r) => (
                    <tr key={r.id_auditoria}>
                      <td>{formatFechaHora(r.fecha_hora)}</td>
                      <td>{r.nombres} {r.apellidos} <span style={{ color: "var(--text-faint)" }}>({r.email})</span></td>
                      <td><Badge color="slate">{r.tabla_afectada}</Badge></td>
                      <td><Badge>{r.operacion}</Badge></td>
                      <td className="mono">{r.id_registro_afectado}</td>
                      <td className="mono">{r.ip_origen}</td>
                      <td style={{ textAlign: "right" }}>
                        {(r.valor_anterior || r.valor_nuevo) && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setVer(r)}>Ver</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ver && (
            <Modal open={true} title={`Auditoría #${ver.id_auditoria}`} onClose={() => setVer(null)} wide>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
                {formatFechaHora(ver.fecha_hora)} · {ver.nombres} {ver.apellidos} · {ver.tabla_afectada} · operación {ver.operacion} · IP {ver.ip_origen}
              </div>
              {ver.valor_anterior && (
                <>
                  <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Valor anterior</h4>
                  <pre className="json-block">{JSON.stringify(JSON.parse(ver.valor_anterior), null, 2)}</pre>
                </>
              )}
              {ver.valor_nuevo && (
                <>
                  <h4 style={{ margin: "16px 0 8px", fontSize: 14 }}>Valor nuevo</h4>
                  <pre className="json-block">{JSON.stringify(JSON.parse(ver.valor_nuevo), null, 2)}</pre>
                </>
              )}
            </Modal>
          )}
        </div>
      ) : (
        <LoadingSpinner />
      )}
    </div>
  );
}

function SesionesView({ sesiones }) {
  if (!sesiones) return <LoadingSpinner />;

  return sesiones.length === 0 ? (
    <div className="card"><EmptyState icon="⌁" message="No hay sesiones registradas todavía" /></div>
  ) : (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Usuario</th>
            <th>IP</th>
            <th>Navegador</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {sesiones.map((s) => (
            <tr key={s.id_sesion}>
              <td>{formatFechaHora(s.fecha_inicio)}</td>
              <td>{formatFechaHora(s.fecha_fin)}</td>
              <td>{s.nombres} {s.apellidos} <span style={{ color: "var(--text-faint)" }}>({s.email})</span></td>
              <td className="mono">{s.ip_origen}</td>
              <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.user_agent || ""}>
                {s.user_agent || "—"}
              </td>
              <td><Badge color={ESTADOS_SESION[s.estado] || "white"}>{s.estado}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}