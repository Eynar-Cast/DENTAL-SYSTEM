"use client";

export default function EmptyState({ icon = "◌", message = "No hay registros para mostrar" }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <p>{message}</p>
    </div>
  );
}