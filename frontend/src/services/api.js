// 🎩 Don Peppini Contadore - Servicio API
import axios from "axios";
import { authService } from "./auth";

const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: false,
});

// ——— Authorization
api.interceptors.request.use((config) => {
  const token = authService.getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// —— Refresh token (cola para evitar tormenta)
let isRefreshing = false;
let queue = [];
const subscribe = (cb) => queue.push(cb);
const onRefreshed = (newTok) => { queue.forEach((cb) => cb(newTok)); queue = []; };

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    const original = config;
    const status = response?.status;

    // Sólo manejamos 401 que no sean de endpoints de auth
    if (status === 401 && !original.__isRetryRequest && !original.url.includes("/token")) {
      const hasRefresh = !!authService.getRefreshToken();
      if (!hasRefresh) { authService.logout(); return Promise.reject(error); }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribe((newTok) => {
            if (!newTok) return reject(error);
            original.headers.Authorization = `Bearer ${newTok}`;
            original.__isRetryRequest = true;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const newAccess = await authService.refreshAccessToken();
        isRefreshing = false;
        onRefreshed(newAccess);

        original.headers.Authorization = `Bearer ${newAccess}`;
        original.__isRetryRequest = true;
        return api(original);
      } catch (e) {
        isRefreshing = false;
        onRefreshed(null);
        authService.logout();
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ============================================================================
// 🎩 EMPRESAS
// ============================================================================
export const getEmpresas     = (params={}) => api.get("/empresas/", { params }).then(r => r.data);
export const getEmpresa      = (id)        => api.get(`/empresas/${id}/`).then(r => r.data);
export const createEmpresa   = (payload)   => api.post("/empresas/", payload).then(r => r.data);
export const updateEmpresa   = ({ id, ...payload }) => api.put(`/empresas/${id}/`, payload).then(r => r.data);
export const deleteEmpresa   = (id)        => api.delete(`/empresas/${id}/`).then(r => r.data);
export const getEmpresaResumen = (id)      => api.get(`/empresas/${id}/resumen/`).then(r => r.data);

// ============================================================================
// 🎩 TERCEROS (filtrado por empresa)
// ============================================================================
export const getTerceros   = (params={}) => api.get("/terceros/terceros/", { params }).then(r => r.data);
export const getTercero    = (id)        => api.get(`/terceros/terceros/${id}/`).then(r => r.data);
export const createTercero = (payload)   => api.post("/terceros/terceros/", payload).then(r => r.data);
export const updateTercero = ({ id, ...payload }) => api.put(`/terceros/terceros/${id}/`, payload).then(r => r.data);
export const deleteTercero = (id)        => api.delete(`/terceros/terceros/${id}/`).then(r => r.data);

// ============================================================================
// 🎩 CONTABILIDAD (filtrado por empresa)
// ============================================================================
export const getCuentas    = (params={}) => api.get("/contabilidad/cuentas/", { params }).then(r => r.data);
export const getAsientos   = (params={}) => api.get("/contabilidad/asientos/", { params }).then(r => r.data);
export const getAsiento    = (id)        => api.get(`/contabilidad/asientos/${id}/`).then(r => r.data);
export const createAsiento = (payload)   => api.post("/contabilidad/asientos/", payload).then(r => r.data);
export const updateAsiento = ({ id, ...payload }) => api.put(`/contabilidad/asientos/${id}/`, payload).then(r => r.data);
export const annulAsiento  = ({ id, motivo, contador_pin, gerente_pin }) =>
  api.post(`/contabilidad/asientos/${id}/anular/`, { motivo, contador_pin, gerente_pin }).then(r => r.data);

// ============================================================================
// 🎩 FACTURACIÓN (filtrado por empresa)
// ============================================================================
export const getInvoices   = (params={}) => api.get("/facturacion/facturas/", { params }).then(r => r.data);
export const getInvoice    = (id)        => api.get(`/facturacion/facturas/${id}/`).then(r => r.data);
export const createInvoice = (payload)   => api.post("/facturacion/facturas/", payload).then(r => r.data);
export const updateInvoice = ({ id, ...payload }) => api.put(`/facturacion/facturas/${id}/`, payload).then(r => r.data);
export const deleteInvoice = (id)        => api.delete(`/facturacion/facturas/${id}/`).then(r => r.data);

// ============================================================================
// 🎩 REPORTES (filtrado por empresa)
// ============================================================================
export const getLibroDiario      = (params={}) => api.get("/contabilidad/reportes/libro-diario/", { params }).then(r => r.data);
export const getBalancePruebas   = (params={}) => api.get("/contabilidad/reportes/balance-pruebas/", { params }).then(r => r.data);
export const getLibroMayor       = (codigo, params={}) => api.get(`/contabilidad/reportes/libro-mayor/${codigo}/`, { params }).then(r => r.data);
export const getEstadoResultados = (params={}) => api.get("/contabilidad/reportes/estado-resultados/", { params }).then(r => r.data);
export const getBalanceGeneral   = (params={}) => api.get("/contabilidad/reportes/balance-general/", { params }).then(r => r.data);

// ============================================================================
// 🎩 AUTH
// ============================================================================
export const login = ({ username, password }) =>
  api.post("/token/", { username, password }).then((r) => r.data);
