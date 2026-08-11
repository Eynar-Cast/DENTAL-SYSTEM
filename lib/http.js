import { NextResponse } from "next/server";

// Respuestas de error estándar del sistema: { "detail": "mensaje" }
export function jsonError(detail, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export function jsonOk(data, status = 200) {
  return NextResponse.json(data, { status });
}
