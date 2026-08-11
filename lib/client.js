"use client";

// Wrapper de fetch para el cliente. Maneja errores HTTP con el formato
// { detail: "mensaje" } o { error: "mensaje" } y redirige a /login en 401.
export async function apiFetch(path, options = {}) {
  const config = {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  };

  let res;
  try {
    res = await fetch(path, config);
  } catch (err) {
    throw new Error("No se pudo conectar con el servidor. Verifica tu conexión.");
  }

  if (res.status === 401 && typeof window !== "undefined") {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  if (!res.ok) {
    const mensaje = (data && (data.detail || data.error || data.mensaje)) || "Error del servidor.";
    throw new Error(mensaje);
  }

  return data;
}

export function apiGet(path) {
  return apiFetch(path, { method: "GET" });
}

export function apiPost(path, body) {
  return apiFetch(path, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch(path, body) {
  return apiFetch(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete(path) {
  return apiFetch(path, { method: "DELETE" });
}
