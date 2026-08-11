"use client";

import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONOS = { success: "✓", error: "✕", info: "ℹ" };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((tipo, mensaje) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tipo, mensaje }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" style={{ position: "fixed", top: 16, right: 16, zIndex: 200 }}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <span style={{ color: t.tipo === "error" ? "var(--danger)" : t.tipo === "success" ? "var(--success)" : "var(--accent)" }}>
              {ICONOS[t.tipo] || "ℹ"}
            </span>
            <span>{t.mensaje}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}