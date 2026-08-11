"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import Modal from "@/components/ui/Modal";
import { fechaHoyISO } from "@/lib/utils";

export default function CitaForm({ open, onClose, onSaved }) {
  const [pacientes, setPacientes] = useState([]);
  const [odontologos, setOdontologos] = useState([]);
  const [qPaciente, setQPaciente] = useState("");
  const [form, setForm] = useState({ id_paciente: "", id_personal: "", motivo: "", fecha_hora: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    apiGet("/api/personal?odontologos=true").then(setOdontologos).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    apiGet(`/api/pacientes?q=${encodeURIComponent(qPaciente)}`)
      .then(setPacientes)
      .catch(() => setPacientes([]));
  }, [qPaciente, open]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        id_paciente: Number(form.id_paciente),
        id_personal: Number(form.id_personal),
        motivo: form.motivo,
        fecha_hora: form.fecha_hora,
      };
      await apiPost("/api/citas", body);
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
      title="Nueva cita"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" form="cita-form" type="submit" disabled={loading}>
            {loading ? "Agendando..." : "Agendar cita"}
          </button>
        </>
      }
    >
      <form id="cita-form" onSubmit={submit}>
        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 14, background: "var(--danger-ghost)", border: "1px solid rgba(251,113,133,0.35)", color: "var(--danger)", borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="form-grid">
          <div>
            <label className="label">Paciente *</label>
            <input
              className="input"
              placeholder="Buscar por nombre o CI..."
              value={qPaciente}
              onChange={(e) => setQPaciente(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <select className="select" value={form.id_paciente} onChange={(e) => setForm((f) => ({ ...f, id_paciente: e.target.value }))} required>
              <option value="">Selecciona un paciente...</option>
              {pacientes.map((p) => (
                <option key={p.id_paciente} value={p.id_paciente}>
                  {p.nombres} {p.apellidos} ({p.documento_identidad})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Odontólogo *</label>
            <select className="select" value={form.id_personal} onChange={(e) => setForm((f) => ({ ...f, id_personal: e.target.value }))} required>
              <option value="">Selecciona...</option>
              {odontologos.map((o) => (
                <option key={o.id_personal} value={o.id_personal}>
                  {o.nombres} {o.apellidos} — {o.nombre_especialidad}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Motivo *</label>
            <textarea className="input" rows={2} value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} required placeholder="Ej. Consulta, limpieza, dolor en pieza 36..." />
          </div>
          <div>
            <label className="label">Fecha y hora *</label>
            <input
              className="input"
              type="datetime-local"
              min={`${fechaHoyISO()}T08:00`}
              value={form.fecha_hora}
              onChange={(e) => setForm((f) => ({ ...f, fecha_hora: e.target.value }))}
              required
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}