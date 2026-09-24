"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { usePermisos } from "@/components/ui/DashboardShell";
import { formatMoneda, formatFechaHora, saludoSegunHora, formatFecha } from "@/lib/utils";

export default function DashboardPage({ user }) {
  const { esOdontologo, esRecepcion, esAdmin } = usePermisos(user);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ahora, setAhora] = useState(null);
  const [historialPaciente, setHistorialPaciente] = useState(null);
  const [historialLoading, setHistorialLoading] = useState(false);

  useEffect(() => {
    setAhora(new Date());
    apiGet("/api/dashboard/resumen")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  async function cargarHistorial(pacienteId) {
    setHistorialLoading(true);
    try {
      const result = await apiGet(`/api/pacientes/${pacienteId}`);
      setHistorialPaciente(result);
    } catch (e) {
      console.error(e);
    } finally {
      setHistorialLoading(false);
    }
  }

  if (error) return <div style={{ color: "var(--danger)" }}>{error}</div>;
  if (!data) return <LoadingSpinner />;

  // Vista específica para Odontólogo
  if (esOdontologo && !esAdmin) {
    const citasHoy = data.citas_hoy || [];
    const citasOrdenadas = [...citasHoy].sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    const porEstado = ["agendada", "atendida", "cancelada", "no_asistio"].map((est) => ({
      estado: est,
      count: citasHoy.filter((c) => c.estado === est).length,
    }));
    const maxEstado = Math.max(...porEstado.map((p) => p.count), 1);

    return (
      <div style={{ minWidth: 0 }}>
        <div className="welcome-banner" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: "1 1 200px" }}>
            <h2 style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>{ahora ? saludoSegunHora(ahora) : "Bienvenido"}, Dr. {user?.nombres?.split(" ")[0] || ""}</h2>
            <p style={{ wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "normal" }}>Su agenda de hoy, {ahora ? formatFechaHora(ahora.toISOString()) : ""}.</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Citas programadas</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "var(--accent-soft)" }}>
              {citasHoy.length}
            </div>
          </div>
        </div>

        <div className="mini-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <StatCard icon="✓" label="Atendidas" value={porEstado.find(p => p.estado === "atendida")?.count || 0} accent="green" />
          <StatCard icon="◍" label="Agendadas" value={porEstado.find(p => p.estado === "agendada")?.count || 0} accent="blue" />
          <StatCard icon="✕" label="Canceladas" value={porEstado.find(p => p.estado === "cancelada")?.count || 0} accent="rose" />
          <StatCard icon="◷" label="No asistieron" value={porEstado.find(p => p.estado === "no_asistio")?.count || 0} accent="amber" />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🦷</span>
            Citas de hoy
          </h3>

          {citasOrdenadas.length === 0 ? (
            <EmptyState icon="📅" message="No tiene citas programadas para hoy" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Hora</th>
                    <th>Paciente</th>
                    <th style={{ width: 180 }}>Estado</th>
                    <th>Motivo / Servicio</th>
                    <th style={{ width: 140 }}>Historial</th>
                  </tr>
                </thead>
                <tbody>
                  {citasOrdenadas.map((c) => (
                    <tr key={c.id_cita} style={{ cursor: "pointer" }}>
                      <td style={{ fontWeight: 600, fontSize: 14 }}>
                        {formatFechaHora(c.fecha_hora).split(" ")[1] || formatFechaHora(c.fecha_hora)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.paciente_nombres} {c.paciente_apellidos}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>CI: {c.paciente_ci || "—"}</div>
                      </td>
                      <td>
                        <Badge color={
                          c.estado === "atendida" ? "green" :
                          c.estado === "agendada" ? "blue" :
                          c.estado === "cancelada" ? "rose" : "amber"
                        }>
                          {c.estado.charAt(0).toUpperCase() + c.estado.slice(1).replace("_", " ")}
                        </Badge>
                      </td>
                      <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.motivo}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => cargarHistorial(c.id_paciente)}
                          style={{ padding: "6px 12px", fontSize: 12 }}
                        >
                          📋 Ver historial
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Resumen por estado</h3>
          <div className="chart-bar">
            {porEstado.map((p) => (
              <div key={p.estado} className="chart-col">
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.count}</div>
                <div className="bar" style={{ height: `${(p.count / maxEstado) * 150}px` }} />
                <div className="bar-label">
                  <Badge color={
                    p.estado === "atendida" ? "green" :
                    p.estado === "agendada" ? "blue" :
                    p.estado === "cancelada" ? "rose" : "amber"
                  }>
                    {p.estado.charAt(0).toUpperCase() + p.estado.slice(1).replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Historial Paciente */}
        {historialPaciente && (
          <Modal
            open={true}
            title={`Historial de ${historialPaciente.paciente.nombres} ${historialPaciente.paciente.apellidos}`}
            onClose={() => setHistorialPaciente(null)}
            wide
            maxWidth="900px"
          >
            {historialLoading ? (
              <LoadingSpinner />
            ) : (
              <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
                <div className="card" style={{ padding: 16, marginBottom: 16, background: "var(--bg-800)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: 13 }}>
                    <div><strong>CI:</strong> {historialPaciente.paciente.documento_identidad}</div>
                    <div><strong>Fecha nac.:</strong> {formatFecha(historialPaciente.paciente.fecha_nacimiento)}</div>
                    <div><strong>Grupo sanguíneo:</strong> {historialPaciente.paciente.grupo_sanguineo || "—"}</div>
                    <div><strong>Teléfonos:</strong> {historialPaciente.paciente.telefonos?.join(", ") || "—"}</div>
                    <div style={{ gridColumn: "1 / -1" }}><strong>Dirección:</strong> {historialPaciente.paciente.direccion_calle || "—"}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    📅 Citas ({historialPaciente.citas?.length || 0})
                  </h4>
                  {historialPaciente.citas?.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin citas registradas</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Motivo</th>
                            <th>Odontólogo</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historialPaciente.citas.map((c) => (
                            <tr key={c.id_cita}>
                              <td>{formatFechaHora(c.fecha_hora)}</td>
                              <td>{c.motivo}</td>
                              <td>{c.odontologo_nombres} {c.odontologo_apellidos}</td>
                              <td><Badge color={
                                c.estado === "atendida" ? "green" :
                                c.estado === "agendada" ? "blue" :
                                c.estado === "cancelada" ? "rose" : "amber"
                              }>{c.estado}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    🦷 Atenciones ({historialPaciente.atenciones?.length || 0})
                  </h4>
                  {historialPaciente.atenciones?.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin atenciones registradas</p>
                  ) : (
                    historialPaciente.atenciones.map((a) => (
                      <div key={a.id_atencion} className="card" style={{ padding: 16, marginBottom: 12, background: "var(--bg-800)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                          <div style={{ fontWeight: 600 }}>{formatFechaHora(a.fecha_hora)}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            Dr. {a.odontologo_nombres} {a.odontologo_apellidos}
                          </div>
                        </div>
                        <p style={{ margin: "0 0 6px" }}><strong>Motivo:</strong> {a.motivo_consulta}</p>
                        {a.sintomas_referidos && <p style={{ margin: "0 0 6px", color: "var(--text-muted)", fontSize: 13 }}><strong>Síntomas:</strong> {a.sintomas_referidos}</p>}
                        {a.notas_odontologo && <p style={{ margin: "0 0 10px", color: "var(--text-muted)", fontSize: 13 }}><strong>Notas:</strong> {a.notas_odontologo}</p>}

                        {a.signos_vitales?.length > 0 && (
                          <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {a.signos_vitales.map((s, i) => (
                              <Badge key={i} color="blue">{s.tipo}: {s.valor} {s.unidad}</Badge>
                            ))}
                          </div>
                        )}
                        {a.diagnosticos?.length > 0 && (
                          <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {a.diagnosticos.map((d, i) => (
                              <Badge key={i} color="violet">{d.codigo_diagnostico} — {d.descripcion}</Badge>
                            ))}
                          </div>
                        )}
                        {a.procedimientos?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {a.procedimientos.map((p, i) => (
                              <Badge key={i} color="teal">{p.procedimiento} × {p.cantidad}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    💰 Presupuestos ({historialPaciente.presupuestos?.length || 0})
                  </h4>
                  {historialPaciente.presupuestos?.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin presupuestos generados</p>
                  ) : (
                    historialPaciente.presupuestos.map((p) => (
                      <div key={p.id_presupuesto} className="card" style={{ padding: 14, marginBottom: 10, background: "var(--bg-800)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          <span style={{ fontWeight: 600 }}>Presupuesto #{p.id_presupuesto}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{formatFechaHora(p.fecha_emision)}</span>
                          <Badge>{p.estado}</Badge>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {p.detalle?.map((d, i) => (
                            <Badge key={i} color="white">{d.procedimiento} × {d.cantidad} ({formatMoneda(d.precio_unitario)})</Badge>
                          ))}
                        </div>
                        <div style={{ marginTop: 8, fontWeight: 700, color: "var(--accent-soft)" }}>Total: {formatMoneda(p.total)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </Modal>
        )}
      </div>
    );
  }

  // Vista para Admin y Recepcionista (dashboard original mejorado)
  const porEstado = ["agendada", "atendida", "cancelada", "no_asistio"].map((est) => ({
    estado: est,
    count: data.citas_hoy.filter((c) => c.estado === est).length,
  }));
  const maxEstado = Math.max(...porEstado.map((p) => p.count), 1);

  return (
    <div style={{ minWidth: 0 }}>
      <div className="welcome-banner" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, minWidth: 0 }}>
        <div style={{ minWidth: 0, flex: "1 1 200px" }}>
          <h2 style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>{ahora ? saludoSegunHora(ahora) : "Bienvenido"}, al panel</h2>
          <p style={{ wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "normal" }}>
            Resumen de operaciones del consultorio para hoy, {ahora ? formatFechaHora(ahora.toISOString()) : ""}.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Citas del día</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "var(--accent-soft)" }}>
              {data.total_citas_hoy}
            </div>
          </div>
          {(esRecepcion || esAdmin) && (
            <a href="/dashboard/citas" style={{ textDecoration: "none" }}>
              <button className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, padding: "12px 24px", fontWeight: 600, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>➕</span>
                <span>Registrar nueva cita</span>
              </button>
            </a>
          )}
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