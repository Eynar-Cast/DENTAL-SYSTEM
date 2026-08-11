import { NextResponse } from "next/server";

// Middleware temporal: por ahora deja pasar todo.
// Cuando implementemos jose + sesiones, aquí validaremos el token
// y redirigiremos a /login si no hay sesión activa en rutas /dashboard/*.
export function middleware(request) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};