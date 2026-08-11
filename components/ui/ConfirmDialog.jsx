"use client";

import Modal from "./Modal";

export default function ConfirmDialog({ open, title = "¿Confirmar acción?", message, confirmLabel = "Confirmar", danger = false, onConfirm, onCancel, loading = false }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={loading}>
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--text-muted)" }}>{message}</p>
    </Modal>
  );
}