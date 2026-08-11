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
import { formatFecha } from "@/lib/utils";

const ROLES_DISPONIBLES = ["admin", "recepcionista", "odontologo"];

export default function UsuariosPage({ user }) {
  const { esAdmin } = usePermisos(user);

  const [usuarios, setUsuarios] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editar, setEditar] = useState(null);
  const [confirmEstado, setConfirmEstado] = useState(null);
  const toast = useToast();

  async function cargar() {
    try {
      setUsuarios(await apiGet("/api/usuarios"));
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  useEffect(() => {
    let activo = true;
    apiGet("/api/usuarios")
      .then((data) => { if (activo) setUsuarios(data); })
      .catch((e) => { if (activo) toast.push("error", e.message); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cambiarEstado(u) {
    setConfirmEstado(null);
    try {
      await apiPatch(`/api/usuarios/${u.id_usuario}`, { activo: !u.activo });
      toast.push("success", u.activo ? "Usuario desactivado" : "Usuario activado");
      cargar();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  async function guardarRoles(u, roles) {
    try {
      await apiPatch(`/api/usuarios/${u.id_usuario}`, { roles });
      toast.push("success", "Roles actualizados");
      setEditar(null);
      cargar();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  if (!esAdmin) {
    return <div className="card"><EmptyState icon="◙" message="Solo el administrador puede gestionar usuarios" /></div>;
  }
  if (!usuarios) return <LoadingSpinner />;

  const activos = usuarios.filter((u) => u.activo).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Cuentas de acceso al sistema y sus roles.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuevo usuario</button>
      </div>

      <div className="mini-stats">
        <StatCard icon="◙" label="Usuarios" value={usuarios.length} accent="teal" />
        <StatCard icon="✓" label="Activos" value={activos} accent="green" />
        <StatCard icon="†" label="Desactivados" value={usuarios.length - activos} accent="rose" />
      </div>

      {usuarios.length === 0 ? (
        <div className="card"><EmptyState icon="◙" message="No hay usuarios registrados" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>CI</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Creado</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id_usuario}>
                  <td style={{ fontWeight: 600 }}>{u.nombres} {u.apellidos}</td>
                  <td className="mono">{u.documento_identidad}</td>
                  <td>{u.email}</td>
                  <td>{u.roles.length === 0 ? "—" : u.roles.map((r) => <Badge key={r}>{r}</Badge>)}</td>
                  <td>{formatFecha(u.fecha_creacion)}</td>
                  <td><Badge>{u.activo ? "activo" : "inactivo"}</Badge></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} onClick={() => setEditar(u)}>Roles</button>
                    <button className="btn btn-outline-accent btn-sm" onClick={() => setConfirmEstado(u)}>
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <UsuarioForm onClose={() => setShowForm(false)} onSaved={() => { cargar(); toast.push("success", "Usuario creado"); }} />}

      {editar && (
        <EditarRoles usuario={editar} onClose={() => setEditar(null)} onSave={(roles) => guardarRoles(editar, roles)} />
      )}

      <ConfirmDialog
        open={!!confirmEstado}
        title="Cambiar estado de usuario"
        message={`¿Seguro que deseas ${confirmEstado?.activo ? "desactivar" : "activar"} a ${confirmEstado?.nombres} ${confirmEstado?.apellidos}?`}
        confirmLabel={confirmEstado?.activo ? "Desactivar" : "Activar"}
        onCancel={() => setConfirmEstado(null)}
        onConfirm={() => cambiarEstado(confirmEstado)}
      />
    </div>
  );
}

function UsuarioForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    documento_identidad: "",
    nombres: "",
    apellidos: "",
    email: "",
    password: "",
    roles: ["recepcionista"],
    es_personal: false,
    id_especialidad: "",
  });
  const [especialidades, setEspecialidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet("/api/especialidades").then(setEspecialidades).catch(() => {});
  }, []);

  function toggleRol(rol) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(rol) ? f.roles.filter((r) => r !== rol) : [...f.roles, rol],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/usuarios", {
        ...form,
        roles: form.roles,
        id_especialidad: form.id_especialidad ? Number(form.id_especialidad) : null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} title="Nuevo usuario" onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" form="usuario-form" type="submit" disabled={loading}>{loading ? "Creando..." : "Crear usuario"}</button>
        </>
      }>
      <form id="usuario-form" onSubmit={submit}>
        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 14, background: "var(--danger-ghost)", border: "1px solid rgba(251,113,133,0.35)", color: "var(--danger)", borderRadius: 10, fontSize: 13 }}>{error}</div>
        )}

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label className="label">Documento de identidad *</label>
            <input className="input" value={form.documento_identidad} onChange={(e) => setForm((f) => ({ ...f, documento_identidad: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Nombres *</label>
            <input className="input" value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Apellidos *</label>
            <input className="input" value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Contraseña *</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={6} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="label">Roles *</label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {ROLES_DISPONIBLES.map((r) => (
                <label key={r} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRol(r)} />
                  {r}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={form.es_personal} onChange={(e) => setForm((f) => ({ ...f, es_personal: e.target.checked }))} />
            Usuario también es personal del consultorio (odontólogo)
          </label>
          {form.es_personal && (
            <select className="select" style={{ marginTop: 10 }} value={form.id_especialidad} onChange={(e) => setForm((f) => ({ ...f, id_especialidad: e.target.value }))}>
              <option value="">Especialidad (opcional)...</option>
              {especialidades.map((e) => (
                <option key={e.id_especialidad} value={e.id_especialidad}>{e.nombre_especialidad}</option>
              ))}
            </select>
          )}
        </div>
      </form>
    </Modal>
  );
}

function EditarRoles({ usuario, onClose, onSave }) {
  const [seleccion, setSeleccion] = useState([...(usuario.roles || [])]);

  function toggle(rol) {
    setSeleccion((prev) => (prev.includes(rol) ? prev.filter((r) => r !== rol) : [...prev, rol]));
  }

  return (
    <Modal open={true} title={`Roles de ${usuario.nombres} ${usuario.apellidos}`} onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(seleccion)}>Guardar roles</button>
        </>
      }>
      <div style={{ display: "flex", gap: 14, flexDirection: "column" }}>
        {ROLES_DISPONIBLES.map((r) => (
          <label key={r} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={seleccion.includes(r)} onChange={() => toggle(r)} />
            {r}
          </label>
        ))}
      </div>
    </Modal>
  );
}