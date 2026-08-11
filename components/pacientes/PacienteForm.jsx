"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client";
import Modal from "@/components/ui/Modal";

const ESTADO_INICIAL = {
  persona: {
    documento_identidad: "",
    nombres: "",
    apellidos: "",
    fecha_nacimiento: "",
    id_ciudad: "",
    direccion_calle: "",
  },
  id_grupo_sanguineo: "",
  telefonos: [""],
};

export default function PacienteForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState(() => JSON.parse(JSON.stringify(ESTADO_INICIAL)));
  const [ciudades, setCiudades] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    apiGet("/api/ciudades").then(setCiudades).catch(() => {});
    apiGet("/api/grupos-sanguineos").then(setGrupos).catch(() => {});
  }, [open]);

  function setPersona(campo, valor) {
    setForm((f) => ({ ...f, persona: { ...f.persona, [campo]: valor } }));
  }

  function setTelefono(idx, valor) {
    const telefonos = [...form.telefonos];
    telefonos[idx] = valor;
    setForm((f) => ({ ...f, telefonos }));
  }

  function addTelefono() {
    setForm((f) => ({ ...f, telefonos: [...f.telefonos, ""] }));
  }

  function removeTelefono(idx) {
    setForm((f) => ({ ...f, telefonos: f.telefonos.filter((_, i) => i !== idx) }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        persona: {
          ...form.persona,
          id_ciudad: Number(form.persona.id_ciudad),
        },
        id_grupo_sanguineo: form.id_grupo_sanguineo ? Number(form.id_grupo_sanguineo) : null,
        telefonos: form.telefonos.filter((t) => t.trim()),
      };
      await apiPost("/api/pacientes", body);
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
      title="Nuevo paciente"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" form="paciente-form" type="submit" disabled={loading}>
            {loading ? "Guardando..." : "Guardar paciente"}
          </button>
        </>
      }
    >
      <form id="paciente-form" onSubmit={submit}>
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
            <label className="label">Grupo sanguíneo</label>
            <select className="select" value={form.id_grupo_sanguineo} onChange={(e) => setForm((f) => ({ ...f, id_grupo_sanguineo: e.target.value }))}>
              <option value="">—</option>
              {grupos.map((g) => (
                <option key={g.id_grupo_sanguineo} value={g.id_grupo_sanguineo}>{g.descripcion}</option>
              ))}
            </select>
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
            <label className="label">Fecha de nacimiento *</label>
            <input className="input" type="date" value={form.persona.fecha_nacimiento} onChange={(e) => setPersona("fecha_nacimiento", e.target.value)} required />
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
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Dirección (opcional)</label>
            <input className="input" value={form.persona.direccion_calle} onChange={(e) => setPersona("direccion_calle", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="label">Teléfonos</label>
            {form.telefonos.map((tel, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input className="input" value={tel} onChange={(e) => setTelefono(idx, e.target.value)} placeholder={`Teléfono ${idx + 1}`} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeTelefono(idx)} disabled={form.telefonos.length <= 1}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addTelefono}>+ Agregar teléfono</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}