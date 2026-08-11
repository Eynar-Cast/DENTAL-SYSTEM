"use client";

import { createContext, useContext, useState } from "react";
import { ToastProvider } from "./Toast";

// Contexto de sesión para páginas client-side. En Next.js App Router las
// páginas no reciben props del layout, por lo que exponemos el usuario aquí.
const UserContext = createContext(null);

export function useSessionUser() {
  return useContext(UserContext);
}

// Helpers de permisos por rol. Acepta el usuario de forma opcional y
// lo resuelve desde el contexto cuando las páginas no lo reciben como prop.
export function usePermisos(user) {
  const ctxUser = useContext(UserContext);
  const u = user || ctxUser || {};
  const roles = u.roles || [];
  return {
    user: u,
    esAdmin: roles.includes("admin"),
    esRecepcion: roles.includes("recepcionista"),
    esOdontologo: roles.includes("odontologo"),
    roles,
  };
}

// Menú de navegación con los permisos por rol.
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Panel principal", icon: "◆", roles: ["admin", "recepcionista", "odontologo"] },
  { href: "/dashboard/pacientes", label: "Pacientes", icon: "▣", roles: ["admin", "recepcionista", "odontologo"] },
  { href: "/dashboard/personal", label: "Consultorio", icon: "▲", roles: ["admin", "recepcionista", "odontologo"] },
  { href: "/dashboard/citas", label: "Agenda y citas", icon: "◷", roles: ["admin", "recepcionista", "odontologo"] },
  { href: "/dashboard/atenciones", label: "Atenciones", icon: "◆", roles: ["admin", "odontologo"] },
  { href: "/dashboard/procedimientos", label: "Tratamientos", icon: "✥", roles: ["admin", "recepcionista", "odontologo"] },
  { href: "/dashboard/caja", label: "Caja y cobros", icon: "₿", roles: ["admin", "recepcionista"] },
  { href: "/dashboard/gastos", label: "Gastos", icon: "◎", roles: ["admin", "recepcionista"] },
  { href: "/dashboard/reportes", label: "Reportes", icon: "◉", roles: ["admin"] },
  { href: "/dashboard/auditoria", label: "Auditoría", icon: "⚿", roles: ["admin"] },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: "◙", roles: ["admin"] },
];

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function DashboardShell({ user, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <UserContext.Provider value={user}>
        <Sidebar
          user={user}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className={`main-area ${collapsed ? "collapsed" : ""}`}>
          <Navbar user={user} onOpenMenu={() => setMobileOpen(true)} />
          <main className="content-area">{children}</main>
        </div>
      </UserContext.Provider>
    </ToastProvider>
  );
}