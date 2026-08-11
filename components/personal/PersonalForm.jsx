"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import Modal from "@/components/ui/Modal";

const VACIO = {
  persona: {
    documento_identidad: "",
    nombres: "",
    apellidos: "",
    fecha_nacimiento: "",
    id_ciudad: "",
    direccion_calle: "",
  },
  id_especialidad: "",
  numero_colegiatura: "",
  es_odontologo: true,
  fecha_contratacion: "",
};

export default function PersonalForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState(() => JSON.parse(JSON.stringify(VACIO)));
  const [ciudades, setCiudades] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    apiGet("/api/ciudades").then(setCiudades).catch(() => {});
    apiGet("/api/especialidades").then(setEspecialidades).catch(() => {});
  }, [open]);

  function setPersona(campo, valor) {
    setForm((f) => ({ ...f, persona: { ...f.persona, [campo]: valor } }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        persona: { ...form.persona, id_ciudad: Number(form.persona.id_ciudad) },
        id_especialidad: Number(form.id_especialidad),
        numero_colegiatura: form.numero_colegiatura,
        es_odontologo: form.es_odontologo,
        fecha_contratacion: form.fecha_contratacion || null,
      };
      await apiPost("/api/personal/completo", body);
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
      title="Registrar personal"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" form="personal-form" type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Registrar"}
          </button>
        </>
      }
    >
      <form id="personal-form" onSubmit={submit}>
        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 14, background: "var(--danger-ghost)", border: "1px solid rgba(251,113,133,0.35)", color: "var(--danger)", borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label className="label">Documento de identidad *</label>
            <input className="input" value={form.persona.documento_identidad} onChange={(e) => setPersona("documento_identidad", e.target.value)} required />
          </div>
          <div>
            <label className="label">Fecha de nacimiento *</label>
            <input className="input" type="date" value={form.persona.fecha_nacimiento} onChange={(e) => setPersona("fecha_nacimiento", e.target.value)} required />
          </div>
          <div>
            <label className="label">Nombres *</label>
            <input className="input" value={form.persona.nombres} onChange={(e) => setPersona("nombres", e.target.value)} required />
          </div>
          <div>
            <label className="label">Apellidos *</label>
            <input className="input" value={form.persona.apellidos} onChange={(e) => setPersona("apellidos", e.target.value)} required />
          </div>
          <div>
            <label className="label">Ciudad *</label>
            <select className="select" value={form.persona.id_ciudad} onChange={(e) => setPersona("id_ciudad", e.target.value)} required>
              <option value="">Selecciona...</option>
              {ciudades.map((c) => (
                <option key={c.id_ciudad} value={c.id_ciudad}>{c.nombre_ciudad}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Especialidad *</label>
            <select className="select" value={form.id_especialidad} onChange={(e) => setForm((f) => ({ ...f, id_especialidad: e.target.value }))} required>
              <option value="">Selecciona...</option>
              {especialidades.map((e) => (
                <option key={e.id_especialidad} value={e.id_especialidad}>{e.nombre_especialidad}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">¿Es odontólogo?</label>
            <select
              className="select"
              value={form.es_odontologo ? "si" : "no"}
              onChange={(e) => setForm((f) => ({ ...f, es_odontologo: e.target.value === "si" }))}
            >
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          {form.es_odontologo && (
            <div>
              <label className="label">Número de colegiatura *</label>
              <input className="input" value={form.numero_colegiatura} onChange={(e) => setForm((f) => ({ ...f, numero_colegiatura: e.target.value }))} required />
            </div>
          )}
          <div>
            <label className="label">Fecha de contratación</label>
            <input className="input" type="date" value={form.fecha_contratacion} onChange={(e) => setForm((f) => ({ ...f, fecha_contratacion: e.target.value }))} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Dirección (opcional)</label>
            <input className="input" value={form.persona.direccion_calle} onChange={(e) => setPersona("direccion_calle", e.target.value)} />
          </div>
        </div>
      </form>
    </Modal>
  );
}