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
import PersonalForm from "@/components/personal/PersonalForm";
import { formatFecha } from "@/lib/utils";

export default function PersonalPage({ user }) {
  const { esAdmin } = usePermisos(user);
  const [personal, setPersonal] = useState(null);
  const [especialidades, setEspecialidades] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showEspForm, setShowEspForm] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  async function cargarEspecialidades() {
    try { setEspecialidades(await apiGet("/api/especialidades")); } catch {}
  }

  async function cargar() {
    try {
      const url = q ? `/api/personal?q=${encodeURIComponent(q)}` : "/api/personal";
      const data = await apiGet(url);
      setPersonal(data);
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  useEffect(() => {
    let activo = true;
    const url = q ? `/api/personal?q=${encodeURIComponent(q)}` : "/api/personal";
    apiGet(url)
      .then((data) => { if (activo) setPersonal(data); })
      .catch((e) => { if (activo) toast.push("error", e.message); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    cargarEspecialidades();
  }, []);

  async function cambiarEstado(p) {
    setConfirm(null);
    try {
      await apiPatch(`/api/personal/${p.id_personal}/estado`, { activo: !p.activo });
      toast.push("success", p.activo ? "Personal inactivado" : "Personal activado");
      cargar();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  if (!personal) return <LoadingSpinner />;

  const conColegiatura = personal.filter((p) => p.numero_colegiatura).length;
  const especialidadesConteo = {};
  personal.forEach((p) => {
    especialidadesConteo[p.nombre_especialidad] = (especialidadesConteo[p.nombre_especialidad] || 0) + 1;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Consultorio</h1>
          <p>Personal odontológico del consultorio.</p>
        </div>
        {esAdmin && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={() => setShowEspForm(true)}>＋ Nueva especialidad</button>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Registrar personal</button>
          </div>
        )}
      </div>

      <div className="mini-stats">
        <StatCard icon="▲" label="Total de personal" value={personal.length} accent="teal" />
        <StatCard icon="✥" label="Especialidades activas" value={Object.keys(especialidadesConteo).length} accent="blue" />
        <StatCard icon="∿" label="Con colegiatura" value={conColegiatura} accent="green" />
      </div>

      {especialidades.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {especialidades.map((e) => (
            <span key={e.id_especialidad} className="badge badge-teal" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {e.nombre_especialidad}
              <span style={{ opacity: 0.7 }}>· {especialidadesConteo[e.nombre_especialidad] || 0}</span>
            </span>
          ))}
        </div>
      )}
      {esAdmin && especialidades.length === 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 16, background: "var(--surface-2)", fontSize: 13, color: "var(--text-muted)" }}>
          No hay especialidades registradas. Crea una con <b>＋ Nueva especialidad</b> para poder asignar al personal.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Buscar por nombre, CI o especialidad..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {personal.length === 0 ? (
        <div className="card"><EmptyState icon="▲" message="No se encontró personal" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>CI</th>
                <th>Nombres</th>
                <th>Apellidos</th>
                <th>N° colegiatura</th>
                <th>Especialidad</th>
                <th>Contratación</th>
                <th>Estado</th>
                {esAdmin && <th style={{ textAlign: "right" }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {personal.map((p) => (
                <tr key={p.id_personal}>
                  <td className="mono">{p.documento_identidad}</td>
                  <td>{p.nombres}</td>
                  <td>{p.apellidos}</td>
                  <td className="mono">{p.numero_colegiatura || "—"}</td>
                  <td><Badge color="teal">{p.nombre_especialidad}</Badge></td>
                  <td>{formatFecha(p.fecha_contratacion)}</td>
                  <td><Badge>{p.activo ? "activo" : "inactivo"}</Badge></td>
                  {esAdmin && (
                    <td style={{ textAlign: "right" }}>
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

      {showForm && <PersonalForm open onClose={() => setShowForm(false)} onSaved={() => { toast.push("success", "Personal registrado"); cargar(); cargarEspecialidades(); }} />}

      {showEspForm && (
        <NuevaEspecialidadModal
          onClose={() => setShowEspForm(false)}
          onSaved={() => { toast.push("success", "Especialidad creada"); cargarEspecialidades(); setShowEspForm(false); }}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Cambiar estado"
        message={`¿Seguro que deseas ${confirm?.activo ? "inactivar" : "activar"} a ${confirm?.nombres} ${confirm?.apellidos}?`}
        confirmLabel={confirm?.activo ? "Inactivar" : "Activar"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => cambiarEstado(confirm)}
      />
    </div>
  );
}

function NuevaEspecialidadModal({ onClose, onSaved }) {
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (nombre.trim().length < 3) { setError("Mínimo 3 caracteres"); return; }
    setLoading(true);
    try {
      await apiPost("/api/especialidades", { nombre_especialidad: nombre.trim() });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal open={true} title="Nueva especialidad" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? "Guardando..." : "Crear especialidad"}</button></>}>
      <form onSubmit={submit}>
        {error && <div style={{ padding: "10px 12px", marginBottom: 12, background: "var(--danger-ghost)", border: "1px solid rgba(251,113,133,0.35)", color: "var(--danger)", borderRadius: 10, fontSize: 13 }}>{error}</div>}
        <label className="label">Nombre de la especialidad *</label>
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Implantología" autoFocus required maxLength={100} />
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Quedará disponible en el formulario de registro de personal.</p>
      </form>
    </Modal>
  );
}