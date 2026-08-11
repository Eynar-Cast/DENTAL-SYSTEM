"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import { formatFechaHora, formatMoneda, formatFecha } from "@/lib/utils";

export default function PacienteDetallePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet(`/api/pacientes/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div style={{ color: "var(--danger)" }}>{error}</div>;
  if (!data) return <LoadingSpinner />;

  const { paciente, citas, atenciones, presupuestos } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/dashboard/pacientes" style={{ color: "var(--accent-soft)", fontSize: 14, textDecoration: "none" }}>
            ← Pacientes
          </Link>
          <h1 style={{ marginTop: 6 }}>
            {paciente.nombres} {paciente.apellidos}
          </h1>
          <p>
            CI {paciente.documento_identidad} · {paciente.nombre_ciudad || "—"}, {paciente.nombre_pais || ""}
          </p>
        </div>
        <Badge>{paciente.activo ? "activo" : "inactivo"}</Badge>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Datos generales</h3>
        <div className="detail-grid">
          <div className="detail-item"><div className="k">Grupo sanguíneo</div><div className="v">{paciente.grupo_sanguineo || "—"}</div></div>
          <div className="detail-item"><div className="k">Fecha de nacimiento</div><div className="v">{formatFecha(paciente.fecha_nacimiento)}</div></div>
          <div className="detail-item"><div className="k">Dirección</div><div className="v">{paciente.direccion_calle || "—"}</div></div>
          <div className="detail-item"><div className="k">Teléfonos</div><div className="v">{paciente.telefonos?.join(", ") || "—"}</div></div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Historial de citas ({citas.length})</h3>
          {citas.length === 0 ? (
            <EmptyState icon="◷" message="Sin citas registradas" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Motivo</th>
                    <th>Odontólogo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {citas.map((c) => (
                    <tr key={c.id_cita}>
                      <td>{formatFechaHora(c.fecha_hora)}</td>
                      <td>{c.motivo}</td>
                      <td>{c.odontologo_nombres} {c.odontologo_apellidos}</td>
                      <td><Badge>{c.estado}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Atenciones odontológicas ({atenciones.length})</h3>
          {atenciones.length === 0 ? (
            <EmptyState icon="◆" message="Sin atenciones registradas" />
          ) : (
            atenciones.map((a) => (
              <div key={a.id_atencion} className="card" style={{ padding: 16, marginBottom: 12, background: "var(--bg-800)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{formatFechaHora(a.fecha_hora)}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {a.odontologo_nombres} {a.odontologo_apellidos}
                  </div>
                </div>
                <p style={{ margin: "0 0 6px" }}><strong>Motivo:</strong> {a.motivo_consulta}</p>
                {a.sintomas_referidos && <p style={{ margin: "0 0 6px", color: "var(--text-muted)" }}><strong>Síntomas:</strong> {a.sintomas_referidos}</p>}
                {a.notas_odontologo && <p style={{ margin: "0 0 10px", color: "var(--text-muted)" }}><strong>Notas:</strong> {a.notas_odontologo}</p>}

                {a.signos_vitales?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {a.signos_vitales.map((s, i) => (
                      <Badge key={i} color="blue">{s.tipo}: {s.valor} {s.unidad}</Badge>
                    ))}
                  </div>
                )}
                {a.diagnosticos?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {a.diagnosticos.map((d, i) => (
                      <Badge key={i} color="violet">{d.codigo_diagnostico} — {d.descripcion}</Badge>
                    ))}
                  </div>
                )}
                {a.procedimientos?.length > 0 && (
                  <div>
                    {a.procedimientos.map((p, i) => (
                      <Badge key={i} color="teal">{p.procedimiento} × {p.cantidad}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Presupuestos ({presupuestos.length})</h3>
          {presupuestos.length === 0 ? (
            <EmptyState icon="₿" message="Sin presupuestos generados" />
          ) : (
            presupuestos.map((p) => (
              <div key={p.id_presupuesto} className="card" style={{ padding: 14, marginBottom: 10, background: "var(--bg-800)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>Presupuesto #{p.id_presupuesto}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{formatFechaHora(p.fecha_emision)}</span>
                  <Badge>{p.estado}</Badge>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
    </div>
  );
}
