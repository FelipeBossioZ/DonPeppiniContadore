import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCuentas, getAsientos, createAsiento, getLibroDiario, getBalancePruebas, getLibroMayor, getEstadoResultados, getBalanceGeneral } from "../services/api";

export function useCuentas(filters = {}) {
  return useQuery({ queryKey: ["cuentas", filters], queryFn: () => getCuentas(filters), select: (d)=> Array.isArray(d)? d : (d?.results ?? d), staleTime: 60_000 });
}
export function useAsientos(filters = {}) {
  return useQuery({ queryKey: ["asientos", filters], queryFn: () => getAsientos(filters), select: (d)=> Array.isArray(d)? d : (d?.results ?? d), staleTime: 30_000 });
}
export function useCreateAsiento(filters = {}) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: createAsiento, onSuccess: () => { qc.invalidateQueries({ queryKey: ["asientos", filters] }); qc.invalidateQueries({ queryKey: ["cuentas"] }); } });
}
// Reportes
export const useLibroDiario = (params) => useQuery({ queryKey: ["libro-diario", params], queryFn: () => getLibroDiario(params) });
export const useBalancePruebas = (params) => useQuery({ queryKey: ["balance-pruebas", params], queryFn: () => getBalancePruebas(params) });
export const useLibroMayor = (codigoCuenta, params) => useQuery({ queryKey: ["libro-mayor", codigoCuenta, params], queryFn: () => getLibroMayor(codigoCuenta, params), enabled: !!codigoCuenta });
export const useEstadoResultados = (params) => useQuery({ queryKey: ["estado-resultados", params], queryFn: () => getEstadoResultados(params), enabled: !!params?.fecha_fin });
export const useBalanceGeneral = (params) => useQuery({ queryKey: ["balance-general", params], queryFn: () => getBalanceGeneral(params), enabled: !!params?.fecha_fin });
