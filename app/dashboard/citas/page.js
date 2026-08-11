"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { usePermisos } from "@/components/ui/DashboardShell";
import CitaForm from "@/components/citas/CitaForm";
import { formatFechaHora } from "@/lib/utils";

const ESTADOS = [["Todos", ""], ["Agendada", "agendada"], ["Atendida", "atendida"], ["Cancelada", "cancelada"], ["No asistió", "no_asistio"]];

export default function CitasPage({ user }) {
  const { esAdmin, esRecepcion } = usePermisos(user);
  const puedeAgendar = esAdmin || esRecepcion;

  const [citas, setCitas] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [q, setQ] = useState("");
  const [estados, setEstados] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const toast = useToast();

  async function cargar() {
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.set("estado", filtroEstado);
      if (filtroFecha) params.set("fecha", filtroFecha);
      if (q) params.set("q", q);
      const data = await apiGet(`/api/citas?${params.toString()}`);
      setCitas(data);
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  useEffect(() => {
    let activo = true;
    const params = new URLSearchParams();
    if (filtroEstado) params.set("estado", filtroEstado);
    if (filtroFecha) params.set("fecha", filtroFecha);
    if (q) params.set("q", q);
    apiGet(`/api/citas?${params.toString()}`)
      .then((data) => { if (activo) setCitas(data); })
      .catch((e) => { if (activo) toast.push("error", e.message); });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, filtroFecha, q]);

  useEffect(() => {
    apiGet("/api/estados-cita").then((data) => {
      setEstados(data.filter((e) => ["agendada", "atendida", "cancelada", "no_asistio"].includes(e.descripcion)));
    }).catch(() => {});
  }, []);

  async function cambiarEstado(cita, idEstado) {
    try {
      await apiPatch(`/api/citas/${cita.id_cita}/estado`, { id_estado: Number(idEstado) });
      toast.push("success", "Estado de cita actualizado");
      cargar();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  async function reprogramar(cita, fechaHora) {
    if (!fechaHora) {
      toast.push("error", "Selecciona la nueva fecha y hora");
      return;
    }
    try {
      await apiPatch(`/api/citas/${cita.id_cita}/estado`, { fecha_hora: fechaHora });
      toast.push("success", "Cita reprogramada");
      cargar();
    } catch (e) {
      toast.push("error", e.message);
    }
  }

  if (!citas) return <LoadingSpinner />;

  const conteo = {
    total: citas.length,
    agendadas: citas.filter((c) => c.estado === "agendada").length,
    atendidas: citas.filter((c) => c.estado === "atendida").length,
    canceladas: citas.filter((c) => c.estado === "cancelada").length,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Agenda y citas</h1>
          <p>Administración de citas del consultorio.</p>
        </div>
        {puedeAgendar && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nueva cita</button>
        )}
      </div>

      <div className="mini-stats">
        <StatCard icon="◷" label="En vista" value={conteo.total} accent="teal" />
        <StatCard icon="◍" label="Agendadas" value={conteo.agendadas} accent="green" />
        <StatCard icon="✓" label="Atendidas" value={conteo.atendidas} accent="blue" />
        <StatCard icon="✕" label="Canceladas" value={conteo.canceladas} accent="rose" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {ESTADOS.map(([label, valor]) => (
          <button
            key={valor}
            className={`pill ${filtroEstado === valor ? "active" : ""}`}
            onClick={() => setFiltroEstado(valor)}
          >
            {label}
          </button>
        ))}
        <input
          className="input"
          type="date"
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value)}
          style={{ width: 160, marginLeft: "auto" }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Buscar por paciente u odontólogo..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {citas.length === 0 ? (
        <div className="card"><EmptyState icon="◷" message="No se encontraron citas" /></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Odontólogo</th>
                <th>Motivo</th>
                <th>Fecha y hora</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {citas.map((c) => (
                <tr key={c.id_cita}>
                  <td>{c.paciente_nombres} {c.paciente_apellidos}</td>
                  <td>{c.odontologo_nombres} {c.odontologo_apellidos}</td>
                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.motivo}</td>
                  <td>{formatFechaHora(c.fecha_hora)}</td>
                  <td><Badge>{c.estado}</Badge></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <select
                      className="select"
                      value={c.id_estado}
                      onChange={(e) => cambiarEstado(c, e.target.value)}
                      style={{ width: 130, marginRight: 8 }}
                    >
                      {estados.map((est) => (
                        <option key={est.id_estado} value={est.id_estado}>{est.descripcion}</option>
                      ))}
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditando({ cita: c, fecha: "" })}>
                      Reprogramar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <CitaForm open onClose={() => setShowForm(false)} onSaved={() => { toast.push("success", "Cita creada"); cargar(); }} />}

      {/* Reprogramación */}
      {editando && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setEditando(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>Reprogramar cita #{editando.cita.id_cita}</h3>
              <button className="icon-btn" onClick={() => setEditando(null)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="label">Nueva fecha y hora</label>
              <input
                className="input"
                type="datetime-local"
                value={editando.fecha}
                onChange={(e) => setEditando({ ...editando, fecha: e.target.value })}
              />
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
                Cita actual: {formatFechaHora(editando.cita.fecha_hora)}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  await reprogramar(editando.cita, editando.fecha);
                  setEditando(null);
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}