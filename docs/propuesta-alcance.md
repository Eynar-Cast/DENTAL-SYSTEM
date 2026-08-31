# Propuesta de Alcance — Sistema de Gestión para Consultorio Dental

**Módulos incluidos:**
1.	Módulo de Autenticación y Control de Acceso: inicio y cierre de sesión con control de acceso por roles (Administrador, Recepción, Odontólogo).
2.	Módulo de Pacientes y Consultorio: registro de pacientes (identidad, fecha de nacimiento, teléfonos múltiples, dirección), historial completo y activación/inactivación de fichas; registro del personal odontológico con colegiatura y especialidad, y del personal de apoyo.
3.	Módulo de Agenda de Citas y Atención Odontológica: agendar, consultar, reprogramar y cambiar estado de citas (Agendada, Atendida, Cancelada, No asistió); y registro de consultas con motivo, síntomas, signos clínicos, procedimientos, diagnósticos y notas.
4.	Módulo de Tratamientos, Cobros y Gastos (Caja): catálogo de procedimientos con precios, presupuestos con total, cobros por método de pago (Pagado/Pendiente), apertura y cierre de caja con ingresos, egresos y diferencias, y gastos por categoría (diarios y mensuales).
5.	Módulo de Panel Principal, Reportes y Auditoría: dashboard con métricas del día (pacientes atendidos, citas, ingresos, gastos, utilidad, estado de caja, tratamientos más realizados, próximas citas); reportes por día y por odontólogo, comparativo mensual, ranking de tratamientos, métodos de pago e historial de cierres; y auditoría de las acciones críticas del sistema.

**Funcionalidades específicas:**
-	Registro de pacientes con buscador por CI, nombre o apellido y datos de contacto adicionales (varios teléfonos).
-	Consulta del historial completo del paciente: citas, atenciones, diagnósticos y tratamientos realizados.
-	Gestión del consultorio: odontólogos con colegiatura/especialidad, personal de apoyo, activación/desactivación y listados con buscador.
-	Agenda diaria por odontólogo, reprogramación de citas y filtros por estado, paciente u odontólogo.
-	Atención clínica por sesión: motivo de consulta, síntomas, signos clínicos (temperatura, presión, etc.), procedimientos, diagnósticos y notas del odontólogo.
-	Catálogo de tratamientos/procedimientos (Limpieza, Blanqueamiento, Endodoncia, Ortodoncia, Obturación, etc.) con precios definibles y modificables.
-	Presupuestos de tratamiento con uno o varios procedimientos y total automático.
-	Cobros con método de pago (efectivo, tarjeta, transferencia u otro) y estado Pagado/Pendiente.
-	Caja: consulta de movimientos del día y apertura/cierre con cálculo de ingresos, egresos y diferencias.
-	Registro de gastos por categoría (Materiales e insumos, Depreciación/equipo, Servicios básicos, Arriendo, Publicidad, Otros) con consultas diarias y mensuales.
-	Dashboard en tiempo real: pacientes atendidos hoy, citas del día, ingresos, gastos, utilidad, estado de caja, tratamientos más realizados y próximas citas.
-	Reportes: pacientes y citas por día, tratamientos por día y por odontólogo, ingresos/egresos/utilidad diarios y mensuales, comparación de ingresos entre meses, ranking de tratamientos, métodos de pago e historial de cierres de caja.
-	Auditoría de eventos: inicio de sesión, registro de pacientes/personal, atenciones, cobros y pagos, anulaciones, cambios de precios, y apertura y cierre de caja.

**Integraciones / servicios externos:**
-	Base de datos PostgreSQL en la nube (Neon) con respaldos automáticos.
-	Autenticación segura: contraseñas cifradas (bcrypt) y sesiones con tokens JWT.
-	Despliegue en la nube (Vercel), accesible desde cualquier navegador.
-	Repositorio en GitHub con control de versiones del código.

**Exclusiones expresas:**
-	No incluye módulo de farmacia ni control de inventario (descartado en los requerimientos).
-	No incluye facturación electrónica ni impresión de comprobantes fiscales.
-	No incluye envío de recordatorios o notificaciones por correo, SMS o WhatsApp.
-	No incluye aplicación móvil nativa ni modo de uso sin conexión.
-	No incluye soporte multi-sucursal ni multi-empresa.