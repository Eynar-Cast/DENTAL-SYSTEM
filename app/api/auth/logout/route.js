import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession, clearSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getSession();

    if (session?.idSesion) {
      await query(
        `UPDATE sesion_usuario 
         SET estado = 'cerrada', fecha_fin = NOW() 
         WHERE id_sesion = $1`,
        [session.idSesion]
      );
    }

    await clearSessionCookie();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en logout:", err);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}