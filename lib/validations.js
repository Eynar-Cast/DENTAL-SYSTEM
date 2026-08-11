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

export function textoLimpio(valor) {
  return String(valor || "").trim();
}
