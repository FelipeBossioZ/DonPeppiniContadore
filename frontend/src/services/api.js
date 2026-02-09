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
