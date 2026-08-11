import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

const COOKIE_NAME = "session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8; // 8 horas

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "Falta la variable de entorno JWT_SECRET. Revisa tu .env.local o Vercel > Environment Variables."
    );
  }
  return new TextEncoder().encode(secret);
}

// ---------- Contraseñas ----------

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

export async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

// ---------- Roles ----------

// Consulta los roles del usuario en la base de datos (fresh, por cada petición).
export async function obtenerRolesUsuario(idUsuario) {
  if (!idUsuario) return [];
  try {
    const result = await query(
      `SELECT r.nombre_rol
       FROM usuario_rol ur
       JOIN rol r ON r.id_rol = ur.id_rol
       WHERE ur.id_usuario = $1`,
      [idUsuario]
    );
    return result.rows.map((row) => row.nombre_rol);
  } catch (err) {
    console.error("Error obteniendo roles:", err);
    return [];
  }
}

export function tieneRol(roles, permitidos) {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => permitidos.includes(r));
}

// ---------- Tokens JWT ----------

export async function createSessionToken({ idUsuario, idPersona, idSesion, email, nombres, roles = [] }) {
  const token = await new SignJWT({ idUsuario, idPersona, idSesion, email, nombres, roles })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  return token;
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch (err) {
    return null;
  }
}

// ---------- Cookies (Server Components / Route Handlers) ----------

export async function setSessionCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// ---------- Helpers para Route Handlers (RBAC en el servidor) ----------

// Devuelve la sesión (payload del JWT) revalidada contra la base de datos,
// o null si no hay sesión válida.
// Revalidación: el usuario debe seguir existiendo y activo, y los roles se
// recargan frescos desde la BD (los del JWT podrían estar desactualizados
// o tener un usuario recientemente desactivado/rebajado). Fail-closed:
// si la BD no responde, se niega el acceso.
export async function requireAuth() {
  const session = await getSession();
  if (!session || !session.idUsuario) return null;

  try {
    const result = await query(
      `SELECT u.activo FROM usuario u WHERE u.id_usuario = $1`,
      [session.idUsuario]
    );
    if (result.rows.length === 0 || !result.rows[0].activo) {
      // El usuario fue eliminado o desactivado: invalidar la cookie para que
      // el proxy no mantenga un bucle /login <-> /dashboard con el JWT vivo.
      await clearSessionCookie();
      return null;
    }

    // Roles frescos desde la BD (no los del JWT que pueden estar obsoletos).
    const roles = await obtenerRolesUsuario(session.idUsuario);
    session.roles = roles;
    return session;
  } catch (err) {
    // Fail-closed sin eliminar la cookie: un error transitorio de BD no debe
    // desloguear a todos los usuarios.
    console.error("Error revalidando sesión:", err);
    return null;
  }
}

// Valida que la sesión tenga al menos uno de los roles permitidos.
export function requireRoles(session, rolesPermitidos) {
  if (!session) return false;
  return tieneRol(session.roles || [], rolesPermitidos);
}

// Obtiene la IP real del cliente desde los headers de Next.
export function obtenerIP(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "desconocida";
}

export { COOKIE_NAME, SESSION_DURATION_SECONDS };
