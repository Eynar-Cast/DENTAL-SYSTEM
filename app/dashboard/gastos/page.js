"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { usePermisos } from "@/components/ui/DashboardShell";
import { formatFechaHora, formatMoneda, fechaHoyISO } from "@/lib/utils";

export default function GastosPage({ user }) {
  const { esAdmin, esRecepcion } = usePermisos(user);
  const puedeVer = esAdmin || esRecepcion;

  const [gastos, setGastos] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [fecha, setFecha] = useState(fechaHoyISO());
  const [showForm, setShowForm] = useState(false);
  const [anular, setAnular] = useState(null);
  const toast = useToast();

  async function cargar() {
    try {
      const params = new URLSearchParams();
      if (fecha) params.set("fecha", fecha);
      const data = await apiGet(`/api/gastos?${params.toString()}`);
      setGastos(data);
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  useEffect(() => {
    if (!puedeVer) return;
    let activo = true;
    const params = new URLSearchParams();
    if (fecha) params.set("fecha", fecha);
    apiGet(`/api/gastos?${params.toString()}`)
      .then((data) => { if (activo) setGastos(data); })
      .catch((e) => { if (activo) toast.push("error", e.message); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, puedeVer]);

  useEffect(() => {
    if (puedeVer) apiGet("/api/categorias-gasto").then(setCategorias).catch(() => {});
  }, [puedeVer]);

  if (!puedeVer) {
    return <div className="card"><EmptyState icon="◎" message="Solo administradores y recepción pueden ver gastos" /></div>;
  }

  async function registrar(form) {
    try {
      await apiPost("/api/gastos", {
        id_categoria: Number(form.id_categoria),
        motivo: form.motivo,
        monto: Number(form.monto),
      });
      toast.push("success", "Gasto registrado");
      setShowForm(false);
      cargar();
    } catch (e) {
      toast.push("error", e.message);
      throw e;
    }
  }

  async function anularGasto(g, motivo) {
    setAnular(null);
    try {
      await apiPatch(`/api/gastos/${g.id_gasto}/anular`, { motivo });
      toast.push("success", "Gasto anulado");
      cargar();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  if (!gastos) return <LoadingSpinner />;

  const totalDia = gastos.filter((g) => !g.anulado).reduce((a, g) => a + Number(g.monto), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gastos</h1>
          <p>Registro de gastos operativos del consultorio.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Registrar gasto</button>
      </div>

      <div className="mini-stats">
        <StatCard icon="◎" label="Gastos del día" value={gastos.length} accent="teal" />
        <StatCard icon="₿" label="Total del día" value={formatMoneda(totalDia)} accent="rose" />
        <StatCard icon="◐" label="Anulados" value={gastos.filter((g) => g.anulado).length} accent="slate" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: 170 }} />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Total: {formatMoneda(totalDia)}</span>
      </div>

      {gastos.length === 0 ? (
        <div className="card"><EmptyState icon="◎" message="No se registraron gastos en esta fecha" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Categoría</th>
                <th>Motivo</th>
                <th>Registrado por</th>
                <th>Monto</th>
                <th>Estado</th>
                {esAdmin && <th style={{ textAlign: "right" }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <tr key={g.id_gasto}>
                  <td>{formatFechaHora(g.fecha)}</td>
                  <td><Badge color="amber">{g.categoria}</Badge></td>
                  <td>{g.motivo}</td>
                  <td>{g.usuario_nombres} {g.usuario_apellidos}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{formatMoneda(g.monto)}</td>
                  <td><Badge>{g.anulado ? "anulado" : "válido"}</Badge></td>
                  {esAdmin && !g.anulado && (
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-outline-accent btn-sm" onClick={() => setAnular(g)}>Anular</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <GastoForm categorias={categorias} onClose={() => setShowForm(false)} onSave={registrar} />
      )}

      {anular && (
        <Modal open={true} title="Anular gasto" onClose={() => setAnular(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setAnular(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => anularGasto(anular, document.getElementById("motivo-gasto")?.value)}>Anular gasto</button>
            </>
          }>
          <label className="label">Motivo de anulación *</label>
          <input className="input" id="motivo-gasto" placeholder="Ej. Registro duplicado" autoFocus />
        </Modal>
      )}
    </div>
  );
}

function GastoForm({ categorias, onClose, onSave }) {
  const [form, setForm] = useState({ id_categoria: "", motivo: "", monto: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} title="Registrar gasto" onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" form="gasto-form" type="submit" disabled={loading}>{loading ? "Guardando..." : "Registrar"}</button>
        </>
      }>
      <form id="gasto-form" onSubmit={submit}>
        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 14, background: "var(--danger-ghost)", border: "1px solid rgba(251,113,133,0.35)", color: "var(--danger)", borderRadius: 10, fontSize: 13 }}>{error}</div>
        )}
        <label className="label">Categoría *</label>
        <select className="select" value={form.id_categoria} onChange={(e) => setForm((f) => ({ ...f, id_categoria: e.target.value }))} required>
          <option value="">Selecciona...</option>
          {categorias.map((c) => (
            <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
          ))}
        </select>
        <label className="label" style={{ marginTop: 12 }}>Motivo *</label>
        <input className="input" value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} required placeholder="Ej. Compra de insumos" />
        <label className="label" style={{ marginTop: 12 }}>Monto (Bs) *</label>
        <input className="input" type="number" step="0.01" min="0.01" value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} required />
      </form>
    </Modal>
  );
}