// 🎩 Don Peppini Contadore - Configuración API
// frontend/src/services/api.js

import axios from 'axios';

// Usar variable de entorno o localhost como fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const instance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Export default Y named (usePeriodo importa { api })
export default instance;
export { instance as api };

// ============================================================
// 🎩 TERCEROS (GLOBALES - sin empresa)
// ============================================================

export async function getTerceros(filters = {}) {
  const params = {};
  if (filters.tipo) params.tipo_tercero = filters.tipo;
  if (filters.search) params.search = filters.search;
  const { data } = await instance.get('/terceros/', { params });
  return data;
}

export async function createTercero(terceroData) {
  const { data } = await instance.post('/terceros/', terceroData);
  return data;
}

export async function updateTercero({ id, ...terceroData }) {
  const { data } = await instance.put(`/terceros/${id}/`, terceroData);
  return data;
}

export async function deleteTercero(id) {
  const { data } = await instance.delete(`/terceros/${id}/`);
  return data;
}

// ============================================================
// 🎩 EMPRESAS
// ============================================================

export async function getEmpresas() {
  const { data } = await instance.get('/empresas/');
  return data;
}

export async function createEmpresa(empresaData) {
  const { data } = await instance.post('/empresas/', empresaData);
  return data;
}

// ============================================================
// 🎩 CUENTAS
// ============================================================

export async function getCuentas(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.search) params.search = filters.search;
  const { data } = await instance.get('/contabilidad/cuentas/', { params });
  return data;
}

// ============================================================
// 🎩 ASIENTOS
// ============================================================

export async function getAsientos(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.fecha_inicio) params.fecha_inicio = filters.fecha_inicio;
  if (filters.fecha_fin) params.fecha_fin = filters.fecha_fin;
  if (filters.page) params.page = filters.page;
  const { data } = await instance.get('/contabilidad/asientos/', { params });
  return data;
}

export async function createAsiento(asientoData) {
  const { data } = await instance.post('/contabilidad/asientos/', asientoData);
  return data;
}

export async function annulAsiento({ id, ...payload }) {
  const { data } = await instance.post(`/contabilidad/asientos/${id}/anular/`, payload);
  return data;
}

// ============================================================
// 🎩 REPORTES CONTABLES
// ============================================================

export async function getLibroDiario(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.fecha_inicio) params.fecha_inicio = filters.fecha_inicio;
  if (filters.fecha_fin) params.fecha_fin = filters.fecha_fin;
  const { data } = await instance.get('/contabilidad/reportes/libro-diario/', { params });
  return data;
}

export async function getBalancePruebas(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.fecha_inicio) params.fecha_inicio = filters.fecha_inicio;
  if (filters.fecha_fin) params.fecha_fin = filters.fecha_fin;
  const { data } = await instance.get('/contabilidad/reportes/balance-pruebas/', { params });
  return data;
}

export async function getBalanceTerceros(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.fecha_inicio) params.fecha_inicio = filters.fecha_inicio;
  if (filters.fecha_fin) params.fecha_fin = filters.fecha_fin;
  if (filters.cuenta) params.cuenta = filters.cuenta;
  const { data } = await instance.get('/contabilidad/reportes/balance-terceros/', { params });
  return data;
}

export async function getLibroMayor(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.cuenta) params.cuenta = filters.cuenta;
  if (filters.fecha_inicio) params.fecha_inicio = filters.fecha_inicio;
  if (filters.fecha_fin) params.fecha_fin = filters.fecha_fin;
  const { data } = await instance.get('/contabilidad/reportes/libro-mayor/', { params });
  return data;
}

export async function getEstadoResultados(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.fecha_inicio) params.fecha_inicio = filters.fecha_inicio;
  if (filters.fecha_fin) params.fecha_fin = filters.fecha_fin;
  const { data } = await instance.get('/contabilidad/reportes/estado-resultados/', { params });
  return data;
}

export async function getBalanceGeneral(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.fecha_inicio) params.fecha_inicio = filters.fecha_inicio;
  if (filters.fecha_fin) params.fecha_fin = filters.fecha_fin;
  const { data } = await instance.get('/contabilidad/reportes/balance-general/', { params });
  return data;
}

// ============================================================
// 🎩 FACTURACIÓN (Invoices)
// ============================================================

export async function getInvoices(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.estado) params.estado = filters.estado;
  if (filters.page) params.page = filters.page;
  const { data } = await instance.get('/facturacion/facturas/', { params });
  return data;
}

export async function createInvoice(invoiceData) {
  const { data } = await instance.post('/facturacion/facturas/', invoiceData);
  return data;
}

export async function updateInvoice({ id, ...invoiceData }) {
  const { data } = await instance.put(`/facturacion/facturas/${id}/`, invoiceData);
  return data;
}

export async function deleteInvoice(id) {
  const { data } = await instance.delete(`/facturacion/facturas/${id}/`);
  return data;
}

// ============================================================
// 🎩 CUENTAS - CRUD
// ============================================================

export async function createCuenta(cuentaData) {
  const { data } = await instance.post('/contabilidad/cuentas/', cuentaData);
  return data;
}

export async function updateCuenta({ id, ...cuentaData }) {
  const { data } = await instance.patch(`/contabilidad/cuentas/${id}/`, cuentaData);
  return data;
}

// ============================================================
// 🎩 NÓMINA
// ============================================================

export async function getParametrosNomina(anio) {
  const { data } = await instance.get('/nomina/parametros/vigente/', { params: { anio } });
  return data;
}

export async function getEmpleados(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.activo !== undefined) params.activo = filters.activo;
  if (filters.search) params.search = filters.search;
  const { data } = await instance.get('/nomina/empleados/', { params });
  return Array.isArray(data) ? data : (data.results || []);
}

export async function createEmpleado(empleadoData) {
  const { data } = await instance.post('/nomina/empleados/', empleadoData);
  return data;
}

export async function updateEmpleado({ id, ...empleadoData }) {
  const { data } = await instance.patch(`/nomina/empleados/${id}/`, empleadoData);
  return data;
}

export async function deleteEmpleado(id) {
  await instance.delete(`/nomina/empleados/${id}/`);
}

export async function simularRetencion(data) {
  const { data: result } = await instance.post('/nomina/simular-retencion/', data);
  return result;
}

// Liquidación de contrato
export async function getLiquidacionesContrato(params) {
  const { data } = await instance.get('/nomina/liquidaciones-contrato/', { params });
  return data;
}

export async function createLiquidacionContrato(payload) {
  const { data } = await instance.post('/nomina/liquidaciones-contrato/', payload);
  return data;
}

export async function getLiquidacionContrato(id) {
  const { data } = await instance.get(`/nomina/liquidaciones-contrato/${id}/`);
  return data;
}

export async function updateLiquidacionContrato(id, payload) {
  const { data } = await instance.patch(`/nomina/liquidaciones-contrato/${id}/`, payload);
  return data;
}

export async function deleteLiquidacionContrato(id) {
  await instance.delete(`/nomina/liquidaciones-contrato/${id}/`);
}

export async function liquidarContrato(id) {
  const { data } = await instance.post(`/nomina/liquidaciones-contrato/${id}/liquidar/`);
  return data;
}

export async function pagarLiquidacionContrato(id) {
  const { data } = await instance.post(`/nomina/liquidaciones-contrato/${id}/pagar/`);
  return data;
}

export async function recalcularLiquidacionContrato(id) {
  const { data } = await instance.post(`/nomina/liquidaciones-contrato/${id}/recalcular/`);
  return data;
}

export async function getNominas(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.anio) params.anio = filters.anio;
  const { data } = await instance.get('/nomina/nominas/', { params });
  return Array.isArray(data) ? data : (data.results || []);
}

export async function createNomina(nominaData) {
  const { data } = await instance.post('/nomina/nominas/', nominaData);
  return data;
}

export async function liquidarNomina({ id, novedades }) {
  const { data } = await instance.post(`/nomina/nominas/${id}/liquidar/`, { novedades });
  return data;
}

export async function pagarNomina(id) {
  const { data } = await instance.post(`/nomina/nominas/${id}/pagar/`);
  return data;
}

export async function deleteNomina(id) {
  await instance.delete(`/nomina/nominas/${id}/`);
}

export async function getLiquidaciones(nominaId) {
  const { data } = await instance.get('/nomina/liquidaciones/', { params: { nomina: nominaId } });
  return Array.isArray(data) ? data : (data.results || []);
}

// === PDF ===
export async function descargarComprobantePDF(liquidacionId) {
  const { data } = await instance.get(`/nomina/comprobante-pdf/${liquidacionId}/`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `comprobante_${liquidacionId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
export async function descargarComprobanteContrato(liquidacionId) {
  const { data } = await instance.get(`/nomina/comprobante-contrato/${liquidacionId}/`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `liquidacion_contrato_${liquidacionId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// === VACACIONES ===
export async function getVacaciones(params) {
  const { data } = await instance.get('/nomina/vacaciones/', { params });
  return data;
}
export async function createVacacion(payload) {
  const { data } = await instance.post('/nomina/vacaciones/', payload);
  return data;
}
export async function updateVacacion(id, payload) {
  const { data } = await instance.patch(`/nomina/vacaciones/${id}/`, payload);
  return data;
}
export async function deleteVacacion(id) {
  await instance.delete(`/nomina/vacaciones/${id}/`);
}
export async function getSaldosVacaciones(params) {
  const { data } = await instance.get('/nomina/vacaciones/saldos/', { params });
  return data;
}

// === PRIMA SEMESTRAL ===
export async function getPrimas(params) {
  const { data } = await instance.get('/nomina/primas/', { params });
  return data;
}
export async function createPrima(payload) {
  const { data } = await instance.post('/nomina/primas/', payload);
  return data;
}
export async function liquidarPrima(id) {
  const { data } = await instance.post(`/nomina/primas/${id}/liquidar/`);
  return data;
}

// === CESANTÍAS ===
export async function getCesantias(params) {
  const { data } = await instance.get('/nomina/cesantias/', { params });
  return data;
}
export async function createCesantias(payload) {
  const { data } = await instance.post('/nomina/cesantias/', payload);
  return data;
}
export async function liquidarCesantias(id) {
  const { data } = await instance.post(`/nomina/cesantias/${id}/liquidar/`);
  return data;
}

// === DASHBOARD NÓMINA ===
export async function getDashboardNomina(params) {
  const { data } = await instance.get('/nomina/dashboard/', { params });
  return data;
}

// === IMPORTAR EMPLEADOS ===
export async function importarEmpleados(empresa, archivo) {
  const fd = new FormData();
  fd.append('empresa', empresa);
  fd.append('archivo', archivo);
  const { data } = await instance.post('/nomina/importar-empleados/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// === LOGO EMPRESA ===
export function getLogoUrl(empresaId) {
  return `${instance.defaults.baseURL}/empresas/${empresaId}/logo/`;
}
export async function uploadLogo(empresaId, file) {
  const fd = new FormData();
  fd.append('logo', file);
  const { data } = await instance.post(`/empresas/${empresaId}/upload_logo/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
export async function deleteLogo(empresaId) {
  const { data } = await instance.delete(`/empresas/${empresaId}/delete_logo/`);
  return data;
}
export async function getLogoBlob(empresaId) {
  const { data } = await instance.get(`/empresas/${empresaId}/logo/`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(data);
}
