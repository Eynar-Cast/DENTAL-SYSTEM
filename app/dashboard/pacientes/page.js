"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPatch } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { usePermisos } from "@/components/ui/DashboardShell";
import PacienteForm from "@/components/pacientes/PacienteForm";
import { formatFecha } from "@/lib/utils";

export default function PacientesPage({ user }) {
  const { esAdmin, esRecepcion } = usePermisos(user);
  const puedeCrear = esAdmin || esRecepcion;

  const [pacientes, setPacientes] = useState(null);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  async function cargar() {
    try {
      const url = q ? `/api/pacientes?q=${encodeURIComponent(q)}` : "/api/pacientes";
      const data = await apiGet(url);
      setPacientes(data);
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  useEffect(() => {
    let activo = true;
    const url = q ? `/api/pacientes?q=${encodeURIComponent(q)}` : "/api/pacientes";
    apiGet(url)
      .then((data) => { if (activo) setPacientes(data); })
      .catch((e) => { if (activo) toast.push("error", e.message); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function cambiarEstado(pac) {
    setConfirm(null);
    try {
      await apiPatch(`/api/pacientes/${pac.id_paciente}/estado`, { activo: !pac.activo });
      toast.push("success", pac.activo ? "Paciente inactivado" : "Paciente activado");
      cargar();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  if (!pacientes) return <LoadingSpinner />;

  const tiposSangre = pacientes.filter((p) => p.grupo_sanguineo).length;
  const masComun = pacientes.reduce((acc, p) => {
    if (p.grupo_sanguineo) acc[p.grupo_sanguineo] = (acc[p.grupo_sanguineo] || 0) + 1;
    return acc;
  }, {});
  const grupoTop = Object.entries(masComun).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pacientes</h1>
          <p>Registro, búsqueda y ficha clínica de pacientes.</p>
        </div>
        {puedeCrear && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nuevo paciente</button>
        )}
      </div>

      <div className="mini-stats">
        <StatCard icon="▣" label="Total registrados" value={pacientes.length} accent="teal" />
        <StatCard icon="◈" label="Con grupo sanguíneo" value={tiposSangre} accent="blue" />
        <StatCard
          icon="◉"
          label="Grupo más común"
          value={grupoTop ? grupoTop[0] : "—"}
          accent="green"
          sub={grupoTop ? `${grupoTop[1]} paciente(s)` : "Sin datos"}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <input
            className="input"
            placeholder="Buscar por CI, nombre o apellido..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{pacientes.length} resultado(s)</span>
      </div>

      {pacientes.length === 0 ? (
        <div className="card"><EmptyState icon="▣" message="No se encontraron pacientes" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>CI</th>
                <th>Nombres</th>
                <th>Apellidos</th>
                <th>Grupo sanguíneo</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p) => (
                <tr key={p.id_paciente}>
                  <td className="mono">{p.documento_identidad}</td>
                  <td>{p.nombres}</td>
                  <td>{p.apellidos}</td>
                  <td>{p.grupo_sanguineo ? <Badge color="blue">{p.grupo_sanguineo}</Badge> : "—"}</td>
                  <td>
                    <Badge>{p.activo ? "activo" : "inactivo"}</Badge>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link href={`/dashboard/pacientes/${p.id_paciente}`} className="btn btn-ghost btn-sm" style={{ textDecoration: "none", marginRight: 6 }}>
                      Historial
                    </Link>
                    {esAdmin && (
                      <button className="btn btn-outline-accent btn-sm" onClick={() => setConfirm(p)}>
                        {p.activo ? "Inactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <PacienteForm open onClose={() => setShowForm(false)} onSaved={() => toast.push("success", "Paciente creado")} />}

      <ConfirmDialog
        open={!!confirm}
        title="Cambiar estado de la ficha"
        message={`¿Seguro que deseas ${confirm?.activo ? "inactivar" : "activar"} la ficha de ${confirm?.nombres} ${confirm?.apellidos}?`}
        confirmLabel={confirm?.activo ? "Inactivar" : "Activar"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => cambiarEstado(confirm)}
      />
    </div>
  );
}
