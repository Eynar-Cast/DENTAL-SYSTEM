// scripts/seed-demo.js
// Inserta datos de prueba realistas para el consultorio dental.
// - Limpia datos operativos previos (conserva catálogos, permisos y admin).
// - Crea: personal, usuarios demo, pacientes, citas, atenciones,
//   presupuestos, cobros (incl. uno anulado), gastos y 2 cajas.
// Uso: node scripts/seed-demo.js
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

function fechaOffset(dias, hora = "09:00") {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const [hh, mm] = hora.split(":");
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function diaLocal(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) { console.error("Falta DATABASE_URL"); process.exit(1); }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const q = async (text, params = []) => {
    const r = await pool.query(text, params);
    return r;
  };
  const idPor = async (sql, val) => {
    const r = val === undefined ? await pool.query(sql) : await pool.query(sql, [val]);
    if (r.rows.length === 0) throw new Error("No se encontró " + val + " en " + sql);
    return r.rows[0].id;
  };

  console.log("=== 1. Limpieza de datos operativos ===");
  await q(`TRUNCATE cobro, gasto, detalle_presupuesto, presupuesto,
           atencion_procedimiento, diagnostico_atencion, signo_vital, atencion,
           cita, sesion_usuario, auditoria, caja, telefono_persona,
           personal, paciente, usuario_rol, usuario RESTART IDENTITY CASCADE`);
  const delPersonas = await q(`DELETE FROM persona WHERE documento_identidad <> 'ADMIN-0001'`);
  console.log(`  Personas no-admin eliminadas: ${delPersonas.rowCount}`);
  await q(`SELECT setval('persona_id_persona_seq', (SELECT COALESCE(MAX(id_persona),1) FROM persona))`);
  console.log("  Listo.");

  console.log("=== 2. Catálogos de referencia ===");
  const idCiudad = await idPor(`SELECT id_ciudad AS id FROM ciudad ORDER BY id_ciudad LIMIT 1`);
  const idEspGeneral = await idPor(`SELECT id_especialidad AS id FROM especialidad WHERE nombre_especialidad = $1`, "Odontología General");
  const idEspOrtodoncia = await idPor(`SELECT id_especialidad AS id FROM especialidad WHERE nombre_especialidad = $1`, "Ortodoncia");
  const idEspEndodoncia = await idPor(`SELECT id_especialidad AS id FROM especialidad WHERE nombre_especialidad = $1`, "Endodoncia");
  const idRolAdmin = await idPor(`SELECT id_rol AS id FROM rol WHERE nombre_rol = $1`, "admin");
  const idRolRecepcion = await idPor(`SELECT id_rol AS id FROM rol WHERE nombre_rol = $1`, "recepcionista");
  const idRolOdontologo = await idPor(`SELECT id_rol AS id FROM rol WHERE nombre_rol = $1`, "odontologo");
  const idEstAgendada = await idPor(`SELECT id_estado AS id FROM estado_cita WHERE descripcion = $1`, "agendada");
  const idEstAtendida = await idPor(`SELECT id_estado AS id FROM estado_cita WHERE descripcion = $1`, "atendida");
  const idEstCancelada = await idPor(`SELECT id_estado AS id FROM estado_cita WHERE descripcion = $1`, "cancelada");
  const idEstNoAsistio = await idPor(`SELECT id_estado AS id FROM estado_cita WHERE descripcion = $1`, "no_asistio");
  const idEfectivo = await idPor(`SELECT id_metodo_pago AS id FROM metodo_pago WHERE descripcion = $1`, "Efectivo");
  const idTarjeta = await idPor(`SELECT id_metodo_pago AS id FROM metodo_pago WHERE descripcion = $1`, "Tarjeta");
  const idTransferencia = await idPor(`SELECT id_metodo_pago AS id FROM metodo_pago WHERE descripcion = $1`, "Transferencia");
  const idCatMateriales = await idPor(`SELECT id_categoria AS id FROM categoria_gasto WHERE nombre = $1`, "Materiales e insumos");
  const idCatServicios = await idPor(`SELECT id_categoria AS id FROM categoria_gasto WHERE nombre = $1`, "Servicios básicos");
  const idCatArriendo = await idPor(`SELECT id_categoria AS id FROM categoria_gasto WHERE nombre = $1`, "Arriendo");
  const gs = async (g) => idPor(`SELECT id_grupo_sanguineo AS id FROM grupo_sanguineo WHERE descripcion = $1`, g);
  const tsTemp = await idPor(`SELECT id_tipo AS id FROM tipo_signo_vital WHERE nombre = $1`, "Temperatura corporal");
  const tsPeso = await idPor(`SELECT id_tipo AS id FROM tipo_signo_vital WHERE nombre = $1`, "Peso");
  const tsTalla = await idPor(`SELECT id_tipo AS id FROM tipo_signo_vital WHERE nombre = $1`, "Talla");
  const tsFC = await idPor(`SELECT id_tipo AS id FROM tipo_signo_vital WHERE nombre = $1`, "Frecuencia cardíaca");
  const idProc = async (n) => idPor(`SELECT id_procedimiento AS id FROM procedimiento WHERE nombre = $1`, n);
  const precioDe = async (n) => {
    const r = await q(`SELECT precio_actual FROM procedimiento WHERE nombre = $1`, [n]);
    return Number(r.rows[0].precio_actual);
  };
  const idDx = async (c) => idPor(`SELECT codigo_diagnostico AS id FROM catalogo_diagnostico WHERE codigo_diagnostico = $1`, c);

  console.log("=== 3. Personal odontológico ===");
  const personal = [];
  const crearPersona = async ({ doc, nombres, apellidos, nac = "1990-01-01", dir = null }) => {
    const r = await q(`INSERT INTO persona (documento_identidad, nombres, apellidos, fecha_nacimiento, id_ciudad, direccion_calle)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_persona`, [doc, nombres, apellidos, nac, idCiudad, dir]);
    return r.rows[0].id_persona;
  };
  const crearPersonal = async ({ doc, nombres, apellidos, esp, coleg, contrat = "2023-01-15" }) => {
    const idP = await crearPersona({ doc, nombres, apellidos });
    const r = await q(`INSERT INTO personal (id_persona, id_especialidad, numero_colegiatura, fecha_contratacion)
      VALUES ($1,$2,$3,$4) RETURNING id_personal`, [idP, esp, coleg, contrat]);
    return r.rows[0].id_personal;
  };

  const idDrMamani = await crearPersonal({ doc: "4567890", nombres: "Carlos", apellidos: "Mamani Quispe", esp: idEspGeneral, coleg: "CO-4567" });
  const idDraQuispe = await crearPersonal({ doc: "7894561", nombres: "Ana", apellidos: "Quispe Condori", esp: idEspOrtodoncia, coleg: "CO-5599" });
  const idDrRojas = await crearPersonal({ doc: "3216549", nombres: "Jorge", apellidos: "Rojas Flores", esp: idEspEndodoncia, coleg: "CO-6123" });
  personal.push({ id: idDrMamani, nombres: "Carlos Mamani" }, { id: idDraQuispe, nombres: "Ana Quispe" }, { id: idDrRojas, nombres: "Jorge Rojas" });
  console.log("  3 odontólogos creados.");

  console.log("=== 4. Usuarios demo ===");
  const passRecepcion = await bcrypt.hash("Recepcion@123", 10);
  const passOdontologo = await bcrypt.hash("Odontologo@123", 10);

  const idPFlores = await crearPersona({ doc: "9876543", nombres: "María Luisa", apellidos: "Flores García", nac: "1995-07-20" });
  const uRecepcion = await q(`INSERT INTO usuario (id_persona, email, password_hash) VALUES ($1,'recepcion@consultorio.bo',$2) RETURNING id_usuario`, [idPFlores, passRecepcion]);
  await q(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1,$2)`, [uRecepcion.rows[0].id_usuario, idRolRecepcion]);

  const idPCarlos = (await q(`SELECT id_persona FROM persona WHERE documento_identidad = '4567890'`)).rows[0].id_persona;
  const uOdon = await q(`INSERT INTO usuario (id_persona, email, password_hash) VALUES ($1,'odontologo@consultorio.bo',$2) RETURNING id_usuario`, [idPCarlos, passOdontologo]);
  await q(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1,$2)`, [uOdon.rows[0].id_usuario, idRolOdontologo]);
  console.log("  recepcion@consultorio.bo / Recepcion@123");
  console.log("  odontologo@consultorio.bo / Odontologo@123");

  console.log("=== 5. Pacientes ===");
  const pacientes = [];
  const crearPaciente = async ({ doc, nombres, apellidos, nac, tel, sangre, dir }) => {
    const idP = await crearPersona({ doc, nombres, apellidos, nac, dir });
    await q(`INSERT INTO telefono_persona (id_persona, numero_telefono) VALUES ($1,$2)`, [idP, tel]);
    const idG = await gs(sangre);
    const r = await q(`INSERT INTO paciente (id_persona, id_grupo_sanguineo) VALUES ($1,$2) RETURNING id_paciente`, [idP, idG]);
    return r.rows[0].id_paciente;
  };

  pacientes.push(
    await crearPaciente({ doc: "1234567", nombres: "Juan", apellidos: "Pérez Mamani", nac: "1985-03-12", tel: "71234567", sangre: "O+", dir: "Av. Arce 123" }),
    await crearPaciente({ doc: "2345678", nombres: "María", apellidos: "González Ríos", nac: "1992-11-02", tel: "72345678", sangre: "A+", dir: "Calle 16 de Julio" }),
    await crearPaciente({ doc: "3456789", nombres: "Roberto", apellidos: "Fernández Siles", nac: "1978-06-25", tel: "73456789", sangre: "A-", dir: "Av. Buenos Aires 456" }),
    await crearPaciente({ doc: "4567891", nombres: "Lucía", apellidos: "Mamani Choque", nac: "2001-01-30", tel: "74567890", sangre: "B+", dir: "Zona Sopocachi" }),
    await crearPaciente({ doc: "5678901", nombres: "Pedro", apellidos: "Choque Apaza", nac: "1965-09-18", tel: "75678901", sangre: "AB+", dir: "Villa Fátima" }),
    await crearPaciente({ doc: "6789012", nombres: "Sofía", apellidos: "Vargas Cruz", nac: "1998-12-05", tel: "76789012", sangre: "O-", dir: "Av. Montenegro 890" })
  );
  console.log(`  6 pacientes creados.`);

  console.log("=== 6. Citas ===");
  const crearCita = async (idPaciente, idPersonal, motivo, fechaHora, idEstado) => {
    const r = await q(`INSERT INTO cita (id_paciente, id_personal, motivo, fecha_hora, id_estado)
      VALUES ($1,$2,$3,$4,$5) RETURNING id_cita`, [idPaciente, idPersonal, motivo, fechaHora, idEstado]);
    return r.rows[0].id_cita;
  };

  const cita1 = await crearCita(pacientes[0], idDrMamani, "Consulta de control", fechaOffset(-1, "09:00"), idEstAtendida);
  const cita2 = await crearCita(pacientes[1], idDrMamani, "Limpieza dental", fechaOffset(-1, "10:30"), idEstAtendida);
  const cita3 = await crearCita(pacientes[2], idDraQuispe, "Valoración ortodoncia", fechaOffset(-2, "09:30"), idEstAtendida);
  const cita4 = await crearCita(pacientes[3], idDrRojas, "Endodoncia pieza 36", fechaOffset(-3, "11:00"), idEstAtendida);
  const cita5 = await crearCita(pacientes[4], idDrMamani, "Control post-extracción", fechaOffset(-4, "08:30"), idEstAtendida);
  const cita6 = await crearCita(pacientes[0], idDrMamani, "Urgencia dental", fechaOffset(-5, "15:00"), idEstNoAsistio);
  const cita7 = await crearCita(pacientes[1], idDraQuispe, "Consulta general", fechaOffset(-6, "10:00"), idEstCancelada);
  const cita8 = await crearCita(pacientes[2], idDrMamani, "Consulta general", fechaOffset(1, "09:00"), idEstAgendada);
  const cita9 = await crearCita(pacientes[3], idDraQuispe, "Ajuste de brackets", fechaOffset(2, "11:30"), idEstAgendada);
  const cita10 = await crearCita(pacientes[4], idDrRojas, "Radiografía + valoración", fechaOffset(3, "16:00"), idEstAgendada);
  console.log(`  10 citas creadas (5 atendidas, 1 no asistió, 1 cancelada, 3 agendadas).`);

  console.log("=== 7. Atenciones (sobre citas atendidas) ===");
  const crearAtencion = async (idCita, motivo, sintomas, notas, signos, dxs, procs) => {
    const r = await q(`INSERT INTO atencion (id_cita, motivo_consulta, sintomas_referidos, notas_odontologo)
      VALUES ($1,$2,$3,$4) RETURNING id_atencion`, [idCita, motivo, sintomas, notas]);
    const idAtencion = r.rows[0].id_atencion;
    for (const s of signos) await q(`INSERT INTO signo_vital (id_atencion, id_tipo, valor) VALUES ($1,$2,$3)`, [idAtencion, s.tipo, s.valor]);
    for (const dx of dxs) await q(`INSERT INTO diagnostico_atencion (id_atencion, codigo_diagnostico, observaciones) VALUES ($1,$2,$3)`, [idAtencion, dx.codigo, dx.obs || null]);
    for (const pr of procs) await q(`INSERT INTO atencion_procedimiento (id_atencion, id_procedimiento, cantidad) VALUES ($1,$2,$3)`, [idAtencion, pr.proc, pr.cant]);
    return idAtencion;
  };

  await crearAtencion(cita1, "Control post limpieza", "Sin molestias", "Paciente sin patología evidente.", 
    [{ tipo: tsTemp, valor: 36.4 }, { tipo: tsFC, valor: 72 }],
    [{ codigo: await idDx("Z01") }],
    [{ proc: await idProc("Consulta general"), cant: 1 }]);
  await crearAtencion(cita2, "Limpieza dental profesional", "Sarro acumulado en molares", "Se realizó profilaxis completa.", 
    [{ tipo: tsTemp, valor: 36.6 }, { tipo: tsPeso, valor: 68 }],
    [{ codigo: await idDx("Z01") }],
    [{ proc: await idProc("Limpieza / Profilaxis"), cant: 1 }]);
  await crearAtencion(cita3, "Valoración para ortodoncia", "Apiñamiento dental", "Se recomienda tratamiento de ortodoncia.", 
    [{ tipo: tsTemp, valor: 36.5 }],
    [{ codigo: await idDx("K07"), obs: "Maloclusión clase II" }],
    [{ proc: await idProc("Ortodoncia"), cant: 1 }]);
  await crearAtencion(cita4, "Endodoncia pieza 36", "Dolor severo al masticar", "Conducto tratado en 2 sesiones.", 
    [{ tipo: tsTemp, valor: 37.0 }, { tipo: tsFC, valor: 84 }],
    [{ codigo: await idDx("K04"), obs: "Pulpitis irreversible" }],
    [{ proc: await idProc("Endodoncia"), cant: 1 }]);
  await crearAtencion(cita5, "Control post extracción", "Inflamación leve", "Cicatrización normal.", 
    [{ tipo: tsTemp, valor: 36.8 }, { tipo: tsTalla, valor: 172 }],
    [{ codigo: await idDx("Z01") }],
    [{ proc: await idProc("Extracción"), cant: 1 }]);
  console.log("  5 atenciones con signos, diagnósticos y procedimientos.");

  console.log("=== 8. Caja cerrada (ayer) + movimientos ===");
  const pagoConsula = await precioDe("Consulta general"); // 120
  const pagoLimpieza = await precioDe("Limpieza / Profilaxis"); // 250
  const pagoEndo = await precioDe("Endodoncia"); // 900

  const cajaAyer = await q(`INSERT INTO caja (fecha_apertura, monto_inicial, id_usuario_apertura, fecha_cierre, monto_declarado_cierre, diferencia, estado)
    VALUES ($1, $2, 1, $3, $4, 0, 'cerrada') RETURNING id_caja`,
    [fechaOffset(-1, "08:00"), 300, fechaOffset(-1, "18:30"), 300 + pagoConsula + pagoLimpieza + pagoEndo - 120]);

  // Presupuesto 1 (Juan, pagado): Consulta + Limpieza
  const pr1 = await q(`INSERT INTO presupuesto (id_paciente, id_cita, fecha_emision, total, estado)
    VALUES ($1,$2,$3,$4,'pagado') RETURNING id_presupuesto`, [pacientes[0], cita1, fechaOffset(-1, "09:30"), pagoConsula + pagoLimpieza]);
  await q(`INSERT INTO detalle_presupuesto (id_presupuesto, id_procedimiento, precio_unitario, cantidad) VALUES ($1,$2,$3,1)`, [pr1.rows[0].id_presupuesto, await idProc("Consulta general"), pagoConsula]);
  await q(`INSERT INTO detalle_presupuesto (id_presupuesto, id_procedimiento, precio_unitario, cantidad) VALUES ($1,$2,$3,1)`, [pr1.rows[0].id_presupuesto, await idProc("Limpieza / Profilaxis"), pagoLimpieza]);
  await q(`INSERT INTO cobro (id_presupuesto, id_caja, id_metodo_pago, monto, fecha_hora, id_usuario)
    VALUES ($1,$2,$3,$4,$5,1)`, [pr1.rows[0].id_presupuesto, cajaAyer.rows[0].id_caja, idEfectivo, pagoConsula + pagoLimpieza, fechaOffset(-1, "10:00")]);

  // Presupuesto 2 (María, pagado): Endodoncia
  const pr2 = await q(`INSERT INTO presupuesto (id_paciente, id_cita, fecha_emision, total, estado)
    VALUES ($1,$2,$3,$4,'pagado') RETURNING id_presupuesto`, [pacientes[1], cita4, fechaOffset(-1, "12:00"), pagoEndo]);
  await q(`INSERT INTO detalle_presupuesto (id_presupuesto, id_procedimiento, precio_unitario, cantidad) VALUES ($1,$2,$3,1)`, [pr2.rows[0].id_presupuesto, await idProc("Endodoncia"), pagoEndo]);
  await q(`INSERT INTO cobro (id_presupuesto, id_caja, id_metodo_pago, monto, fecha_hora, id_usuario)
    VALUES ($1,$2,$3,$4,$5,1)`, [pr2.rows[0].id_presupuesto, cajaAyer.rows[0].id_caja, idTarjeta, pagoEndo, fechaOffset(-1, "12:15")]);

  // Gasto ayer: materiales
  await q(`INSERT INTO gasto (id_categoria, motivo, monto, fecha, id_caja, id_usuario)
    VALUES ($1,$2,$3,$4,$5,1)`, [idCatMateriales, "Compra de insumos de limpieza", 120, fechaOffset(-1, "13:00"), cajaAyer.rows[0].id_caja]);
  console.log("  Caja cerrada: inicial 300, ingresos " + (pagoConsula + pagoLimpieza + pagoEndo) + ", egresos 120, diferencia 0.");

  console.log("=== 9. Caja abierta (hoy) + movimientos ===");
  const cajaHoy = await q(`INSERT INTO caja (fecha_apertura, monto_inicial, id_usuario_apertura, estado)
    VALUES (NOW(), 200, 1, 'abierta') RETURNING id_caja`);
  const idCajaHoy = cajaHoy.rows[0].id_caja;

  const pagoOrtodoncia = await precioDe("Ortodoncia"); // 3500
  const pagoObturacion = await precioDe("Obturación (Empaste)"); // 300
  const pagoRadiografia = await precioDe("Radiografía"); // 60
  const pagoBlanqueo = await precioDe("Blanqueamiento"); // 700
  const pagoExtraccion = await precioDe("Extracción"); // 200

  // Presupuesto pendiente: Roberto (Radiografía x2)
  await q(`INSERT INTO presupuesto (id_paciente, id_cita, fecha_emision, total, estado)
    VALUES ($1,NULL,NOW(),$2,'pendiente') RETURNING id_presupuesto`, [pacientes[2], pagoRadiografia * 2]);
  const prPend2 = await q(`SELECT id_presupuesto FROM presupuesto WHERE id_paciente = $1 ORDER BY id_presupuesto DESC LIMIT 1`, [pacientes[2]]);
  await q(`INSERT INTO detalle_presupuesto (id_presupuesto, id_procedimiento, precio_unitario, cantidad) VALUES ($1,$2,$3,2)`, [prPend2.rows[0].id_presupuesto, await idProc("Radiografía"), pagoRadiografia]);

  // Presupuesto pendiente: Lucía (Obturación x1)
  await q(`INSERT INTO presupuesto (id_paciente, id_cita, fecha_emision, total, estado)
    VALUES ($1,NULL,NOW(),$2,'pendiente') RETURNING id_presupuesto`, [pacientes[3], pagoObturacion]);
  const prPend3 = await q(`SELECT id_presupuesto FROM presupuesto WHERE id_paciente = $1 ORDER BY id_presupuesto DESC LIMIT 1`, [pacientes[3]]);
  await q(`INSERT INTO detalle_presupuesto (id_presupuesto, id_procedimiento, precio_unitario, cantidad) VALUES ($1,$2,$3,1)`, [prPend3.rows[0].id_presupuesto, await idProc("Obturación (Empaste)"), pagoObturacion]);

  // Presupuesto pendiente: Sofía (Blanqueamiento) — cobrado y luego ANULADO (vuelve a pendiente)
  const prPend4 = await q(`INSERT INTO presupuesto (id_paciente, id_cita, fecha_emision, total, estado)
    VALUES ($1,NULL,NOW(),$2,'pendiente') RETURNING id_presupuesto`, [pacientes[5], pagoBlanqueo]);
  await q(`INSERT INTO detalle_presupuesto (id_presupuesto, id_procedimiento, precio_unitario, cantidad) VALUES ($1,$2,$3,1)`, [prPend4.rows[0].id_presupuesto, await idProc("Blanqueamiento"), pagoBlanqueo]);
  await q(`INSERT INTO cobro (id_presupuesto, id_caja, id_metodo_pago, monto, fecha_hora, anulado, motivo_anulacion, id_usuario)
    VALUES ($1,$2,$3,$4,NOW(),TRUE,$5,1)`, [prPend4.rows[0].id_presupuesto, idCajaHoy, idTarjeta, pagoBlanqueo, "Pago registrado por error, se anula"]);

  // Cobro válido hoy: Pedro (Extracción, pagado)
  const prPedro = await q(`INSERT INTO presupuesto (id_paciente, id_cita, fecha_emision, total, estado)
    VALUES ($1,$2,NOW(),$3,'pagado') RETURNING id_presupuesto`, [pacientes[4], cita5, pagoExtraccion]);
  await q(`INSERT INTO detalle_presupuesto (id_presupuesto, id_procedimiento, precio_unitario, cantidad) VALUES ($1,$2,$3,1)`, [prPedro.rows[0].id_presupuesto, await idProc("Extracción"), pagoExtraccion]);
  await q(`INSERT INTO cobro (id_presupuesto, id_caja, id_metodo_pago, monto, fecha_hora, id_usuario)
    VALUES ($1,$2,$3,$4,NOW(),1)`, [prPedro.rows[0].id_presupuesto, idCajaHoy, idTransferencia, pagoExtraccion]);

  // Gastos hoy
  await q(`INSERT INTO gasto (id_categoria, motivo, monto, fecha, id_caja, id_usuario)
    VALUES ($1,$2,$3,NOW(),$4,1)`, [idCatServicios, "Pago parcial de luz", 85, idCajaHoy]);
  await q(`INSERT INTO gasto (id_categoria, motivo, monto, fecha, id_caja, id_usuario)
    VALUES ($1,$2,$3,NOW(),$4,1)`, [idCatArriendo, "Alquiler mensual", 1500, idCajaHoy]);
  console.log("  Caja abierta hoy: inicial 200, 3 presupuestos pendientes, 1 cobro válido, 1 cobro anulado, 2 gastos.");

  await pool.end();
  console.log("\n=== SEED DEMO COMPLETADO ===");
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
