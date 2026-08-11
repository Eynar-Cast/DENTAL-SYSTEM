// Validaciones compartidas para formularios y API.

export function esEmail(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || ""));
}

export function esNumeroPositivo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0;
}

export function esNumeroNoNegativo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0;
}

export function requerido(valor) {
  return !(valor === undefined || valor === null || String(valor).trim() === "");
}

export function esEnteroPositivo(valor) {
  return Number.isInteger(Number(valor)) && Number(valor) > 0;
}

export function esFecha(valor) {
  return !isNaN(Date.parse(valor));
}

// Formato de fecha ISO estricto: YYYY-MM-DD (con día válido, ej. no 2024-02-30)
export function esFechaISO(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [y, m, d] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

// Formato de mes ISO estricto: YYYY-MM (ej. 2024-07)
export function esMesISO(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}$/.test(valor)) return false;
  const [y, m] = valor.split("-").map(Number);
  return y >= 1900 && m >= 1 && m <= 12;
}

// Valida un rango de fechas (desde/hasta) opcional. Devuelve un mensaje de
// error legible o null si es válido.
export function validarRangoFechas(desde, hasta) {
  if (desde && !esFechaISO(desde)) return "La fecha 'desde' no es válida";
  if (hasta && !esFechaISO(hasta)) return "La fecha 'hasta' no es válida";
  if (desde && hasta && desde > hasta) return "La fecha 'desde' no puede ser mayor que 'hasta'";
  return null;
}

export function textoLimpio(valor) {
  return String(valor || "").trim();
}
