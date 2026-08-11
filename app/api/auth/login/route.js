import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie, obtenerRolesUsuario, obtenerIP } from "@/lib/auth";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos." },
        { status: 400 }
      );
    }

    const userResult = await query(
      `SELECT u.id_usuario, u.id_persona, u.email, u.password_hash, u.activo,
              p.nombres, p.apellidos
       FROM usuario u
       JOIN persona p ON p.id_persona = u.id_persona
       WHERE u.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Credenciales inválidas." },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];

    if (!user.activo) {
      return NextResponse.json(
        { error: "Este usuario está desactivado. Contacta al administrador." },
        { status: 403 }
      );
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: "Credenciales inválidas." },
        { status: 401 }
      );
    }

    // Limpiar sesiones expiradas (inactividad > 8 horas)
    await query(
      `UPDATE sesion_usuario
       SET estado = 'expirada', fecha_fin = NOW()
       WHERE estado = 'activa' AND fecha_inicio < NOW() - INTERVAL '8 hours'`
    );

    const roles = await obtenerRolesUsuario(user.id_usuario);

    const ip = obtenerIP(request);
    const userAgent = request.headers.get("user-agent") || null;

    const sessionResult = await query(
      `INSERT INTO sesion_usuario (id_usuario, ip_origen, user_agent, estado)
       VALUES ($1, $2, $3, 'activa')
       RETURNING id_sesion`,
      [user.id_usuario, ip, userAgent]
    );

    const idSesion = sessionResult.rows[0].id_sesion;

    const token = await createSessionToken({
      idUsuario: user.id_usuario,
      idPersona: user.id_persona,
      idSesion,
      email: user.email,
      nombres: `${user.nombres} ${user.apellidos}`,
      roles,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: {
        idUsuario: user.id_usuario,
        email: user.email,
        nombres: `${user.nombres} ${user.apellidos}`,
        roles,
      },
    });
  } catch (err) {
    console.error("Error en login:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
