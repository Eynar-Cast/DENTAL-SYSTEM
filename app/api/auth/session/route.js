import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: {
      idUsuario: session.idUsuario,
      email: session.email,
      nombres: session.nombres,
      roles: session.roles || [],
    },
  });
}