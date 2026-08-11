// Rate limiter en memoria (scope de módulo) para mitigar fuerza bruta en login.
// Nota: en despliegues serverless cada instancia tiene su propia memoria, por lo
// que el límite es best-effort (no compartido entre instancias). Suficiente para
// un consultorio; si se requiere 100% estricto, mover el contador a la BD.

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

const intentos = new Map(); // key -> { count, resetsAt }

function keyDe(ip, email) {
  return `${ip}|${(email || "").toLowerCase().trim()}`;
}

export function registroIntentoFallido(ip, email) {
  const key = keyDe(ip, email);
  const ahora = Date.now();
  const previo = intentos.get(key);
  if (!previo || previo.resetsAt < ahora) {
    intentos.set(key, { count: 1, resetsAt: ahora + WINDOW_MS });
  } else {
    previo.count += 1;
  }
}

export function limpiarIntentos(ip, email) {
  intentos.delete(keyDe(ip, email));
}

export function bloqueadoPorIntentos(ip, email) {
  const key = keyDe(ip, email);
  const ahora = Date.now();
  const previo = intentos.get(key);
  if (!previo || previo.resetsAt < ahora) return false;
  return previo.count >= MAX_ATTEMPTS;
}

export { MAX_ATTEMPTS, WINDOW_MS };
