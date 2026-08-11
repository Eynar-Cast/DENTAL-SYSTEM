"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
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
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

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

  useEffect(() => {
    apiGet("/api/especialidades").then(setEspecialidades).catch(() => {});
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
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Registrar personal</button>
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
            <span key={e.id_especialidad} className="badge badge-teal">
              {e.nombre_especialidad}
              <span style={{ opacity: 0.7 }}>· {especialidadesConteo[e.nombre_especialidad] || 0}</span>
            </span>
          ))}
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

      {showForm && <PersonalForm open onClose={() => setShowForm(false)} onSaved={() => toast.push("success", "Personal registrado")} />}

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