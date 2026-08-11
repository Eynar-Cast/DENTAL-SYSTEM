# Sistema de Gestión para Consultorio Dental — Estado del Proyecto

> Documento de handoff. Última actualización: 11 de agosto de 2026.
> Objetivo: que cualquier IA o desarrollador pueda continuar el trabajo sin perder contexto.

## 1. Resumen del proyecto

Sistema web de gestión para un consultorio dental en Bolivia: pacientes, personal odontológico (especialidades y colegiatura), agenda de citas, atenciones clínicas con signos y diagnósticos, tratamientos/procedimientos con historial de precios, caja (apertura/cierre, presupuestos, cobros), gastos, reportes y auditoría. **Sin módulo de farmacia/inventario** (descartado a propósito en el requerimiento).

Mismo enfoque técnico que los proyectos hermanos del autor (GestorCompras): Next.js + `pg` con SQL crudo, **sin ORM (cero Prisma)**, Neon Postgres, deploy en Vercel.

## 2. Stack técnico

- **Framework**: Next.js 16 (App Router), JavaScript (no TypeScript)
- **Estilos**: Tailwind CSS 4 + tema "Aqua Deep" en `app/globals.css`
- **Base de datos**: PostgreSQL en Neon (serverless), acceso vía paquete `pg` con SQL crudo
- **Autenticación**: `bcryptjs` (hash) + `jose` (JWT en cookie httpOnly, 8 h, sameSite lax)
- **Export de reportes**: `xlsx` (implementado en `/api/reportes/excel`)
- **Hosting**: Vercel, repo en GitHub (`Eynar-Cast/DENTAL-SYSTEM`)

## 3. Variables de entorno requeridas

Deben existir tanto en `.env.local` (desarrollo) como en Vercel → Settings → Environments:

```
DATABASE_URL=postgresql://usuario:password@host/neondb?sslmode=require
JWT_SECRET=<string aleatorio, generado con crypto.randomBytes(32).toString('base64')>
```

- `DATABASE_URL` fue provisionado por la integración Vercel↔Neon con prefijo `DATABASE` (no el default `STORAGE`).
- `JWT_SECRET` está generado en `.env.local` y agregado en Vercel (Sensitive, en los 3 entornos).
- `.env.local` está ignorado por git (`.env*` en `.gitignore`).

## 4. Estado de la base de datos

✅ Completo. El schema completo está migrado a Neon. El archivo fuente es `scripts/schema.sql` (32 tablas + seed + admin).

**Migración**: `node scripts/migrate.js` (ejecuta `schema.sql`). El flag `--reset` borra TODO el esquema y re-crea desde cero. **No existen scripts npm `migrate`; se corren con node directo.**

**Verificación**: `node scripts/verify-db.js` (32 tablas + seed).

### 4.1 Tablas (32)

Geográficos: `pais`, `ciudad` · Institucionales: `grupo_sanguineo`, `especialidad`, `rol`, `permiso`, `rol_permiso` · Identidad: `persona`, `telefono_persona`, `paciente`, `personal` · Seguridad: `usuario`, `usuario_rol`, `sesion_usuario` · Auditoría: `auditoria` · Agenda: `estado_cita`, `cita` · Clínica: `atencion`, `tipo_signo_vital`, `signo_vital`, `catalogo_diagnostico`, `diagnostico_atencion`, `atencion_procedimiento` · Servicios: `procedimiento`, `precio_historial` · Caja: `metodo_pago`, `caja`, `presupuesto`, `detalle_presupuesto`, `cobro` · Gastos: `categoria_gasto`, `gasto`.

Índices añadidos: `idx_cobro_presupuesto` (cobro.id_presupuesto) y `idx_telefono_persona` (telefono_persona.id_persona).

### 4.2 Seed (ya insertado, idempotente)

- Estados cita: agendada, atendida, cancelada, no_asistio
- Grupos sanguíneos A+ a O-
- Roles: **admin, recepcionista, odontologo**
- Tipos de signo vital (7), especialidades (9), métodos de pago (4), categorías de gasto (6), procedimientos (9), diagnóstico odontológico (10), permisos (24) con `rol_permiso` completo para admin
- Países/ciudades: Bolivia + ciudades (La Paz, El Alto, Cochabamba, Santa Cruz, Oruro, Potosí)

### 4.3 Usuario administrador inicial

**El admin está incluido en el seed** (persona `ADMIN-0001` + usuario `admin@consultorio.bo` + rol admin), con hash bcrypt determinista y `ON CONFLICT DO NOTHING`. Sobrevive a `--reset`.

> ⚠️ Causa raíz histórica de "Credenciales inválidas" (resuelta): antes el admin se creaba solo con `scripts/create-admin.js`, y un `--reset` lo borraba. Desde el fix, el seed lo crea siempre.

`scripts/create-admin.js` sigue disponible para crear usuarios admin adicionales con datos custom: `node scripts/create-admin.js "Nombre" "Apellido" email@ejemplo.com password123`.

## 5. Estado de la aplicación (código)

### 5.1 Completado ✅ (los 11 módulos del CONTEXTO)

**Backend — ~60 rutas API** (`app/api/*`, SQL crudo + RBAC en servidor + auditoría):
- Auth: login (con **rate-limiting**: 5 intentos fallidos / 15 min por IP+email), logout, session, health
- Pacientes (CRUD + estado + historial), personal (completo, estado), especialidades
- Citas (CRUD + estado), atenciones (tipos-signos, catalogos-diagnostico, procedimientos, POST transaccional)
- Procedimientos (CRUD, precio→historial, estado)
- Caja: apertura, cierre (cálculo ingresos/egresos/saldo/diferencia), actual, movimientos-dia, historial-cierres
- Presupuestos (crear, detalle, listado), cobros (crear, anular con motivo)
- Gastos (listar, crear, anular)
- Reportes (9 endpoints + export Excel): pacientes-atendidos, tratamientos-realizados, ingresos, egresos, utilidad, comparacion-ingresos, ranking-tratamientos, metodos-pago, cierres-caja
- Dashboard: resumen
- Auditoría (filtros + paginación) y sesiones
- Catálogos: paises, ciudades, estados-cita, grupos-sanguineos, metodos-pago, categorias-gasto, tipos-signo-vital, catalogos-diagnostico

**UI — módulos completos** (`app/dashboard/*`):
- layout con DashboardShell (UserContext + permisos), sidebar con permisos por rol, navbar con saludo por hora y logout
- dashboard (KPIs del día), pacientes (+detalle/historial), personal, citas, atenciones, procedimientos (con historial de precios), caja (apertura/presupuestos/cobros/movimientos/cierre), gastos, reportes (9 tabs + botón Excel), **auditoría con tabs Bitácora/Sesiones**, usuarios
- login con partículas + tarjetas de error

**Documentación API**: página pública `/docs` con todos los endpoints, ejemplos y reglas de negocio (enlazada desde el login y el sidebar).

### 5.2 Legado vs. CONTEXTO (diferencias intencionales)

- `progreso.md` anterior mencionaba tablas/consultas del hospitalario (`consulta`, `departamento`, `catalogo_cie10`, `receta`, etc.): **NO existen** en este proyecto; el dental usa `atencion`, `especialidad`, `catalogo_diagnostico`, y la farmacia está descartada.
- El login valida roles desde la BD por petición (`obtenerRolesUsuario`); el middleware/proxy solo valida firma del JWT (Edge, no toca Postgres).
- React 19 + React Compiler: los `useEffect` usan patrón inline con flag de cancelación (no dependencia de arreglo).

## 6. Decisiones de diseño a respetar

- Nada de Prisma/ORM: SQL crudo vía `lib/db.js` (`query`, `withTransaction`)
- JavaScript, no TypeScript
- Identificadores snake_case en minúsculas en queries (Postgres pliega a minúsculas)
- Cookies httpOnly, sameSite lax, 8 h, nombre `session`
- No eliminación física: pacientes/personal se inactivan; citas/cobros/gastos se anulan/cancelan con motivo; solo admin anula
- Solo se cobra/registra gasto con caja abierta; una caja abierta por jornada
- Precio de caja = precio vigente del catálogo; solo admin cambia precios (queda en `precio_historial`)
- Auditoría manual desde las API routes (no triggers), con valor anterior/nuevo JSON
- Rate-limiting de login en memoria (`lib/rate-limit.js`) — best-effort en serverless (por instancia)

## 7. Cómo correr el proyecto localmente

```powershell
npm install
node scripts/verify-db.js                          # confirmar conexión a Neon
node scripts/migrate.js --reset                    # (solo si se necesita re-crear la BD; recrea el admin)
npm run dev
```

Login: `admin@consultorio.bo` / `Admin@1234`

## 8. QA y verificación (último estado)

- `npm run lint` → limpio
- `npm run build` → OK (60 rutas; `/docs` y `/login` estáticos)
- `node scripts/verify-db.js` → 32 tablas + seed correcto
- Login real probado vía `POST /api/auth/login` → 200, JWT + cookie emitidos, rol admin

## 9. Próximos pasos sugeridos

1. **QA funcional integral** del flujo operativo end-to-end en el desplegado: apertura caja → crear paciente → cita → atención → presupuesto → cobro → gasto → cierre de caja; corregir bugs detectados.
2. Confirmar env vars en Vercel (DATABASE_URL misma Neon + JWT_SECRET) si el desplegado fallara.
3. Opcional: mover el rate-limiting a la BD (compartido entre instancias), refreshing del token, notificaciones con campana, gráficas de reportes en el cliente.