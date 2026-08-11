"use client";

export default function LoadingSpinner({ label = "Cargando..." }) {
  return (
    <div className="empty-state">
      <div className="spinner" />
      <p style={{ marginTop: 12 }}>{label}</p>
    </div>
  );
}