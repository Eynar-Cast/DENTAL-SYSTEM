import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "session";

function getSecretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function middleware(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, getSecretKey());
    return NextResponse.next();
  } catch (err) {
    // Token inválido o expirado
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};