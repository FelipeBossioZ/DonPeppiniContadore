// 🎩 Don Peppini - Hooks de Nómina
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getParametrosNomina,
  getEmpleados, createEmpleado, updateEmpleado, deleteEmpleado,
  getNominas, createNomina, liquidarNomina, pagarNomina, deleteNomina,
  getLiquidaciones,
} from "../services/api";

// === PARÁMETROS ===
export function useParametrosNomina(anio) {
  return useQuery({
    queryKey: ["parametros-nomina", anio],
    queryFn: () => getParametrosNomina(anio),
    staleTime: 300_000,
  });
}

// === EMPLEADOS ===
export function useEmpleados(empresaId) {
  return useQuery({
    queryKey: ["empleados", empresaId],
    queryFn: () => getEmpleados({ empresa: empresaId }),
    enabled: !!empresaId,
    staleTime: 60_000,
  });
}

export function useCreateEmpleado(empresaId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEmpleado,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empleados", empresaId] }),
  });
}

export function useUpdateEmpleado(empresaId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateEmpleado,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empleados", empresaId] }),
  });
}

export function useDeleteEmpleado(empresaId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteEmpleado,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empleados", empresaId] }),
  });
}

// === NÓMINAS ===
export function useNominas(empresaId, anio) {
  return useQuery({
    queryKey: ["nominas", empresaId, anio],
    queryFn: () => getNominas({ empresa: empresaId, anio }),
    enabled: !!empresaId,
    staleTime: 30_000,
  });
}

export function useCreateNomina(empresaId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNomina,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nominas"] }),
  });
}

export function useLiquidarNomina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: liquidarNomina,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nominas"] }),
  });
}

export function usePagarNomina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pagarNomina,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nominas"] }),
  });
}

export function useDeleteNomina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNomina,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nominas"] }),
  });
}

// === LIQUIDACIONES ===
export function useLiquidaciones(nominaId) {
  return useQuery({
    queryKey: ["liquidaciones", nominaId],
    queryFn: () => getLiquidaciones(nominaId),
    enabled: !!nominaId,
  });
}
