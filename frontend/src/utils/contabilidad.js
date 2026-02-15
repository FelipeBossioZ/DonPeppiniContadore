// 🎩 Don Peppini - Utilidades de Contabilidad

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthBoundsISO(d = new Date()) {
  const f = new Date(d.getFullYear(), d.getMonth(), 1);
  const l = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = x => x.toISOString().slice(0, 10);
  return { min: fmt(f), max: fmt(l) };
}

export function parseYMD(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

export function firstDayOfMonth(ymd) {
  const parts = parseYMD(ymd);
  if (!parts) return ymd;
  return new Date(parts.y, parts.m - 1, 1).toISOString().slice(0, 10);
}

export function lastDayOfMonth(ymd) {
  const parts = parseYMD(ymd);
  if (!parts) return ymd;
  return new Date(parts.y, parts.m, 0).toISOString().slice(0, 10);
}

export function naturalezaEsperada(codigo) {
  if (!codigo) return null;
  const s = String(codigo);
  if (s.startsWith("4")) { if (s.startsWith("4175") || s.startsWith("4195")) return null; return "C"; }
  if (s.startsWith("5")) { if (s.startsWith("5905")) return null; return "D"; }
  return null;
}

export const fmtDate = iso => iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-CO") : "";
export const fmtMoney = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(n ?? 0);

export const TIPOS_COMPROBANTE = [
  { value: "RC", label: "RC - Recibo de Caja" },
  { value: "CE", label: "CE - Comprobante de Egreso" },
  { value: "FV", label: "FV - Factura de Venta" },
  { value: "FC", label: "FC - Factura de Compra" },
  { value: "NM", label: "NM - Nómina" },
  { value: "AJ", label: "AJ - Ajustes" },
  { value: "NC", label: "NC - Nota Crédito" },
  { value: "ND", label: "ND - Nota Débito" },
  { value: "CI", label: "CI - Comprobante de Ingreso" },
  { value: "OT", label: "OT - Otros" },
];

// Evaluar expresiones tipo Excel: =1750905*0.04, 1000+500, 2000000/12
export function evalExpr(val) {
  if (val === "" || val === null || val === undefined) return 0;
  let s = String(val).trim();
  if (s.startsWith("=")) s = s.slice(1);
  if (!/^[\d+\-*/().,%\s]+$/.test(s)) return Number(val) || 0;
  try {
    s = s.replace(/,/g, '.');
    s = s.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
    const result = Function('"use strict"; return (' + s + ')')();
    if (typeof result === "number" && isFinite(result)) return Math.round(result * 100) / 100;
  } catch {}
  return Number(val) || 0;
}

export function parseApiError(err) {
  const data = err?.response?.data;
  if (!data) return "Error desconocido.";
  const lines = [];
  const walk = (prefix, val) => {
    if (Array.isArray(val)) val.forEach(v => walk(prefix, v));
    else if (val && typeof val === "object") Object.entries(val).forEach(([k, v]) => walk(prefix ? `${prefix}.${k}` : k, v));
    else lines.push(`${prefix}: ${String(val)}`);
  };
  walk("", data);
  return lines.join("\n");
}
