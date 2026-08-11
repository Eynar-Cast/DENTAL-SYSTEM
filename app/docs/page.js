import Link from "next/link";

// Documentación API de Smilesoft — página estática (pública).

const METODO_COLOR = {
  GET: { c: "#34d399", bg: "rgba(52,211,153,0.14)" },
  POST: { c: "#60a5fa", bg: "rgba(96,165,250,0.14)" },
  PATCH: { c: "#fbbf24", bg: "rgba(251,191,36,0.14)" },
  DELETE: { c: "#fb7185", bg: "rgba(251,113,133,0.14)" },
};

const MODULOS = [
  {
    nombre: "Autenticación",
    resumen: "Inicio y cierre de sesión, estado de la sesión actual y salud del servicio.",
    endpoints: [
      {
        metodo: "POST",
        ruta: "/api/auth/login",
        rol: "Público",
        desc: "Inicia sesión con email y contraseña. Registra la sesión (IP, navegador), limpia sesiones expiradas y fija la cookie httpOnly. Limita a 5 intentos fallidos por IP+email cada 15 minutos.",
        body: { email: "admin@consultorio.bo", password: "Admin@1234" },
        resp: { ok: true, user: { idUsuario: 1, email: "admin@consultorio.bo", nombres: "Administrador del Sistema", roles: ["admin"] } },
      },
      {
        metodo: "POST",
        ruta: "/api/auth/logout",
        rol: "Autenticado",
        desc: "Cierra la sesión activa en el servidor (estado cerrada) y elimina la cookie.",
      },
      {
        metodo: "GET",
        ruta: "/api/auth/session",
        rol: "Autenticado",
        desc: "Devuelve el usuario y roles de la sesión actual, o null si no hay sesión.",
        resp: { user: { idUsuario: 1, email: "admin@consultorio.bo", nombres: "Administrador del Sistema", roles: ["admin"] } },
      },
      {
        metodo: "GET",
        ruta: "/api/health",
        rol: "Público",
        desc: "Estado del servicio.",
      },
    ],
  },
  {
    nombre: "Pacientes",
    resumen: "Registro y consulta de pacientes (persona + teléfonos en una sola transacción).",
    endpoints: [
      {
        metodo: "GET",
        ruta: "/api/pacientes?q=",
        rol: "admin, recepcionista, odontologo",
        desc: "Lista de pacientes (CI, nombres, apellidos, grupo sanguíneo, estado). Búsqueda en vivo por CI, nombre o apellido vía ?q=.",
      },
      {
        metodo: "GET",
        ruta: "/api/pacientes/{id}",
        rol: "admin, recepcionista, odontologo",
        desc: "Detalle del paciente con su historial: citas, atenciones, diagnósticos y tratamientos.",
      },
      {
        metodo: "POST",
        ruta: "/api/pacientes",
        rol: "admin, recepcionista",
        desc: "Crea persona + teléfonos + paciente en una sola transacción. Documento duplicado → 409.",
        body: {
          persona: { documento_identidad: "12345678", nombres: "María", apellidos: "Pérez", fecha_nacimiento: "1990-05-15", id_ciudad: 1, direccion_calle: "Av. Principal #123" },
          id_grupo_sanguineo: 7,
          telefonos: ["76543210", "2112233"],
        },
        resp: { id_paciente: 12, mensaje: "Paciente creado exitosamente" },
      },
      {
        metodo: "PATCH",
        ruta: "/api/pacientes/{id}/estado",
        rol: "admin",
        desc: "Activa o inactiva la ficha del paciente. No se elimina físicamente.",
      },
    ],
  },
  {
    nombre: "Consultorio (Personal)",
    resumen: "Odontólogos y personal de apoyo, con especialidad y número de colegiatura.",
    endpoints: [
      {
        metodo: "GET",
        ruta: "/api/personal?q=",
        rol: "admin, recepcionista, odontologo",
        desc: "Lista del personal: nombres, CI, colegiatura, especialidad, fecha de contratación, activo.",
      },
      {
        metodo: "GET",
        ruta: "/api/especialidades",
        rol: "Autenticado",
        desc: "Catálogo de especialidades.",
      },
      {
        metodo: "POST",
        ruta: "/api/personal/completo",
        rol: "admin",
        desc: "Crea persona + personal en una sola transacción. CI o colegiatura duplicados → 409.",
        body: {
          persona: { documento_identidad: "9876543", nombres: "Juan", apellidos: "Mamani", fecha_nacimiento: "1985-03-10", id_ciudad: 1, direccion_calle: null },
          id_especialidad: 2,
          numero_colegiatura: "MP-45812",
          fecha_contratacion: "2025-01-10",
        },
        resp: { id_personal: 5, id_persona: 6, mensaje: "Personal registrado exitosamente" },
      },
      {
        metodo: "PATCH",
        ruta: "/api/personal/{id}/estado",
        rol: "admin",
        desc: "Activa o inactiva a un miembro del consultorio.",
      },
    ],
  },
  {
    nombre: "Agenda y Citas",
    resumen: "Programación de citas sin solapamiento por odontólogo (UNIQUE en BD).",
    endpoints: [
      {
        metodo: "GET",
        ruta: "/api/citas?estado=&fecha=&id_personal=&q=",
        rol: "admin, recepcionista, odontologo",
        desc: "Lista de citas (máx. 200 recientes). El odontólogo ve su agenda propia.",
      },
      {
        metodo: "POST",
        ruta: "/api/citas",
        rol: "admin, recepcionista",
        desc: "Agenda una cita. Horario ya ocupado por el odontólogo → 409 (mensaje de la BD).",
        body: { id_paciente: 12, id_personal: 5, motivo: "Dolor en pieza 36", fecha_hora: "2026-08-12T09:30:00", id_estado: 1 },
        resp: { id_cita: 88, mensaje: "Cita creada exitosamente" },
      },
      {
        metodo: "PATCH",
        ruta: "/api/citas/{id}/estado",
        rol: "admin, recepcionista, odontologo",
        desc: "Cambia el estado de la cita: agendada → atendida / cancelada / no_asistio.",
        body: { id_estado: 2 },
      },
    ],
  },
  {
    nombre: "Atención Odontológica",
    resumen: "Registro exclusivo del odontólogo. Atención + signos + diagnósticos + procedimientos en una sola transacción.",
    endpoints: [
      {
        metodo: "GET",
        ruta: "/api/atenciones/tipos-signos",
        rol: "odontologo, admin",
        desc: "Catálogo de tipos de signo vital.",
      },
      {
        metodo: "GET",
        ruta: "/api/atenciones/catalogos-diagnostico",
        rol: "odontologo, admin",
        desc: "Catálogo de diagnósticos odontológicos.",
      },
      {
        metodo: "GET",
        ruta: "/api/atenciones/procedimientos",
        rol: "odontologo, admin",
        desc: "Catálogo de procedimientos activos para marcar los realizados.",
      },
      {
        metodo: "POST",
        ruta: "/api/atenciones",
        rol: "odontologo",
        desc: "Registra la atención completa en una sola transacción. Solo sobre citas en estado atendida. Código de diagnóstico inexistente → 400.",
        body: {
          atencion: { id_cita: 88, motivo_consulta: "Dolor en molar inferior", sintomas_referidos: "Dolor punzante desde hace 3 días", notas_odontologo: "Caries profunda, recomendar endodoncia" },
          signos_vitales: [{ id_tipo: 4, valor: 36.5 }, { id_tipo: 5, valor: 97 }],
          diagnosticos: [{ codigo_diagnostico: "K02", observaciones: "Caries en pieza 36" }],
          procedimientos: [{ id_procedimiento: 3, cantidad: 1 }],
        },
        resp: { id_atencion: 15, mensaje: "Atención registrada" },
      },
    ],
  },
  {
    nombre: "Tratamientos y Procedimientos",
    resumen: "Catálogo de servicios con historial de precios (solo admin cambia precios).",
    endpoints: [
      {
        metodo: "GET",
        ruta: "/api/procedimientos?q=",
        rol: "admin, recepcionista, odontologo",
        desc: "Catálogo de procedimientos (nombre, descripción, precio actual, activo).",
      },
      {
        metodo: "POST",
        ruta: "/api/procedimientos",
        rol: "admin",
        desc: "Registra procedimiento con su precio.",
      },
      {
        metodo: "PATCH",
        ruta: "/api/procedimientos/{id}",
        rol: "admin",
        desc: "Edita nombre y descripción.",
      },
      {
        metodo: "PATCH",
        ruta: "/api/procedimientos/{id}/precio",
        rol: "admin",
        desc: "Cambia el precio: guarda el historial (precio_historial) y actualiza el actual.",
        body: { monto: 450.0 },
        resp: { mensaje: "Precio actualizado", precio_historial_id: 9 },
      },
      {
        metodo: "PATCH",
        ruta: "/api/procedimientos/{id}/estado",
        rol: "admin",
        desc: "Activa o inactiva el procedimiento (no se elimina).",
      },
    ],
  },
  {
    nombre: "Caja",
    resumen: "Apertura/cierre de caja. Solo se cobra con caja abierta.",
    endpoints: [
      {
        metodo: "POST",
        ruta: "/api/caja/apertura",
        rol: "admin, recepcionista",
        desc: "Abre la caja del día. Solo una caja abierta por jornada.",
        body: { monto_inicial: 500.0 },
        resp: { id_caja: 3, mensaje: "Caja abierta" },
      },
      {
        metodo: "POST",
        ruta: "/api/caja/cierre",
        rol: "admin, recepcionista",
        desc: "Cierra la caja: calcula ingresos, egresos, saldo esperado, monto declarado y diferencia.",
        body: { id_caja: 3, monto_declarado: 3250.5 },
        resp: { id_caja: 3, ingresos: 2900.0, egresos: 149.5, saldo_esperado: 3250.5, monto_declarado: 3250.5, diferencia: 0.0, mensaje: "Caja cerrada" },
      },
      {
        metodo: "GET",
        ruta: "/api/caja/actual",
        rol: "admin, recepcionista",
        desc: "Estado de la caja actual (abierta/cerrada, montos acumulados).",
      },
      {
        metodo: "GET",
        ruta: "/api/caja/movimientos-dia",
        rol: "admin, recepcionista",
        desc: "Cobros y gastos del día.",
      },
      {
        metodo: "GET",
        ruta: "/api/caja/historial-cierres",
        rol: "admin",
        desc: "Historial de cierres de caja.",
      },
    ],
  },
  {
    nombre: "Presupuestos y Cobros",
    resumen: "Presupuestos desde el catálogo (precio vigente) y cobros con método de pago.",
    endpoints: [
      {
        metodo: "POST",
        ruta: "/api/presupuestos",
        rol: "admin, recepcionista",
        desc: "Genera presupuesto con uno o varios procedimientos y calcula el total.",
        body: { id_paciente: 12, id_cita: 88, detalle: [{ id_procedimiento: 3, cantidad: 1 }, { id_procedimiento: 7, cantidad: 2 }] },
        resp: { id_presupuesto: 21, total: 1350.0, estado: "pendiente", mensaje: "Presupuesto generado" },
      },
      {
        metodo: "GET",
        ruta: "/api/presupuestos/{id}",
        rol: "admin, recepcionista",
        desc: "Detalle de un presupuesto.",
      },
      {
        metodo: "GET",
        ruta: "/api/presupuestos?estado=&paciente=",
        rol: "admin, recepcionista",
        desc: "Lista de presupuestos (pendientes/pagados).",
      },
      {
        metodo: "POST",
        ruta: "/api/cobros",
        rol: "admin, recepcionista",
        desc: "Registra el pago de un presupuesto. Requiere caja abierta.",
        body: { id_presupuesto: 21, id_metodo_pago: 1, monto: 1350.0 },
        resp: { id_cobro: 34, mensaje: "Pago registrado" },
      },
      {
        metodo: "PATCH",
        ruta: "/api/cobros/{id}/anular",
        rol: "admin",
        desc: "Anula un cobro con motivo obligatorio. Nunca se elimina.",
      },
    ],
  },
  {
    nombre: "Gastos",
    resumen: "Registro de egresos por categoría. Solo con caja abierta.",
    endpoints: [
      {
        metodo: "GET",
        ruta: "/api/gastos?fecha=&categoria=&mes=",
        rol: "admin, recepcionista",
        desc: "Consulta gastos diarios y mensuales, filtrables por categoría.",
      },
      {
        metodo: "POST",
        ruta: "/api/gastos",
        rol: "admin, recepcionista",
        desc: "Registra un gasto (categoría + motivo obligatorio). Requiere caja abierta.",
        body: { id_categoria: 1, motivo: "Compra de anestésicos y jeringas", monto: 220.0 },
        resp: { id_gasto: 5, mensaje: "Gasto registrado" },
      },
      {
        metodo: "PATCH",
        ruta: "/api/gastos/{id}/anular",
        rol: "admin",
        desc: "Anula un gasto con motivo obligatorio.",
      },
    ],
  },
  {
    nombre: "Reportes (solo admin)",
    resumen: "Indicadores financieros y de operación. Exportación a Excel incluida.",
    endpoints: [
      { metodo: "GET", ruta: "/api/reportes/pacientes-atendidos?desde=&hasta=", rol: "admin", desc: "Pacientes y citas atendidos por día." },
      { metodo: "GET", ruta: "/api/reportes/tratamientos-realizados?desde=&hasta=", rol: "admin", desc: "Tratamientos realizados por día y por odontólogo." },
      { metodo: "GET", ruta: "/api/reportes/ingresos?desde=&hasta=", rol: "admin", desc: "Ingresos diarios y mensuales." },
      { metodo: "GET", ruta: "/api/reportes/egresos?desde=&hasta=", rol: "admin", desc: "Egresos diarios y mensuales." },
      { metodo: "GET", ruta: "/api/reportes/utilidad?desde=&hasta=", rol: "admin", desc: "Utilidad diaria y mensual (ingresos − egresos)." },
      { metodo: "GET", ruta: "/api/reportes/comparacion-ingresos", rol: "admin", desc: "Comparación de ingresos entre meses." },
      { metodo: "GET", ruta: "/api/reportes/ranking-tratamientos", rol: "admin", desc: "Ranking de tratamientos más realizados." },
      { metodo: "GET", ruta: "/api/reportes/metodos-pago", rol: "admin", desc: "Distribución de métodos de pago." },
      { metodo: "GET", ruta: "/api/reportes/cierres-caja", rol: "admin", desc: "Historial de cierres de caja." },
      { metodo: "GET", ruta: "/api/reportes/excel?tipo=&desde=&hasta=", rol: "admin", desc: "Descarga el reporte en Excel (.xlsx). Tipos: resumen-dia, movimientos, pacientes-atendidos, tratamientos, ranking-tratamientos, metodos-pago, cierres-caja." },
    ],
  },
  {
    nombre: "Panel Principal",
    resumen: "Resumen del día para el dashboard.",
    endpoints: [
      {
        metodo: "GET",
        ruta: "/api/dashboard/resumen",
        rol: "Autenticado",
        desc: "Indicadores: pacientes atendidos hoy, citas del día, ingresos/gastos/utilidad del día, estado de la caja, próximas citas y tratamientos más realizados.",
      },
    ],
  },
  {
    nombre: "Auditoría y Sesiones",
    resumen: "Bitácora de operaciones sensibles y sesiones de usuarios.",
    endpoints: [
      {
        metodo: "GET",
        ruta: "/api/auditoria?tabla=&desde=&hasta=&usuario=&limit=",
        rol: "admin",
        desc: "Consulta la bitácora con filtros y paginación. Incluye antes/después en JSON.",
      },
      {
        metodo: "GET",
        ruta: "/api/sesiones?id_usuario=",
        rol: "admin",
        desc: "Sesiones de los usuarios: inicio, fin, IP, navegador, estado.",
      },
    ],
  },
  {
    nombre: "Catálogos",
    resumen: "Datos maestros para selectores y formularios.",
    endpoints: [
      { metodo: "GET", ruta: "/api/paises", rol: "Autenticado", desc: "Países." },
      { metodo: "GET", ruta: "/api/ciudades", rol: "Autenticado", desc: "Ciudades." },
      { metodo: "GET", ruta: "/api/grupos-sanguineos", rol: "Autenticado", desc: "Grupos sanguíneos." },
      { metodo: "GET", ruta: "/api/estados-cita", rol: "Autenticado", desc: "Estados de cita." },
      { metodo: "GET", ruta: "/api/metodos-pago", rol: "Autenticado", desc: "Métodos de pago." },
      { metodo: "GET", ruta: "/api/categorias-gasto", rol: "Autenticado", desc: "Categorías de gasto." },
      { metodo: "GET", ruta: "/api/tipos-signo-vital", rol: "Autenticado", desc: "Tipos de signo vital." },
      { metodo: "GET", ruta: "/api/catalogos-diagnostico", rol: "Autenticado", desc: "Catálogo de diagnósticos odontológicos." },
    ],
  },
];

function CodeBlock({ title, obj }) {
  return (
    <div style={{ marginTop: 10 }}>
      {title && (
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)", marginBottom: 6, letterSpacing: 0.4 }}>
          {title}
        </div>
      )}
      <pre className="json-block" style={{ margin: 0 }}>
        {JSON.stringify(obj, null, 2)}
      </pre>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-900)", color: "var(--text)" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="logo-circle" style={{ width: 40, height: 40, fontSize: 18 }}>🦷</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24 }}>Smilesoft API</h1>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Documentación de servicios REST del sistema de consultorio dental</div>
            </div>
          </div>
          <Link className="btn btn-ghost" href="/login">← Volver al login</Link>
        </div>

        <div className="card" style={{ marginTop: 16, padding: "16px 20px" }}>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-muted)" }}>
            Todas las rutas usan el prefijo <span className="mono">/api</span> y exigen la cookie de sesión
            <span className="mono"> session</span> (httpOnly, 8 h). La autorización por rol se valida <strong style={{ color: "var(--text)" }}>en el servidor</strong>.
            Respuestas de error: <span className="mono">{"{ \"detail\": \"mensaje\" }"}</span> con códigos 400, 401, 403, 404, 409, 429.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0" }}>
          {MODULOS.map((m) => (
            <a key={m.nombre} className="pill" href={`#${encodeURIComponent(m.nombre.replace(/\s+/g, "-"))}`} style={{ textDecoration: "none" }}>
              {m.nombre}
            </a>
          ))}
        </div>

        {MODULOS.map((m) => (
          <section key={m.nombre} id={m.nombre.replace(/\s+/g, "-")} style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 19, margin: "0 0 4px", color: "var(--accent-soft)" }}>{m.nombre}</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)" }}>{m.resumen}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {m.endpoints.map((e, i) => (
                <div key={i} className="card" style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        color: METODO_COLOR[e.metodo].c,
                        background: METODO_COLOR[e.metodo].bg,
                      }}
                    >
                      {e.metodo}
                    </span>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{e.ruta}</span>
                    <span className="badge badge-white" style={{ marginLeft: "auto" }}>{e.rol}</span>
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{e.desc}</p>
                  {e.body && <CodeBlock title="Request" obj={e.body} />}
                  {e.resp && <CodeBlock title="Response" obj={e.resp} />}
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="card" style={{ marginTop: 40, padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Reglas de negocio</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.8 }}>
            <li>Sin citas solapadas: un odontólogo no tiene dos citas a la misma fecha/hora (UNIQUE en BD).</li>
            <li>Auditoría automática de toda operación sensible (quién, cuándo, IP, antes/después).</li>
            <li>No hay eliminación física: pacientes y personal se inactivan; cobros y gastos se anulan con motivo.</li>
            <li>Solo se cobra o registra gasto con la caja abierta.</li>
            <li>El precio en caja siempre es el precio vigente del catálogo; solo el admin lo cambia (queda historial).</li>
            <li>Contraseñas con hash; nunca se devuelven en las respuestas.</li>
          </ul>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-faint)", marginTop: 40 }}>
          Smilesoft © {new Date().getFullYear()} — Documentación generada del backend real
        </p>
      </div>
    </div>
  );
}
