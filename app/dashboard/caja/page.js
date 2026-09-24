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
  const { esAdmin, esRecepcion } = usePermisos(user);
  const puedeCaja = esAdmin || esRecepcion;

  const [caja, setCaja] = useState(null);
  const [movimientos, setMovimientos] = useState(null);
  const [presupuestos, setPresupuestos] = useState(null);
  const [metodos, setMetodos] = useState([]);

  const [showApertura, setShowApertura] = useState(false);
  const [showPresupuesto, setShowPresupuesto] = useState(false);
  const [showCobro, setShowCobro] = useState(null);
  const [showCierre, setShowCierre] = useState(false);
  const [confirmAnular, setConfirmAnular] = useState(null);
  const [operando, setOperando] = useState(false);

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
    if (!puedeCaja) return;
    cargarTodo();
    apiGet("/api/metodos-pago").then(setMetodos).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeCaja]);

  if (!puedeCaja) {
    return <div className="card"><EmptyState icon="₿" message="Solo administradores y recepción pueden operar la caja" /></div>;
  }

  async function abrirCaja(monto) {
    if (operando) return;
    setOperando(true);
    try {
      await apiPost("/api/caja/apertura", { monto_inicial: Number(monto) });
      toast.push("success", "Caja abierta");
      setShowApertura(false);
      cargarTodo();
    } catch (e) {
      toast.push("error", e.message);
    } finally {
      setOperando(false);
    }
  }

  async function cobrar({ idPresupuesto, monto, idMetodo }) {
    if (operando) return;
    setOperando(true);
    try {
      const res = await apiPost("/api/cobros", { id_presupuesto: Number(idPresupuesto), id_metodo_pago: Number(idMetodo), monto: Number(monto) });
      toast.push("success", res.mensaje || "Pago registrado");
      setShowCobro(null);
      cargarTodo();
    } catch (e) {
      toast.push("error", e.message);
    } finally {
      setOperando(false);
    }
  }

  async function cerrarCaja(monto) {
    if (operando) return;
    setOperando(true);
    try {
      await apiPost("/api/caja/cierre", { monto_declarado: Number(monto) });
      toast.push("success", "Caja cerrada");
      setShowCierre(false);
      cargarTodo();
    } catch (e) {
      toast.push("error", e.message);
    } finally {
      setOperando(false);
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

  const pendientes = presupuestos.filter((p) => p.estado === "pendiente" || p.estado === "parcial");
  const totalPendiente = pendientes.reduce((a, p) => a + Number(p.saldo_restante ?? p.total), 0);
  const totalPagadoPendientes = pendientes.reduce((a, p) => a + Number(p.monto_pagado ?? 0), 0);

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
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Pagado</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                      <th style={{ textAlign: "right" }}>Cobrar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map((p) => {
                      const pagado = Number(p.monto_pagado ?? 0);
                      const saldo = Number(p.saldo_restante ?? p.total);
                      return (
                      <tr key={p.id_presupuesto}>
                        <td className="mono">#{p.id_presupuesto}</td>
                        <td>{p.paciente_nombres} {p.paciente_apellidos} <span className="mono" style={{ color: "var(--text-faint)" }}>({p.paciente_ci})</span></td>
                        <td>{formatFechaHora(p.fecha_emision)}</td>
                        <td className="mono">{formatMoneda(p.total)}</td>
                        <td className="mono" style={{ color: pagado > 0 ? "var(--success)" : undefined, fontWeight: pagado > 0 ? 600 : 400 }}>{formatMoneda(pagado)}</td>
                        <td className="mono" style={{ fontWeight: 700, color: p.estado === 'parcial' ? "var(--warning, #d97706)" : "var(--text)" }}>{formatMoneda(saldo)}</td>
                        <td><Badge>{p.estado === 'parcial' ? 'parcial' : 'pendiente'}</Badge></td>
                        <td style={{ textAlign: "right" }}>
                          <button className="btn btn-primary btn-sm" onClick={() => setShowCobro(p)}>Cobrar</button>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Movimientos del día</h3>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)" }}>
              Saldo pendiente: {formatMoneda(totalPendiente)} en {pendientes.length} presupuesto(s) · Pagado parcial acumulado: {formatMoneda(totalPagadoPendientes)}
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
        <CobroModal presupuesto={showCobro} metodos={metodos} onClose={() => setShowCobro(null)} onConfirm={cobrar} />
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
              <button className="btn btn-danger" onClick={() => {
                const motivo = document.getElementById("motivo-anulacion")?.value || "";
                if (!motivo.trim()) {
                  toast.push("error", "El motivo de anulación es obligatorio");
                  return;
                }
                anularMovimiento({ ...confirmAnular, motivoAnulacion: motivo });
              }}>
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

function CobroModal({ presupuesto, metodos, onClose, onConfirm }) {
  const total = Number(presupuesto.total);
  const pagado = Number(presupuesto.monto_pagado ?? 0);
  const saldo = Number(presupuesto.saldo_restante ?? total);
  const saldoExacto = Number((total - pagado).toFixed(2));
  const [tipoPago, setTipoPago] = useState("contado");
  const [montoParcial, setMontoParcial] = useState("");
  const [idMetodo, setIdMetodo] = useState(metodos[0]?.id_metodo_pago || "");
  const [error, setError] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (metodos.length && !idMetodo) setIdMetodo(metodos[0].id_metodo_pago); }, [metodos, idMetodo]);

  const montoEfectivo = tipoPago === "contado" ? saldoExacto : Number(montoParcial);
  const saldoRestantePreview = tipoPago === "contado" ? 0 : Number((saldoExacto - Number(montoParcial || 0)).toFixed(2));

  function handleConfirm() {
    setError("");
    if (!idMetodo) { setError("Selecciona un método de pago"); return; }
    if (tipoPago === "contado") {
      onConfirm({ idPresupuesto: presupuesto.id_presupuesto, monto: saldoExacto, idMetodo });
      return;
    }
    const m = Number(montoParcial);
    if (!Number.isFinite(m) || m <= 0) { setError("Ingresa un monto válido mayor a 0"); return; }
    if (m >= saldoExacto) { setError(`El pago parcial debe ser menor al saldo (${formatMoneda(saldoExacto)}). Para pagar todo usa "Pagar todo al contado".`); return; }
    if (m > saldoExacto) { setError(`El monto no puede exceder el saldo pendiente (${formatMoneda(saldoExacto)})`); return; }
    onConfirm({ idPresupuesto: presupuesto.id_presupuesto, monto: m, idMetodo });
  }

  return (
    <Modal open={true} title={`Cobrar presupuesto #${presupuesto.id_presupuesto}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={handleConfirm}>{tipoPago === "contado" ? `Cobrar ${formatMoneda(saldoExacto)}` : `Cobrar ${formatMoneda(montoEfectivo || 0)}`}</button></>}>
      <div style={{ marginBottom: 14, padding: 12, background: "var(--surface-2)", borderRadius: 10 }}>
        <div style={{ fontWeight: 600 }}>{presupuesto.paciente_nombres} {presupuesto.paciente_apellidos} <span className="mono" style={{ color: "var(--text-faint)", fontWeight: 400 }}>({presupuesto.paciente_ci})</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10, fontSize: 13 }}>
          <div><div style={{ color: "var(--text-muted)" }}>Total</div><b className="mono">{formatMoneda(total)}</b></div>
          <div><div style={{ color: "var(--text-muted)" }}>Ya pagado</div><b className="mono" style={{ color: pagado > 0 ? "var(--success)" : undefined }}>{formatMoneda(pagado)}</b></div>
          <div><div style={{ color: "var(--text-muted)" }}>Saldo pendiente</div><b className="mono" style={{ color: "var(--danger)" }}>{formatMoneda(saldoExacto)}</b></div>
        </div>
        {presupuesto.estado === 'parcial' && <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>Este presupuesto ya tiene un abono parcial. El saldo restante se cobra en esta o la siguiente consulta.</div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: tipoPago === 'contado' ? "2px solid var(--accent)" : "1px solid var(--border)", cursor: "pointer", background: tipoPago === 'contado' ? "var(--accent-ghost)" : "transparent" }}>
          <input type="radio" name="tipoPago" checked={tipoPago === 'contado'} onChange={() => setTipoPago('contado')} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Pagar todo al contado</span>
        </label>
        <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: tipoPago === 'parcial' ? "2px solid var(--accent)" : "1px solid var(--border)", cursor: "pointer", background: tipoPago === 'parcial' ? "var(--accent-ghost)" : "transparent" }}>
          <input type="radio" name="tipoPago" checked={tipoPago === 'parcial'} onChange={() => setTipoPago('parcial')} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Pagar una parte</span>
        </label>
      </div>

      {tipoPago === 'contado' ? (
        <div style={{ padding: "10px 12px", background: "var(--success-ghost, #ecfdf5)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, fontSize: 13 }}>
          Se cobrará el saldo completo: <b className="mono">{formatMoneda(saldoExacto)}</b>. El presupuesto quedará <b>pagado</b>.
        </div>
      ) : (
        <div>
          <label className="label">Monto a pagar ahora (Bs) *</label>
          <input className="input" type="number" step="0.01" min="0.01" max={saldoExacto - 0.01} placeholder={`Máx. ${saldoExacto.toFixed(2)}`} value={montoParcial} onChange={(e) => setMontoParcial(e.target.value)} autoFocus />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
            <span style={{ color: "var(--text-muted)" }}>Saldo restante para la siguiente consulta:</span>
            <b className="mono" style={{ color: Number(montoParcial) > 0 && saldoRestantePreview >= 0 ? "var(--danger)" : "var(--text-muted)" }}>{formatMoneda(saldoRestantePreview >= 0 ? saldoRestantePreview : saldoExacto)}</b>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>El monto pagado y el saldo se guardan exactamente. El restante queda pendiente para la siguiente consulta.</p>
        </div>
      )}

      {error && <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--danger-ghost)", border: "1px solid rgba(251,113,133,0.35)", color: "var(--danger)", borderRadius: 10, fontSize: 13 }}>{error}</div>}

      <label className="label" style={{ marginTop: 14 }}>Método de pago *</label>
      <select className="select" value={idMetodo} onChange={(e) => setIdMetodo(e.target.value)}>
        {metodos.map((m) => (<option key={m.id_metodo_pago} value={m.id_metodo_pago}>{m.descripcion}</option>))}
      </select>
    </Modal>
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
    apiGet("/api/procedimientos").then(setProcedimientos).catch(() => {});
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
      const detalleValido = detalle.filter((d) => d.id_procedimiento);
      if (detalleValido.length === 0) {
        setError("Agrega al menos un procedimiento");
        setLoading(false);
        return;
      }
      if (detalleValido.some((d) => Number(d.cantidad) <= 0 || !Number.isInteger(Number(d.cantidad)))) {
        setError("La cantidad de procedimientos debe ser un número entero mayor a 0");
        setLoading(false);
        return;
      }
      const body = {
        id_paciente: Number(idPaciente),
        detalle: detalleValido.map((d) => ({ id_procedimiento: Number(d.id_procedimiento), cantidad: Number(d.cantidad) })),
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
          <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8, alignItems: "center" }}>
            <select className="select" value={d.id_procedimiento} onChange={(e) => setDet(i, "id_procedimiento", e.target.value)} style={{ flex: 1 }} required={i === 0}>
              <option value="">Procedimiento...</option>
              {procedimientos.map((p) => (
                <option key={p.id_procedimiento} value={p.id_procedimiento}>{p.nombre} — {formatMoneda(p.precio_actual)}</option>
              ))}
            </select>
            <input className="input" type="number" min="1" step="1" value={d.cantidad} onChange={(e) => setDet(i, "cantidad", e.target.value)} style={{ width: 90 }} required />
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