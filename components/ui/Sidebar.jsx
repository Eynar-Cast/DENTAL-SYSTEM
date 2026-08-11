"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./DashboardShell";

const ETIQUETA_ROL = {
  admin: "Administrador",
  recepcionista: "Recepción / Caja",
  odontologo: "Odontólogo",
};

export default function Sidebar({ user, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }) {
  const pathname = usePathname();
  const roles = user?.roles || [];

  const items = NAV_ITEMS.filter((item) => item.roles.some((r) => roles.includes(r)));

  function esActivo(href) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
        />
      )}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div
            style={{
              fontSize: 24,
              color: "var(--accent-soft)",
              background: "linear-gradient(135deg, var(--accent-strong), var(--accent-deep))",
              borderRadius: 10,
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            🦷
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}>Smilesoft</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                Consultorio dental
              </div>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${esActivo(item.href) ? "active" : ""}`}
              onClick={onCloseMobile}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10 }}>
            <span className="status-dot" />
            {!collapsed && (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                Sistema en línea · v1.0
              </span>
            )}
          </div>
        </div>

        <button
          className="icon-btn sidebar-collapse-btn"
          style={{ position: "absolute", top: 18, right: 12, width: 30, height: 30 }}
          onClick={onToggleCollapsed}
          aria-label="Colapsar menú"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? "→" : "←"}
        </button>

        <button
          className="icon-btn sidebar-close-mobile"
          style={{ position: "absolute", top: 18, right: 12, width: 30, height: 30 }}
          onClick={onCloseMobile}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </aside>
    </>
  );
}

export { ETIQUETA_ROL };