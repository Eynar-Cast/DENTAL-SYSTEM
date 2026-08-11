-- ============================================================
-- SCHEMA: Sistema de Gestión para Consultorio Dental
-- Motor: PostgreSQL (Neon)
-- Sin ORM — SQL crudo. Sin módulo de farmacia.
-- Modelo de datos según CONTEXTO_SISTEMA_DENTAL (sección 2).
-- ============================================================

-- ============================================================
-- 1. MÓDULO DE IDENTIDAD (base de personas)
-- ============================================================

CREATE TABLE pais (
    id_pais     SERIAL PRIMARY KEY,
    nombre_pais VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE ciudad (
    id_ciudad     SERIAL PRIMARY KEY,
    nombre_ciudad VARCHAR(100) NOT NULL,
    id_pais       INT NOT NULL REFERENCES pais(id_pais),
    UNIQUE (nombre_ciudad, id_pais)
);

CREATE TABLE persona (
    id_persona          SERIAL PRIMARY KEY,
    documento_identidad VARCHAR(30)  NOT NULL UNIQUE,
    nombres             VARCHAR(100) NOT NULL,
    apellidos           VARCHAR(100) NOT NULL,
    fecha_nacimiento    DATE         NOT NULL,
    id_ciudad           INT          NOT NULL REFERENCES ciudad(id_ciudad),
    direccion_calle     VARCHAR(200)
);

CREATE TABLE telefono_persona (
    id_persona      INT         NOT NULL REFERENCES persona(id_persona) ON DELETE CASCADE,
    numero_telefono VARCHAR(20) NOT NULL,
    PRIMARY KEY (id_persona, numero_telefono)
);

CREATE INDEX idx_telefono_persona ON telefono_persona(id_persona);

CREATE TABLE grupo_sanguineo (
    id_grupo_sanguineo SERIAL PRIMARY KEY,
    descripcion        VARCHAR(10) NOT NULL UNIQUE
);

-- ============================================================
-- 2. MÓDULO DE CONSULTORIO (personal odontológico)
-- ============================================================

CREATE TABLE especialidad (
    id_especialidad       SERIAL PRIMARY KEY,
    nombre_especialidad   VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE personal (
    id_personal         SERIAL PRIMARY KEY,
    id_persona          INT         NOT NULL UNIQUE REFERENCES persona(id_persona),
    id_especialidad     INT         NOT NULL REFERENCES especialidad(id_especialidad),
    numero_colegiatura  VARCHAR(50) UNIQUE,
    fecha_contratacion  DATE        NOT NULL DEFAULT CURRENT_DATE,
    activo              BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE paciente (
    id_paciente        SERIAL PRIMARY KEY,
    id_persona         INT NOT NULL UNIQUE REFERENCES persona(id_persona),
    id_grupo_sanguineo INT REFERENCES grupo_sanguineo(id_grupo_sanguineo),
    activo             BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================
-- 3. MÓDULO DE SEGURIDAD (autenticación y roles / RBAC)
-- ============================================================

CREATE TABLE rol (
    id_rol     SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE permiso (
    id_permiso     SERIAL PRIMARY KEY,
    nombre_permiso VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE rol_permiso (
    id_rol     INT NOT NULL REFERENCES rol(id_rol)      ON DELETE CASCADE,
    id_permiso INT NOT NULL REFERENCES permiso(id_permiso) ON DELETE CASCADE,
    PRIMARY KEY (id_rol, id_permiso)
);

CREATE TABLE usuario (
    id_usuario     SERIAL PRIMARY KEY,
    id_persona     INT          NOT NULL UNIQUE REFERENCES persona(id_persona),
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE usuario_rol (
    id_usuario       INT  NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_rol           INT  NOT NULL REFERENCES rol(id_rol)         ON DELETE CASCADE,
    fecha_asignacion DATE NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (id_usuario, id_rol)
);

CREATE TABLE sesion_usuario (
    id_sesion    SERIAL PRIMARY KEY,
    id_usuario   INT         NOT NULL REFERENCES usuario(id_usuario),
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_fin    TIMESTAMPTZ,
    ip_origen    TEXT,
    user_agent   TEXT,
    estado       VARCHAR(20) NOT NULL DEFAULT 'activa'
        CHECK (estado IN ('activa', 'cerrada', 'expirada'))
);

-- ============================================================
-- 4. MÓDULO DE AUDITORÍA
-- ============================================================

CREATE TABLE auditoria (
    id_auditoria         BIGSERIAL   PRIMARY KEY,
    id_usuario           INT         REFERENCES usuario(id_usuario),
    id_sesion            INT         REFERENCES sesion_usuario(id_sesion),
    tabla_afectada       VARCHAR(60) NOT NULL,
    operacion            VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT','UPDATE','DELETE')),
    id_registro_afectado BIGINT,
    valor_anterior       JSONB,
    valor_nuevo          JSONB,
    fecha_hora           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_origen            TEXT
);

CREATE INDEX idx_auditoria_tabla   ON auditoria(tabla_afectada);
CREATE INDEX idx_auditoria_fecha   ON auditoria(fecha_hora DESC);
CREATE INDEX idx_auditoria_usuario ON auditoria(id_usuario);

-- ============================================================
-- 5. MÓDULO DE AGENDA Y CITAS
-- ============================================================

CREATE TABLE estado_cita (
    id_estado   SERIAL PRIMARY KEY,
    descripcion VARCHAR(50) NOT NULL UNIQUE
);

-- UNIQUE(id_personal, fecha_hora): impide citas solapadas por odontólogo
CREATE TABLE cita (
    id_cita     SERIAL PRIMARY KEY,
    id_paciente INT         NOT NULL REFERENCES paciente(id_paciente),
    id_personal INT         NOT NULL REFERENCES personal(id_personal),
    motivo      VARCHAR(250),
    fecha_hora  TIMESTAMPTZ NOT NULL,
    id_estado   INT         NOT NULL REFERENCES estado_cita(id_estado),
    UNIQUE (id_personal, fecha_hora)
);

CREATE INDEX idx_cita_fecha     ON cita(fecha_hora);
CREATE INDEX idx_cita_paciente  ON cita(id_paciente);
CREATE INDEX idx_cita_personal  ON cita(id_personal);

-- ============================================================
-- 6. MÓDULO DE ATENCIÓN ODONTOLÓGICA
-- ============================================================

CREATE TABLE atencion (
    id_atencion        SERIAL PRIMARY KEY,
    id_cita            INT  NOT NULL UNIQUE REFERENCES cita(id_cita),
    motivo_consulta    TEXT,
    sintomas_referidos TEXT,
    notas_odontologo   TEXT
);

CREATE TABLE tipo_signo_vital (
    id_tipo SERIAL PRIMARY KEY,
    nombre  VARCHAR(80) NOT NULL UNIQUE,
    unidad  VARCHAR(20)
);

CREATE TABLE signo_vital (
    id_signo  SERIAL        PRIMARY KEY,
    id_atencion INT         NOT NULL REFERENCES atencion(id_atencion) ON DELETE CASCADE,
    id_tipo     INT         NOT NULL REFERENCES tipo_signo_vital(id_tipo),
    valor       NUMERIC(7,2) NOT NULL,
    UNIQUE (id_atencion, id_tipo)
);

CREATE TABLE catalogo_diagnostico (
    codigo_diagnostico VARCHAR(10)  PRIMARY KEY,
    descripcion        VARCHAR(300) NOT NULL
);

CREATE TABLE diagnostico_atencion (
    id_atencion          INT         NOT NULL REFERENCES atencion(id_atencion) ON DELETE CASCADE,
    codigo_diagnostico   VARCHAR(10) NOT NULL REFERENCES catalogo_diagnostico(codigo_diagnostico),
    observaciones        TEXT,
    PRIMARY KEY (id_atencion, codigo_diagnostico)
);

CREATE TABLE procedimiento (
    id_procedimiento SERIAL PRIMARY KEY,
    nombre           VARCHAR(100) NOT NULL UNIQUE,
    descripcion      TEXT,
    precio_actual    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (precio_actual >= 0),
    activo           BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE atencion_procedimiento (
    id_atencion     INT NOT NULL REFERENCES atencion(id_atencion) ON DELETE CASCADE,
    id_procedimiento INT NOT NULL REFERENCES procedimiento(id_procedimiento),
    cantidad        INT NOT NULL CHECK (cantidad > 0),
    PRIMARY KEY (id_atencion, id_procedimiento)
);

CREATE TABLE precio_historial (
    id_precio        SERIAL PRIMARY KEY,
    id_procedimiento INT          NOT NULL REFERENCES procedimiento(id_procedimiento),
    monto            NUMERIC(12,2) NOT NULL,
    fecha_cambio     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    id_usuario       INT          REFERENCES usuario(id_usuario)
);

-- ============================================================
-- 7. MÓDULO DE COBROS Y PRESUPUESTO (CAJA)
-- ============================================================

CREATE TABLE metodo_pago (
    id_metodo_pago SERIAL PRIMARY KEY,
    descripcion    VARCHAR(50) NOT NULL UNIQUE
);

-- Solo puede existir UNA caja abierta a la vez (a nivel de BD)
CREATE TABLE caja (
    id_caja                SERIAL PRIMARY KEY,
    fecha_apertura         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    monto_inicial          NUMERIC(12,2) NOT NULL DEFAULT 0,
    id_usuario_apertura    INT          NOT NULL REFERENCES usuario(id_usuario),
    fecha_cierre           TIMESTAMPTZ,
    monto_declarado_cierre NUMERIC(12,2),
    diferencia             NUMERIC(12,2),
    estado                 VARCHAR(20)  NOT NULL DEFAULT 'abierta'
        CHECK (estado IN ('abierta', 'cerrada'))
);

CREATE UNIQUE INDEX idx_caja_unica_abierta ON caja ((true)) WHERE estado = 'abierta';

CREATE TABLE presupuesto (
    id_presupuesto SERIAL PRIMARY KEY,
    id_paciente    INT         NOT NULL REFERENCES paciente(id_paciente),
    id_cita        INT         REFERENCES cita(id_cita),
    fecha_emision  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total          NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado         VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'pagado'))
);

CREATE TABLE detalle_presupuesto (
    id_presupuesto  INT         NOT NULL REFERENCES presupuesto(id_presupuesto) ON DELETE CASCADE,
    id_procedimiento INT        NOT NULL REFERENCES procedimiento(id_procedimiento),
    precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
    cantidad        INT         NOT NULL CHECK (cantidad > 0),
    PRIMARY KEY (id_presupuesto, id_procedimiento)
);

CREATE INDEX idx_presupuesto_fecha   ON presupuesto(fecha_emision);
CREATE INDEX idx_presupuesto_paciente ON presupuesto(id_paciente);

CREATE TABLE cobro (
    id_cobro         SERIAL PRIMARY KEY,
    id_presupuesto   INT          NOT NULL REFERENCES presupuesto(id_presupuesto),
    id_caja          INT          NOT NULL REFERENCES caja(id_caja),
    id_metodo_pago   INT          NOT NULL REFERENCES metodo_pago(id_metodo_pago),
    monto            NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha_hora       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    anulado          BOOLEAN      NOT NULL DEFAULT FALSE,
    motivo_anulacion TEXT,
    id_usuario       INT          NOT NULL REFERENCES usuario(id_usuario)
);

CREATE INDEX idx_cobro_fecha     ON cobro(fecha_hora);
CREATE INDEX idx_cobro_caja      ON cobro(id_caja);
CREATE INDEX idx_cobro_presupuesto ON cobro(id_presupuesto);

-- ============================================================
-- 8. MÓDULO DE GASTOS
-- ============================================================

CREATE TABLE categoria_gasto (
    id_categoria SERIAL PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE gasto (
    id_gasto         SERIAL PRIMARY KEY,
    id_categoria     INT          NOT NULL REFERENCES categoria_gasto(id_categoria),
    motivo           TEXT         NOT NULL,
    monto            NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    fecha            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    id_caja          INT          REFERENCES caja(id_caja),
    anulado          BOOLEAN      NOT NULL DEFAULT FALSE,
    motivo_anulacion TEXT,
    id_usuario       INT          NOT NULL REFERENCES usuario(id_usuario)
);

CREATE INDEX idx_gasto_fecha ON gasto(fecha);
CREATE INDEX idx_gasto_caja  ON gasto(id_caja);

-- ============================================================
-- DATOS INICIALES (seed)
-- ============================================================

INSERT INTO pais (nombre_pais) VALUES ('Bolivia');

INSERT INTO ciudad (nombre_ciudad, id_pais) VALUES
    ('La Paz', 1), ('El Alto', 1), ('Cochabamba', 1), ('Santa Cruz', 1),
    ('Oruro', 1), ('Potosí', 1), ('Tarija', 1), ('Sucre', 1), ('Trinidad', 1), ('Cobija', 1);

INSERT INTO grupo_sanguineo (descripcion) VALUES
    ('A+'), ('A-'), ('B+'), ('B-'), ('AB+'), ('AB-'), ('O+'), ('O-');

INSERT INTO especialidad (nombre_especialidad) VALUES
    ('Odontología General'), ('Ortodoncia'), ('Endodoncia'), ('Periodoncia'),
    ('Rehabilitación / Prótesis'), ('Cirugía Oral'), ('Odontopediatría'),
    ('Asistencia Dental'), ('Recepción');

INSERT INTO rol (nombre_rol) VALUES
    ('admin'), ('recepcionista'), ('odontologo');

INSERT INTO permiso (nombre_permiso) VALUES
    ('pacientes.ver'), ('pacientes.crear'), ('pacientes.editar'),
    ('citas.ver'), ('citas.crear'), ('citas.cancelar'),
    ('atenciones.ver'), ('atenciones.crear'),
    ('procedimientos.ver'), ('procedimientos.editar'), ('precios.editar'),
    ('presupuestos.ver'), ('presupuestos.crear'),
    ('cobros.ver'), ('cobros.crear'), ('cobros.anular'),
    ('gastos.ver'), ('gastos.crear'), ('gastos.anular'),
    ('caja.apertura'), ('caja.cierre'),
    ('reportes.ver'), ('auditoria.ver'), ('usuarios.gestionar');

-- admin recibe todos los permisos
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM rol r, permiso p WHERE r.nombre_rol = 'admin';

INSERT INTO estado_cita (descripcion) VALUES
    ('agendada'), ('atendida'), ('cancelada'), ('no_asistio');

INSERT INTO tipo_signo_vital (nombre, unidad) VALUES
    ('Presión arterial sistólica', 'mmHg'),
    ('Presión arterial diastólica', 'mmHg'),
    ('Frecuencia cardíaca', 'bpm'),
    ('Temperatura corporal', '°C'),
    ('Saturación de oxígeno', '%'),
    ('Peso', 'kg'),
    ('Talla', 'cm');

INSERT INTO catalogo_diagnostico (codigo_diagnostico, descripcion) VALUES
    ('K00', 'Trastornos del desarrollo y erupción de los dientes'),
    ('K02', 'Caries dental'),
    ('K03', 'Otras enfermedades de los tejidos duros de los dientes'),
    ('K04', 'Enfermedades de la pulpa y de los tejidos periapicales'),
    ('K05', 'Gingivitis y enfermedades periodontales'),
    ('K07', 'Anomalías dentofaciales (incluye maloclusión)'),
    ('K08', 'Otras alteraciones de los dientes y sus estructuras de sostén'),
    ('M26', 'Trastornos de la articulación temporomandibular'),
    ('M27', 'Otras enfermedades de los maxilares'),
    ('Z01', 'Examen odontológico general (sin diagnóstico patológico)');

INSERT INTO metodo_pago (descripcion) VALUES
    ('Efectivo'), ('Tarjeta'), ('Transferencia'), ('Otro');

INSERT INTO categoria_gasto (nombre) VALUES
    ('Materiales e insumos'), ('Depreciación / equipo'), ('Servicios básicos'),
    ('Arriendo'), ('Publicidad'), ('Otros gastos');

INSERT INTO procedimiento (nombre, descripcion, precio_actual) VALUES
    ('Consulta general', 'Consulta de valoración y diagnóstico', 120.00),
    ('Limpieza / Profilaxis', 'Limpieza dental profesional', 250.00),
    ('Blanqueamiento', 'Blanqueamiento dental', 700.00),
    ('Endodoncia', 'Tratamiento de conducto', 900.00),
    ('Ortodoncia', 'Tratamiento de ortodoncia', 3500.00),
    ('Obturación (Empaste)', 'Restauración de pieza dental', 300.00),
    ('Extracción', 'Extracción dental', 200.00),
    ('Corona / Prótesis', 'Corona o prótesis dental', 1800.00),
    ('Radiografía', 'Radiografía intraoral', 60.00);

-- Usuario administrador inicial del sistema.
-- Credenciales: admin@consultorio.bo / Admin@1234
-- (El hash es de bcrypt con la contraseña Admin@1234)
INSERT INTO persona (documento_identidad, nombres, apellidos, fecha_nacimiento, id_ciudad)
VALUES ('ADMIN-0001', 'Administrador', 'del Sistema', '1990-01-01',
        (SELECT id_ciudad FROM ciudad ORDER BY id_ciudad LIMIT 1));

INSERT INTO usuario (id_persona, email, password_hash, activo)
VALUES ((SELECT id_persona FROM persona WHERE documento_identidad = 'ADMIN-0001'),
        'admin@consultorio.bo',
        '$2b$10$ptowHXTG3f6/CqqaVIRroOA3WZma45M.PK4ten5NeoFHLOh8C3Wh.',
        TRUE);

INSERT INTO usuario_rol (id_usuario, id_rol)
VALUES ((SELECT id_usuario FROM usuario WHERE email = 'admin@consultorio.bo'),
        (SELECT id_rol FROM rol WHERE nombre_rol = 'admin'));
