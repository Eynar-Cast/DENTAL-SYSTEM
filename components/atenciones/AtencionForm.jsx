"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import Modal from "@/components/ui/Modal";
import { formatFechaHora } from "@/lib/utils";

export default function AtencionForm({ open, onClose, onSaved }) {
  const [citasAtendidas, setCitasAtendidas] = useState([]);
  const [tiposSigno, setTiposSigno] = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [procedimientos, setProcedimientos] = useState([]);

  const [form, setForm] = useState({
    id_cita: "",
    motivo_consulta: "",
    sintomas_referidos: "",
    notas_odontologo: "",
  });
  const [signos, setSignos] = useState([{ id_tipo: "", valor: "" }]);
  const [dxs, setDxs] = useState([{ codigo_diagnostico: "", observaciones: "" }]);
  const [procs, setProcs] = useState([{ id_procedimiento: "", cantidad: 1 }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    apiGet("/api/citas?estado=atendida").then(setCitasAtendidas).catch(() => setCitasAtendidas([]));
    apiGet("/api/atenciones/tipos-signos").then(setTiposSigno).catch(() => setTiposSigno([]));
    apiGet("/api/atenciones/catalogos-diagnostico").then(setDiagnosticos).catch(() => setDiagnosticos([]));
    apiGet("/api/atenciones/procedimientos").then(setProcedimientos).catch(() => setProcedimientos([]));
  }, [open]);

  const setArray = (setter, idx, campo, valor) =>
    setter((prev) => prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        atencion: {
          id_cita: Number(form.id_cita),
          motivo_consulta: form.motivo_consulta,
          sintomas_referidos: form.sintomas_referidos,
          notas_odontologo: form.notas_odontologo,
        },
        signos_vitales: signos.filter((s) => s.id_tipo && s.valor !== "").map((s) => ({ id_tipo: Number(s.id_tipo), valor: Number(s.valor) })),
        diagnosticos: dxs.filter((d) => d.codigo_diagnostico).map((d) => ({ codigo_diagnostico: d.codigo_diagnostico, observaciones: d.observaciones || null })),
        procedimientos: procs.filter((p) => p.id_procedimiento).map((p) => ({ id_procedimiento: Number(p.id_procedimiento), cantidad: Number(p.cantidad) })),
      };
      await apiPost("/api/atenciones", body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Registrar atención"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" form="atencion-form" type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Registrar atención"}
          </button>
        </>
      }
    >
      <form id="atencion-form" onSubmit={submit}>
        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 14, background: "var(--danger-ghost)", border: "1px solid rgba(251,113,133,0.35)", color: "var(--danger)", borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Cita atendida *</label>
            {citasAtendidas.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No hay citas en estado “atendida”. Marca la cita como atendida desde la agenda primero.</p>
            ) : (
              <select className="select" value={form.id_cita} onChange={(e) => setForm((f) => ({ ...f, id_cita: e.target.value }))} required>
                <option value="">Selecciona la cita...</option>
                {citasAtendidas.map((c) => (
                  <option key={c.id_cita} value={c.id_cita}>
                    {formatFechaHora(c.fecha_hora)} · {c.paciente_nombres} {c.paciente_apellidos} · {c.odontologo_nombres} {c.odontologo_apellidos}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Motivo de consulta *</label>
            <input className="input" value={form.motivo_consulta} onChange={(e) => setForm((f) => ({ ...f, motivo_consulta: e.target.value }))} required placeholder="Ej. Dolor en pieza 36" />
          </div>
          <div>
            <label className="label">Síntomas referidos</label>
            <textarea className="input" rows={2} value={form.sintomas_referidos} onChange={(e) => setForm((f) => ({ ...f, sintomas_referidos: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notas del odontólogo</label>
            <textarea className="input" rows={2} value={form.notas_odontologo} onChange={(e) => setForm((f) => ({ ...f, notas_odontologo: e.target.value }))} />
          </div>
        </div>

        <h4 style={{ margin: "18px 0 10px", fontSize: 14 }}>Signos vitales</h4>
        {signos.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
            <select className="select" value={s.id_tipo} onChange={(e) => setArray(setSignos, i, "id_tipo", e.target.value)} style={{ flex: 1 }}>
              <option value="">Tipo de signo...</option>
              {tiposSigno.map((t) => (
                <option key={t.id_tipo} value={t.id_tipo}>{t.nombre} ({t.unidad})</option>
              ))}
            </select>
            <input className="input" type="number" step="0.01" placeholder="Valor" value={s.valor} onChange={(e) => setArray(setSignos, i, "valor", e.target.value)} style={{ width: 130 }} />
            <button type="button" className="icon-btn" onClick={() => setSignos(signos.filter((_, x) => x !== i))} aria-label="Quitar">✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSignos([...signos, { id_tipo: "", valor: "" }])}>+ Agregar signo vital</button>

        <h4 style={{ margin: "18px 0 10px", fontSize: 14 }}>Diagnósticos</h4>
        {dxs.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
            <select className="select" value={d.codigo_diagnostico} onChange={(e) => setArray(setDxs, i, "codigo_diagnostico", e.target.value)} style={{ flex: 1 }}>
              <option value="">Código de diagnóstico...</option>
              {diagnosticos.map((dx) => (
                <option key={dx.codigo_diagnostico} value={dx.codigo_diagnostico}>{dx.codigo_diagnostico} · {dx.descripcion}</option>
              ))}
            </select>
            <button type="button" className="icon-btn" onClick={() => setDxs(dxs.filter((_, x) => x !== i))} aria-label="Quitar">✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDxs([...dxs, { codigo_diagnostico: "", observaciones: "" }])}>+ Agregar diagnóstico</button>

        <h4 style={{ margin: "18px 0 10px", fontSize: 14 }}>Procedimientos realizados</h4>
        {procs.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
            <select className="select" value={p.id_procedimiento} onChange={(e) => setArray(setProcs, i, "id_procedimiento", e.target.value)} style={{ flex: 1 }}>
              <option value="">Procedimiento...</option>
              {procedimientos.map((pr) => (
                <option key={pr.id_procedimiento} value={pr.id_procedimiento}>{pr.nombre} — Bs {pr.precio_actual}</option>
              ))}
            </select>
            <input className="input" type="number" min="1" value={p.cantidad} onChange={(e) => setArray(setProcs, i, "cantidad", e.target.value)} style={{ width: 90 }} />
            <button type="button" className="icon-btn" onClick={() => setProcs(procs.filter((_, x) => x !== i))} aria-label="Quitar">✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setProcs([...procs, { id_procedimiento: "", cantidad: 1 }])}>+ Agregar procedimiento</button>
      </form>
    </Modal>
  );
}