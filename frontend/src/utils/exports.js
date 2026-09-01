// frontend/src/utils/exports.js
import api from "../services/api";
import { authService } from "../services/auth";

function downloadBlob(data, contentType, filename) {
  const blob = new Blob([data], { type: contentType || "application/octet-stream" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename || "archivo";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportBalancePrueba({ inicio, fin, empresa } = {}) {
  if (!authService.getToken()) {
    window.location.href = "/login";
    return;
  }

  const qs = new URLSearchParams();
  if (inicio) qs.set("fecha_inicio", inicio);
  if (fin)    qs.set("fecha_fin",   fin);
  if (empresa) qs.set("empresa", empresa);
  qs.set("formato", "xlsx");

  const { data, headers } = await api.get(
    `/contabilidad/reportes/balance-pruebas/?${qs.toString()}`,
    { responseType: "blob" }
  );

  const cd  = headers["content-disposition"] || "";
  const fn  = cd.split("filename=")[1]?.replace(/"/g, "") || "balance_pruebas.xlsx";
  const cty = headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  downloadBlob(data, cty, fn);
}

export async function exportBalanceTerceros({ inicio, fin, empresa, cuenta } = {}) {
  if (!authService.getToken()) {
    window.location.href = "/login";
    return;
  }

  const qs = new URLSearchParams();
  if (inicio)  qs.set("fecha_inicio", inicio);
  if (fin)     qs.set("fecha_fin",   fin);
  if (empresa) qs.set("empresa", empresa);
  if (cuenta)  qs.set("cuenta", cuenta);
  qs.set("formato", "xlsx");

  const { data, headers } = await api.get(
    `/contabilidad/reportes/balance-terceros/?${qs.toString()}`,
    { responseType: "blob" }
  );

  const cd  = headers["content-disposition"] || "";
  const fn  = cd.split("filename=")[1]?.replace(/"/g, "") || "balance_terceros.xlsx";
  const cty = headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  downloadBlob(data, cty, fn);
}

export async function exportLibroDiario({ inicio, fin, empresa } = {}) {
  if (!authService.getToken()) {
    window.location.href = "/login";
    return;
  }
  const qs = new URLSearchParams();
  if (inicio)  qs.set("fecha_inicio", inicio);
  if (fin)     qs.set("fecha_fin",   fin);
  if (empresa) qs.set("empresa", empresa);
  qs.set("formato", "xlsx");
  const { data, headers } = await api.get(
    `/contabilidad/reportes/libro-diario/?${qs.toString()}`,
    { responseType: "blob" }
  );
  const cd  = headers["content-disposition"] || "";
  const fn  = cd.split("filename=")[1]?.replace(/"/g, "") || "libro_diario.xlsx";
  const cty = headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  downloadBlob(data, cty, fn);
}

export async function exportLibroMayor({ codigo, inicio, fin, empresa } = {}) {
  if (!authService.getToken()) {
    window.location.href = "/login";
    return;
  }
  const qs = new URLSearchParams();
  if (inicio)  qs.set("fecha_inicio", inicio);
  if (fin)     qs.set("fecha_fin",   fin);
  if (empresa) qs.set("empresa", empresa);
  qs.set("formato", "xlsx");
  const { data, headers } = await api.get(
    `/contabilidad/reportes/libro-mayor/${codigo}/?${qs.toString()}`,
    { responseType: "blob" }
  );
  const cd  = headers["content-disposition"] || "";
  const fn  = cd.split("filename=")[1]?.replace(/"/g, "") || `libro_mayor_${codigo}.xlsx`;
  const cty = headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  downloadBlob(data, cty, fn);
}
