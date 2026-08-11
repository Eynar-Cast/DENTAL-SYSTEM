import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "session";

function getSecretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function proxy(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const url = new URL("/login", request.url);
    if (request.nextUrl.pathname !== "/login") {
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  try {
    await jwtVerify(token, getSecretKey());
    if (request.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  } catch (err) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};