"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePermisos } from "./DashboardShell";
import ThemeToggle from "./ThemeToggle";
import { ETIQUETA_ROL } from "./Sidebar";
import { saludoSegunHora, formatFecha } from "@/lib/utils";

export default function Navbar({ user, onOpenMenu }) {
  const router = useRouter();
  const { roles } = usePermisos(user);
  const rolPrincipal = roles[0] || "usuario";
  const nombre = user?.nombres || user?.email || "Usuario";

  // Fecha/saludo calculados tras el montaje para evitar mismatches de
  // hidratación (el servidor y el cliente pueden correr en zonas horarias
  // u horas distintas).
  const [ahora, setAhora] = useState(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAhora(new Date());
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      // incluso si falla, redirigimos
    }
    router.replace("/login");
  }

  return (
    <header className="topbar">
      <button className="btn-menu" onClick={onOpenMenu} aria-label="Abrir menú" title="Abrir menú">
        ☰
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {ahora ? `${saludoSegunHora(ahora)}, ${nombre.split(" ")[0]}` : nombre.split(" ")[0]}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ahora ? formatFecha(ahora.toISOString()) : ""}</div>
      </div>

      <span className="badge badge-white">{ETIQUETA_ROL[rolPrincipal] || rolPrincipal}</span>

      <ThemeToggle />

      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent-strong), var(--accent-deep))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 14,
          color: "#052b28",
          flexShrink: 0,
        }}
      >
        {nombre.charAt(0).toUpperCase()}
      </div>

      <button className="icon-btn" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
        ⏻
      </button>
    </header>
  );
}