"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { usePermisos } from "@/components/ui/DashboardShell";
import { formatFechaHora, formatMoneda, fechaHoyISO } from "@/lib/utils";

export default function CajaPage({ user }) {
  const { esAdmin } = usePermisos(user);

  const [caja, setCaja] = useState(null);
  const [movimientos, setMovimientos] = useState(null);
  const [presupuestos, setPresupuestos] = useState(null);
  const [metodos, setMetodos] = useState([]);

  const [showApertura, setShowApertura] = useState(false);
  const [showPresupuesto, setShowPresupuesto] = useState(false);
  const [showCobro, setShowCobro] = useState(null);
  const [showCierre, setShowCierre] = useState(false);
  const [confirmAnular, setConfirmAnular] = useState(null);

  const toast = useToast();

  async function cargarTodo() {
    await Promise.all([cargarCaja(), cargarMovimientos(), cargarPresupuestos()]);
  }

  async function cargarCaja() {
    try { setCaja(await apiGet("/api/caja/actual")); } catch (e) { toast.push("error", e.message); }
  }
  async function cargarMovimientos() {
    try { setMovimientos(await apiGet("/api/caja/movimientos-dia")); } catch (e) { toast.push("error", e.message); }
  }
  async function cargarPresupuestos() {
    try { setPresupuestos(await apiGet("/api/presupuestos")); } catch (e) { toast.push("error", e.message); }
  }

  useEffect(() => {
    cargarTodo();
    apiGet("/api/metodos-pago").then(setMetodos).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrirCaja(monto) {
    try {
      await apiPost("/api/caja/apertura", { monto_inicial: Number(monto) });
      toast.push("success", "Caja abierta");
      setShowApertura(false);
      cargarTodo();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  async function cobrar({ idPresupuesto, monto, idMetodo }) {
    try {
      await apiPost("/api/cobros", { id_presupuesto: Number(idPresupuesto), id_metodo_pago: Number(idMetodo), monto: Number(monto) });
      toast.push("success", "Pago registrado");
      setShowCobro(null);
      cargarTodo();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  async function cerrarCaja(monto) {
    try {
      await apiPost("/api/caja/cierre", { monto_declarado: Number(monto) });
      toast.push("success", "Caja cerrada");
      setShowCierre(false);
      cargarTodo();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  async function anularMovimiento(mov) {
    setConfirmAnular(null);
    try {
      if (mov.tipo === "cobro") {
        await apiPatch(`/api/cobros/${mov.id_cobro}/anular`, { motivo: mov.motivoAnulacion });
      } else {
        await apiPatch(`/api/gastos/${mov.id_gasto}/anular`, { motivo: mov.motivoAnulacion });
      }
      toast.push("success", "Movimiento anulado");
      cargarTodo();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  if (!caja || !movimientos || !presupuestos) return <LoadingSpinner />;

  const pendientes = presupuestos.filter((p) => p.estado === "pendiente");
  const totalPendiente = pendientes.reduce((a, p) => a + Number(p.total), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Caja y cobros</h1>
          <p>{caja.estado === "abierta" ? "Jornada en curso" : "Caja cerrada — abre la jornada para operar."}</p>
        </div>
        {caja.estado === "cerrada" ? (
          <button className="btn btn-primary" onClick={() => setShowApertura(true)}>Abrir caja</button>
        ) : (
          <button className="btn btn-outline-accent" onClick={() => setShowCierre(true)}>Cerrar caja</button>
        )}
      </div>

      {caja.estado === "abierta" && (
        <>
          <div className="mini-stats">
            <StatCard icon="₿" label="Monto inicial" value={formatMoneda(caja.caja.monto_inicial)} accent="teal" />
            <StatCard icon="✓" label="Ingresos del día" value={formatMoneda(caja.ingresos_dia)} accent="green" />
            <StatCard icon="◎" label="Egresos del día" value={formatMoneda(caja.egresos_dia)} accent="rose" />
            <StatCard icon="Σ" label="Saldo esperado" value={formatMoneda(caja.saldo_esperado)} accent="blue" sub={`Apertura: ${formatFechaHora(caja.caja.fecha_apertura)} · ${caja.caja.usuario_nombres} ${caja.caja.usuario_apellidos}`} />
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Presupuestos pendientes de cobro</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowPresupuesto(true)}>+ Generar presupuesto</button>
            </div>
            {pendientes.length === 0 ? (
              <EmptyState icon="₿" message="No hay presupuestos pendientes" />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Paciente</th>
                      <th>Fecha de emisión</th>
                      <th>Total</th>
                      <th style={{ textAlign: "right" }}>Cobrar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map((p) => (
                      <tr key={p.id_presupuesto}>
                        <td className="mono">#{p.id_presupuesto}</td>
                        <td>{p.paciente_nombres} {p.paciente_apellidos} <span className="mono" style={{ color: "var(--text-faint)" }}>({p.paciente_ci})</span></td>
                        <td>{formatFechaHora(p.fecha_emision)}</td>
                        <td className="mono" style={{ fontWeight: 600 }}>{formatMoneda(p.total)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button className="btn btn-primary btn-sm" onClick={() => setShowCobro(p)}>Cobrar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Movimientos del día</h3>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)" }}>
              Pendiente de cobro: {formatMoneda(totalPendiente)} en {pendientes.length} presupuesto(s)
            </p>
            {movimientos.movimientos.length === 0 ? (
              <EmptyState icon="⇄" message="Sin movimientos en la jornada" />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Detalle</th>
                      <th>Monto</th>
                      <th>Hora</th>
                      <th>Estado</th>
                      {esAdmin && <th style={{ textAlign: "right" }}>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.movimientos.map((m, i) => (
                      <tr key={`${m.tipo}-${m.id_cobro || m.id_gasto}-${i}`}>
                        <td><Badge>{m.tipo}</Badge></td>
                        <td>
                          {m.tipo === "cobro"
                            ? `${m.paciente_nombres} ${m.paciente_apellidos} · ${m.metodo_pago}`
                            : m.categoria + (m.motivo ? ` — ${m.motivo}` : "")}
                        </td>
                        <td className="mono" style={{ fontWeight: 600 }}>{formatMoneda(m.monto)}</td>
                        <td>{formatFechaHora(m.fecha_hora)}</td>
                        <td><Badge>{m.anulado ? "anulado" : "válido"}</Badge></td>
                        {esAdmin && !m.anulado && (
                          <td style={{ textAlign: "right" }}>
                            <button className="btn btn-outline-accent btn-sm" onClick={() => setConfirmAnular(m)}>Anular</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {caja.estado === "cerrada" && (
        <div className="card"><EmptyState icon="₿" message="Abre la caja para registrar cobros y movimientos" /></div>
      )}

      <Modal open={showApertura} title="Abrir caja" onClose={() => setShowApertura(false)}
        footer={<AperturaFooter onCancel={() => setShowApertura(false)} onConfirm={abrirCaja} />}>
        <label className="label">Monto inicial en caja (Bs)</label>
        <input className="input" type="number" step="0.01" min="0" defaultValue="0" id="monto-apertura" autoFocus />
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>Fecha de apertura: {fechaHoyISO()}</p>
      </Modal>

      {showPresupuesto && (
        <PresupuestoForm onClose={() => setShowPresupuesto(false)} onSaved={() => { cargarTodo(); toast.push("success", "Presupuesto generado"); }} />
      )}

      {showCobro && (
        <Modal open={true} title={`Cobrar presupuesto #${showCobro.id_presupuesto}`} onClose={() => setShowCobro(null)}
          footer={<CobroFooter presupuesto={showCobro} onCancel={() => setShowCobro(null)} onConfirm={cobrar} />}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>{showCobro.paciente_nombres} {showCobro.paciente_apellidos}</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Total: <b style={{ color: "var(--text)" }}>{formatMoneda(showCobro.total)}</b></div>
          </div>
          <label className="label">Método de pago</label>
          <select className="select" id="cobro-metodo">
            {metodos.map((m) => (
              <option key={m.id_metodo_pago} value={m.id_metodo_pago}>{m.descripcion}</option>
            ))}
          </select>
        </Modal>
      )}

      <Modal open={showCierre} title="Cerrar caja" onClose={() => setShowCierre(false)}
        footer={<CierreFooter caja={caja} onCancel={() => setShowCierre(false)} onConfirm={cerrarCaja} />}>
        <div style={{ marginBottom: 12 }}>
          <StatCard icon="Σ" label="Saldo esperado" value={formatMoneda(caja.saldo_esperado)} accent="blue" />
        </div>
        <label className="label">Monto declarado en caja (Bs)</label>
        <input className="input" type="number" step="0.01" min="0" id="monto-cierre" defaultValue={caja.saldo_esperado} autoFocus />
      </Modal>

      {confirmAnular && (
        <Modal open={true} title={`Anular ${confirmAnular.tipo}`} onClose={() => setConfirmAnular(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmAnular(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => anularMovimiento({ ...confirmAnular, motivoAnulacion: document.getElementById("motivo-anulacion")?.value || "Anulación manual" })}>
                Anular movimiento
              </button>
            </>
          }>
          <label className="label">Motivo de anulación *</label>
          <input className="input" id="motivo-anulacion" placeholder="Ej. Pago registrado por error" />
        </Modal>
      )}
    </div>
  );
}

function AperturaFooter({ onCancel, onConfirm }) {
  return (
    <>
      <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      <button className="btn btn-primary" onClick={() => onConfirm(document.getElementById("monto-apertura")?.value || 0)}>Abrir caja</button>
    </>
  );
}

function CobroFooter({ presupuesto, onCancel, onConfirm }) {
  return (
    <>
      <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      <button className="btn btn-primary" onClick={() => onConfirm({ idPresupuesto: presupuesto.id_presupuesto, monto: presupuesto.total, idMetodo: document.getElementById("cobro-metodo")?.value })}>
        Confirmar pago
      </button>
    </>
  );
}

function CierreFooter({ caja, onCancel, onConfirm }) {
  return (
    <>
      <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      <button className="btn btn-outline-accent" onClick={() => onConfirm(document.getElementById("monto-cierre")?.value)}>Cerrar caja</button>
    </>
  );
}

function PresupuestoForm({ onClose, onSaved }) {
  const [pacientes, setPacientes] = useState([]);
  const [procedimientos, setProcedimientos] = useState([]);
  const [qPaciente, setQPaciente] = useState("");
  const [idPaciente, setIdPaciente] = useState("");
  const [detalle, setDetalle] = useState([{ id_procedimiento: "", cantidad: 1 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet("/api/atenciones/procedimientos").then(setProcedimientos).catch(() => {});
    apiGet(`/api/pacientes?q=${encodeURIComponent(qPaciente)}`).then(setPacientes).catch(() => setPacientes([]));
  }, [qPaciente]);

  const total = detalle.reduce((acc, d) => {
    const p = procedimientos.find((x) => x.id_procedimiento === Number(d.id_procedimiento));
    return acc + (p ? Number(p.precio_actual) * Number(d.cantidad || 0) : 0);
  }, 0);

  const setDet = (idx, campo, valor) => setDetalle((prev) => prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        id_paciente: Number(idPaciente),
        detalle: detalle.filter((d) => d.id_procedimiento).map((d) => ({ id_procedimiento: Number(d.id_procedimiento), cantidad: Number(d.cantidad) })),
      };
      await apiPost("/api/presupuestos", body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} title="Generar presupuesto" onClose={onClose} wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" form="presupuesto-form" type="submit" disabled={loading}>
            {loading ? "Generando..." : `Generar (${formatMoneda(total)})`}
          </button>
        </>
      }>
      <form id="presupuesto-form" onSubmit={submit}>
        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 14, background: "var(--danger-ghost)", border: "1px solid rgba(251,113,133,0.35)", color: "var(--danger)", borderRadius: 10, fontSize: 13 }}>{error}</div>
        )}
        <label className="label">Paciente *</label>
        <input className="input" placeholder="Buscar por nombre o CI..." value={qPaciente} onChange={(e) => setQPaciente(e.target.value)} style={{ marginBottom: 8 }} />
        <select className="select" value={idPaciente} onChange={(e) => setIdPaciente(e.target.value)} required>
          <option value="">Selecciona un paciente...</option>
          {pacientes.map((p) => (
            <option key={p.id_paciente} value={p.id_paciente}>{p.nombres} {p.apellidos} ({p.documento_identidad})</option>
          ))}
        </select>

        <h4 style={{ margin: "16px 0 8px", fontSize: 14 }}>Detalle de procedimientos</h4>
        {detalle.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
            <select className="select" value={d.id_procedimiento} onChange={(e) => setDet(i, "id_procedimiento", e.target.value)} style={{ flex: 1 }} required={i === 0}>
              <option value="">Procedimiento...</option>
              {procedimientos.map((p) => (
                <option key={p.id_procedimiento} value={p.id_procedimiento}>{p.nombre} — {formatMoneda(p.precio_actual)}</option>
              ))}
            </select>
            <input className="input" type="number" min="1" value={d.cantidad} onChange={(e) => setDet(i, "cantidad", e.target.value)} style={{ width: 90 }} required />
            <button type="button" className="icon-btn" onClick={() => setDetalle(detalle.filter((_, x) => x !== i))} aria-label="Quitar">✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetalle([...detalle, { id_procedimiento: "", cantidad: 1 }])}>+ Agregar procedimiento</button>

        <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
          <span>Total del presupuesto</span>
          <span className="mono">{formatMoneda(total)}</span>
        </div>
      </form>
    </Modal>
  );
}