"use client";

// Badge de estado con colores semánticos del sistema.
const MAPA = {
  agendada: "teal",
  programada: "teal",
  atendida: "slate",
  completada: "slate",
  cancelada: "rose",
  no_asistio: "amber",
  pendiente: "amber",
  pagado: "green",
  activo: "green",
  inactivo: "slate",
  abierta: "green",
  cerrada: "slate",
  admin: "violet",
  recepcionista: "blue",
  odontologo: "green",
  insert: "green",
  update: "blue",
  delete: "rose",
  cobro: "green",
  gasto: "amber",
};

export function clasificacionBadge(valor) {
  const v = String(valor || "").toLowerCase();
  return MAPA[v] || "white";
}

export default function Badge({ children, color, dot = false }) {
  const c = color || clasificacionBadge(children);
  return (
    <span className={`badge badge-${c}`}>
      {dot && <span className="status-dot" style={{ width: 6, height: 6 }} />}
      {children}
    </span>
  );
}