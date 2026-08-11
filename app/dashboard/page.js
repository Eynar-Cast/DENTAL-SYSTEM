"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import { formatMoneda, formatFechaHora, saludoSegunHora } from "@/lib/utils";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ahora, setAhora] = useState(null);

  useEffect(() => {
    // Se calcula en el cliente para evitar mismatches de hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAhora(new Date());
    apiGet("/api/dashboard/resumen")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ color: "var(--danger)" }}>{error}</div>;
  if (!data) return <LoadingSpinner />;

  const porEstado = ["agendada", "atendida", "cancelada", "no_asistio"].map((est) => ({
    estado: est,
    count: data.citas_hoy.filter((c) => c.estado === est).length,
  }));
  const maxEstado = Math.max(...porEstado.map((p) => p.count), 1);

  return (
    <div>
      <div className="welcome-banner">
        <div>
          <h2>{ahora ? saludoSegunHora(ahora) : "Bienvenido"}, al panel</h2>
          <p>
            Resumen de operaciones del consultorio para hoy, {ahora ? formatFechaHora(ahora.toISOString()) : ""}.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Citas del día</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "var(--accent-soft)" }}>
            {data.total_citas_hoy}
          </div>
        </div>
      </div>

      <div className="mini-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <StatCard icon="👤" label="Pacientes atendidos hoy" value={data.pacientes_atendidos_hoy} accent="teal" />
        <StatCard icon="📅" label="Citas agendadas hoy" value={data.citas_agendadas_hoy} accent="blue" />
        {data.finanzas && (
          <>
            <StatCard icon="₿" label="Ingresos del día" value={formatMoneda(data.ingresos_dia)} accent="green" />
            <StatCard icon="◎" label="Gastos del día" value={formatMoneda(data.egresos_dia)} accent="rose" />
            <StatCard icon="📈" label="Utilidad del día" value={formatMoneda(data.utilidad_dia)} accent="violet" />
          </>
        )}
      </div>

      <div className="mini-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {data.finanzas && (
          <StatCard
            icon="💵"
            label="Estado de caja"
            value={data.caja ? "Abierta" : "Cerrada"}
            accent={data.caja ? "green" : "amber"}
            sub={data.caja ? `Inicial ${formatMoneda(data.caja.monto_inicial)} · ${data.caja.usuario}` : "Abrir caja para operar"}
          />
        )}
        <StatCard icon="▣" label="Pacientes activos" value={data.pacientes_activos} accent="blue" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }} className="resp-grid">
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Citas de hoy por estado</h3>
          <div className="chart-bar">
            {porEstado.map((p) => (
              <div key={p.estado} className="chart-col">
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.count}</div>
                <div className="bar" style={{ height: `${(p.count / maxEstado) * 150}px` }} />
                <div className="bar-label">
                  <Badge>{p.estado}</Badge>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ margin: "26px 0 12px", fontSize: 16 }}>Próximas citas agendadas</h3>
          {data.proximas_citas.length === 0 ? (
            <EmptyState icon="◷" message="No hay próximas citas agendadas" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Paciente</th>
                    <th>Odontólogo</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.proximas_citas.map((c) => (
                    <tr key={c.id_cita}>
                      <td>{formatFechaHora(c.fecha_hora)}</td>
                      <td>{c.paciente_nombres} {c.paciente_apellidos}</td>
                      <td>{c.odontologo_nombres} {c.odontologo_apellidos}</td>
                      <td>{c.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Tratamientos más realizados</h3>
          {data.tratamientos_mas_realizados.length === 0 ? (
            <EmptyState icon="✥" message="Aún no hay tratamientos registrados" />
          ) : (
            data.tratamientos_mas_realizados.map((t, i) => {
              const max = data.tratamientos_mas_realizados[0].total || 1;
              return (
                <div key={i} className="chart-bar-row">
                  <div style={{ width: 150, fontSize: 13, color: "var(--text-muted)" }}>{t.tratamiento}</div>
                  <div className="track">
                    <div className="fill" style={{ width: `${(t.total / max) * 100}%` }} />
                  </div>
                  <div style={{ width: 34, textAlign: "right", fontWeight: 600 }}>{t.total}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
