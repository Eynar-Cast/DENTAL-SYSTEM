-- ============================================================
-- SCHEMA: Sistema de Gestión para Consultorio Dental
-- Motor: PostgreSQL (Neon)
-- Sin Prisma — SQL crudo, sin módulo de farmacia/inventario
-- ============================================================

-- ============================================================
-- 1. CATÁLOGOS GEOGRÁFICOS
-- ============================================================

CREATE TABLE Pais (
    ID_Pais     SERIAL PRIMARY KEY,
    Nombre_Pais VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Ciudad (
    ID_Ciudad     SERIAL PRIMARY KEY,
    Nombre_Ciudad VARCHAR(100) NOT NULL,
    ID_Pais       INT NOT NULL REFERENCES Pais(ID_Pais),
    UNIQUE (Nombre_Ciudad, ID_Pais)
);

-- ============================================================
-- 2. CATÁLOGOS INSTITUCIONALES
-- ============================================================

CREATE TABLE Departamento (
    ID_Departamento     SERIAL PRIMARY KEY,
    Nombre_Departamento VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Grupo_Sanguineo (
    ID_Grupo_Sanguineo SERIAL PRIMARY KEY,
    Descripcion        VARCHAR(10) NOT NULL UNIQUE  -- 'A+', 'O-', etc.
);

CREATE TABLE Rol (
    ID_Rol     SERIAL PRIMARY KEY,
    Nombre_Rol VARCHAR(50) NOT NULL UNIQUE  -- 'admin', 'medico', 'recepcion', etc.
);

CREATE TABLE Permiso (
    ID_Permiso     SERIAL PRIMARY KEY,
    Nombre_Permiso VARCHAR(100) NOT NULL UNIQUE  -- 'pacientes.crear', 'citas.ver', etc.
);

CREATE TABLE Rol_Permiso (
    ID_Rol     INT NOT NULL REFERENCES Rol(ID_Rol)         ON DELETE CASCADE,
    ID_Permiso INT NOT NULL REFERENCES Permiso(ID_Permiso) ON DELETE CASCADE,
    PRIMARY KEY (ID_Rol, ID_Permiso)
);

-- ============================================================
-- 3. IDENTIDAD (Persona es la entidad central)
-- ============================================================

CREATE TABLE Persona (
    ID_Persona          SERIAL PRIMARY KEY,
    Documento_Identidad VARCHAR(30)  NOT NULL UNIQUE,
    Nombres             VARCHAR(100) NOT NULL,
    Apellidos           VARCHAR(100) NOT NULL,
    Fecha_Nacimiento    DATE         NOT NULL,
    ID_Ciudad           INT          NOT NULL REFERENCES Ciudad(ID_Ciudad),
    Direccion_Calle     VARCHAR(200)
);

CREATE TABLE Telefono_Persona (
    ID_Persona      INT         NOT NULL REFERENCES Persona(ID_Persona) ON DELETE CASCADE,
    Numero_Telefono VARCHAR(20) NOT NULL,
    PRIMARY KEY (ID_Persona, Numero_Telefono)
);

-- Personal médico/administrativo — una persona puede ser solo un empleado
CREATE TABLE Personal (
    ID_Personal          SERIAL PRIMARY KEY,
    ID_Persona           INT         NOT NULL UNIQUE REFERENCES Persona(ID_Persona),
    ID_Departamento      INT         NOT NULL REFERENCES Departamento(ID_Departamento),
    Licencia_Profesional VARCHAR(50) NOT NULL UNIQUE,
    Fecha_Contratacion   DATE        NOT NULL DEFAULT CURRENT_DATE
);

-- Paciente — también es una Persona, con grupo sanguíneo
CREATE TABLE Paciente (
    ID_Paciente        SERIAL PRIMARY KEY,
    ID_Persona         INT NOT NULL UNIQUE REFERENCES Persona(ID_Persona),
    ID_Grupo_Sanguineo INT NOT NULL REFERENCES Grupo_Sanguineo(ID_Grupo_Sanguineo)
);

-- ============================================================
-- 4. USUARIOS Y SESIONES (autenticación)
-- ============================================================

CREATE TABLE Usuario (
    ID_Usuario     SERIAL PRIMARY KEY,
    ID_Persona     INT          NOT NULL UNIQUE REFERENCES Persona(ID_Persona),
    Email          VARCHAR(150) NOT NULL UNIQUE,
    Password_Hash  VARCHAR(255) NOT NULL,
    Activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    Fecha_Creacion TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE Usuario_Rol (
    ID_Usuario       INT  NOT NULL REFERENCES Usuario(ID_Usuario) ON DELETE CASCADE,
    ID_Rol           INT  NOT NULL REFERENCES Rol(ID_Rol)         ON DELETE CASCADE,
    Fecha_Asignacion DATE NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (ID_Usuario, ID_Rol)
);

CREATE TABLE Sesion_Usuario (
    ID_Sesion    SERIAL PRIMARY KEY,
    ID_Usuario   INT         NOT NULL REFERENCES Usuario(ID_Usuario),
    Fecha_Inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    Fecha_Fin    TIMESTAMPTZ,
    IP_Origen    INET,
    User_Agent   TEXT,
    Estado       VARCHAR(20) NOT NULL DEFAULT 'activa'
        CHECK (Estado IN ('activa', 'cerrada', 'expirada'))
);

-- ============================================================
-- 5. AUDITORÍA
-- ============================================================

CREATE TABLE Auditoria (
    ID_Auditoria         BIGSERIAL   PRIMARY KEY,
    ID_Usuario           INT         REFERENCES Usuario(ID_Usuario),
    ID_Sesion            INT         REFERENCES Sesion_Usuario(ID_Sesion),
    Tabla_Afectada       VARCHAR(60) NOT NULL,
    Operacion            VARCHAR(10) NOT NULL CHECK (Operacion IN ('INSERT','UPDATE','DELETE')),
    ID_Registro_Afectado BIGINT,
    Valor_Anterior       JSONB,
    Valor_Nuevo          JSONB,
    Fecha_Hora           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    IP_Origen            INET
);

CREATE INDEX idx_auditoria_tabla   ON Auditoria(Tabla_Afectada);
CREATE INDEX idx_auditoria_fecha   ON Auditoria(Fecha_Hora DESC);
CREATE INDEX idx_auditoria_usuario ON Auditoria(ID_Usuario);

-- ============================================================
-- 6. CITAS Y CONSULTAS
-- ============================================================

CREATE TABLE Estado_Cita (
    ID_Estado   SERIAL PRIMARY KEY,
    Descripcion VARCHAR(50) NOT NULL UNIQUE  -- 'programada','completada','cancelada','no_asistio'
);

-- UNIQUE (ID_Personal, Fecha_Hora) evita que el mismo profesional tenga dos citas al mismo tiempo
CREATE TABLE Cita (
    ID_Cita     SERIAL PRIMARY KEY,
    ID_Paciente INT         NOT NULL REFERENCES Paciente(ID_Paciente),
    ID_Personal INT         NOT NULL REFERENCES Personal(ID_Personal),
    Fecha_Hora  TIMESTAMPTZ NOT NULL,
    ID_Estado   INT         NOT NULL REFERENCES Estado_Cita(ID_Estado),
    UNIQUE (ID_Personal, Fecha_Hora)
);

CREATE TABLE Consulta (
    ID_Consulta         SERIAL PRIMARY KEY,
    ID_Cita             INT  NOT NULL UNIQUE REFERENCES Cita(ID_Cita),
    Sintomas_Subjetivos TEXT
);

-- ============================================================
-- 7. SIGNOS VITALES
-- ============================================================

CREATE TABLE Tipo_Signo_Vital (
    ID_Tipo INT         PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    Nombre  VARCHAR(80) NOT NULL UNIQUE,  -- 'Presión arterial', 'Temperatura', etc.
    Unidad  VARCHAR(20)                   -- 'mmHg', '°C', 'bpm'
);

CREATE TABLE Signo_Vital (
    ID_Signo    SERIAL       PRIMARY KEY,
    ID_Consulta INT          NOT NULL REFERENCES Consulta(ID_Consulta) ON DELETE CASCADE,
    ID_Tipo     INT          NOT NULL REFERENCES Tipo_Signo_Vital(ID_Tipo),
    Valor       NUMERIC(7,2) NOT NULL,
    UNIQUE (ID_Consulta, ID_Tipo)
);

-- ============================================================
-- 8. DIAGNÓSTICOS (CIE-10)
-- ============================================================

CREATE TABLE Catalogo_CIE10 (
    Codigo_CIE10           VARCHAR(10)  PRIMARY KEY,
    Descripcion_Enfermedad VARCHAR(300) NOT NULL
);

CREATE TABLE Diagnostico_Consulta (
    ID_Consulta           INT         NOT NULL REFERENCES Consulta(ID_Consulta) ON DELETE CASCADE,
    Codigo_CIE10          VARCHAR(10) NOT NULL REFERENCES Catalogo_CIE10(Codigo_CIE10),
    Observaciones_Medicas TEXT,
    PRIMARY KEY (ID_Consulta, Codigo_CIE10)
);

-- ============================================================
-- DATOS INICIALES (seed mínimo para poder operar el sistema)
-- ============================================================

INSERT INTO Estado_Cita (Descripcion) VALUES
    ('programada'), ('completada'), ('cancelada'), ('no_asistio');

INSERT INTO Grupo_Sanguineo (Descripcion) VALUES
    ('A+'), ('A-'), ('B+'), ('B-'), ('AB+'), ('AB-'), ('O+'), ('O-');

INSERT INTO Rol (Nombre_Rol) VALUES
    ('admin'), ('odontologo'), ('recepcion');

INSERT INTO Tipo_Signo_Vital (Nombre, Unidad) VALUES
    ('Presión arterial', 'mmHg'),
    ('Temperatura', '°C'),
    ('Frecuencia cardiaca', 'bpm'),
    ('Frecuencia respiratoria', 'rpm'),
    ('Saturación de oxígeno', '%');

INSERT INTO Pais (Nombre_Pais) VALUES ('Bolivia');