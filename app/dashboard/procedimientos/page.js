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
import { formatMoneda } from "@/lib/utils";

export default function ProcedimientosPage({ user }) {
  const { esAdmin } = usePermisos(user);

  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editPrecio, setEditPrecio] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  async function cargar() {
    try {
      const url = q ? `/api/procedimientos?q=${encodeURIComponent(q)}` : "/api/procedimientos";
      const data = await apiGet(url);
      setItems(data);
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  useEffect(() => {
    let activo = true;
    const url = q ? `/api/procedimientos?q=${encodeURIComponent(q)}` : "/api/procedimientos";
    apiGet(url)
      .then((data) => { if (activo) setItems(data); })
      .catch((e) => { if (activo) toast.push("error", e.message); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function cambiarPrecio(e) {
    e.preventDefault();
    try {
      await apiPatch(`/api/procedimientos/${editPrecio.id}/precio`, { monto: Number(editPrecio.monto) });
      toast.push("success", "Precio actualizado");
      setEditPrecio(null);
      cargar();
    } catch (err) {
      toast.push("error", err.message);
    }
  }

  async function cambiarEstado(p) {
    setConfirm(null);
    try {
      await apiPatch(`/api/procedimientos/${p.id_procedimiento}/estado`, { activo: !p.activo });
      toast.push("success", p.activo ? "Tratamiento inactivado" : "Tratamiento activado");
      cargar();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  if (!items) return <LoadingSpinner />;

  const activos = items.filter((p) => p.activo).length;
  const precioPromedio = items.length > 0 ? items.reduce((a, p) => a + Number(p.precio_actual), 0) / items.length : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tratamientos</h1>
          <p>Catálogo de procedimientos odontológicos y su tarifa vigente.</p>
        </div>
        {esAdmin && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuevo tratamiento</button>
        )}
      </div>

      <div className="mini-stats">
        <StatCard icon="✥" label="Total en catálogo" value={items.length} accent="teal" />
        <StatCard icon="✓" label="Activos" value={activos} accent="green" />
        <StatCard icon="₿" label="Precio promedio" value={formatMoneda(precioPromedio)} accent="blue" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Buscar tratamiento..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {items.length === 0 ? (
        <div className="card"><EmptyState icon="✥" message="No se encontraron tratamientos" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tratamiento</th>
                <th>Descripción</th>
                <th>Precio actual</th>
                <th>Estado</th>
                {esAdmin && <th style={{ textAlign: "right" }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id_procedimiento}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)" }}>{p.descripcion || "—"}</td>
                  <td className="mono">{formatMoneda(p.precio_actual)}</td>
                  <td><Badge>{p.activo ? "activo" : "inactivo"}</Badge></td>
                  {esAdmin && (
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} onClick={() => setEditPrecio({ id: p.id_procedimiento, nombre: p.nombre, monto: p.precio_actual })}>
                        Precio
                      </button>
                      <button className="btn btn-outline-accent btn-sm" onClick={() => setConfirm(p)}>
                        {p.activo ? "Inactivar" : "Activar"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <NuevoProcedimiento onClose={() => setShowForm(false)} onSaved={() => { cargar(); toast.push("success", "Tratamiento creado"); }} />
      )}

      {editPrecio && (
        <Modal open={true} title={`Cambiar precio — ${editPrecio.nombre}`} onClose={() => setEditPrecio(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditPrecio(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={cambiarPrecio} disabled={editPrecio.monto === ""}>Guardar precio</button>
            </>
          }
        >
          <label className="label">Nuevo precio (Bs)</label>
          <input className="input" type="number" step="0.01" min="0" value={editPrecio.monto} onChange={(e) => setEditPrecio({ ...editPrecio, monto: e.target.value })} autoFocus />
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>El cambio queda registrado en el historial de precios.</p>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Cambiar estado"
        message={`¿Seguro que deseas ${confirm?.activo ? "inactivar" : "activar"} "${confirm?.nombre}"?`}
        confirmLabel={confirm?.activo ? "Inactivar" : "Activar"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => cambiarEstado(confirm)}
      />
    </div>
  );
}

function NuevoProcedimiento({ onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: "", descripcion: "", precio_actual: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/procedimientos", { nombre: form.nombre, descripcion: form.descripcion, precio_actual: Number(form.precio_actual) });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} title="Nuevo tratamiento" onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" form="proc-form" type="submit" disabled={loading}>{loading ? "Guardando..." : "Crear tratamiento"}</button>
        </>
      }
    >
      <form id="proc-form" onSubmit={submit}>
        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 14, background: "var(--danger-ghost)", border: "1px solid rgba(251,113,133,0.35)", color: "var(--danger)", borderRadius: 10, fontSize: 13 }}>{error}</div>
        )}
        <label className="label">Nombre *</label>
        <input className="input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required placeholder="Ej. Limpieza dental" />
        <label className="label" style={{ marginTop: 12 }}>Descripción</label>
        <textarea className="input" rows={2} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
        <label className="label" style={{ marginTop: 12 }}>Precio (Bs) *</label>
        <input className="input" type="number" step="0.01" min="0" value={form.precio_actual} onChange={(e) => setForm((f) => ({ ...f, precio_actual: e.target.value }))} required />
      </form>
    </Modal>
  );
}