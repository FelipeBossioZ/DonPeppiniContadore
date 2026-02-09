// 🎩 Don Peppini Contadore - Configuración API
// frontend/src/services/api.js

import axios from 'axios';

// Usar variable de entorno o localhost como fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use(
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
api.interceptors.response.use(
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

export default api;

// ============================================================
// 🎩 FUNCIONES EXPORTADAS - Terceros (GLOBALES, sin empresa)
// ============================================================

export async function getTerceros(filters = {}) {
  const params = {};
  // Ya NO enviamos empresa - terceros son globales
  if (filters.tipo) params.tipo_tercero = filters.tipo;
  if (filters.search) params.search = filters.search;
  const { data } = await api.get('/terceros/', { params });
  return data;
}

export async function createTercero(terceroData) {
  // NO incluir empresa - terceros son globales
  const { data } = await api.post('/terceros/', terceroData);
  return data;
}

export async function updateTercero({ id, ...terceroData }) {
  const { data } = await api.put(`/terceros/${id}/`, terceroData);
  return data;
}

export async function deleteTercero(id) {
  const { data } = await api.delete(`/terceros/${id}/`);
  return data;
}

// ============================================================
// 🎩 FUNCIONES EXPORTADAS - Empresas
// ============================================================

export async function getEmpresas() {
  const { data } = await api.get('/empresas/');
  return data;
}

export async function createEmpresa(empresaData) {
  const { data } = await api.post('/empresas/', empresaData);
  return data;
}

// ============================================================
// 🎩 FUNCIONES EXPORTADAS - Cuentas
// ============================================================

export async function getCuentas(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.search) params.search = filters.search;
  const { data } = await api.get('/contabilidad/cuentas/', { params });
  return data;
}

// ============================================================
// 🎩 FUNCIONES EXPORTADAS - Asientos
// ============================================================

export async function getAsientos(filters = {}) {
  const params = {};
  if (filters.empresa) params.empresa = filters.empresa;
  if (filters.fecha_inicio) params.fecha_inicio = filters.fecha_inicio;
  if (filters.fecha_fin) params.fecha_fin = filters.fecha_fin;
  if (filters.page) params.page = filters.page;
  const { data } = await api.get('/contabilidad/asientos/', { params });
  return data;
}

export async function createAsiento(asientoData) {
  const { data } = await api.post('/contabilidad/asientos/', asientoData);
  return data;
}

export async function annulAsiento({ id, ...payload }) {
  const { data } = await api.post(`/contabilidad/asientos/${id}/anular/`, payload);
  return data;
}
