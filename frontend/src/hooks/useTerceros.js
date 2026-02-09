// frontend/src/hooks/useTerceros.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTerceros, createTercero, updateTercero, deleteTercero } from "../services/api";

const key = (filters) => ["terceros", filters];

const normalize = (data) => {
  const arr = Array.isArray(data) ? data : (data?.results ?? []);
  return arr.map(t => ({
    ...t,
    // Asegurar que 'nombre' siempre exista (para Contabilidad/Nómina)
    nombre: t.nombre ?? t.nombre_razon_social ?? t.name ?? "",
    // Asegurar que 'nombre_razon_social' siempre exista (para tabla Terceros)
    nombre_razon_social: t.nombre_razon_social ?? t.nombre ?? t.name ?? "",
  }));
};

export function useTerceros(filters = {}) {
  return useQuery({
    queryKey: key(filters),
    queryFn: () => getTerceros(filters),
    select: normalize,
    staleTime: 60_000,
  });
}

export function useCreateTercero(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTercero,
    onSuccess: () => qc.invalidateQueries({ queryKey: key(filters) }),
  });
}

export function useUpdateTercero(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTercero,
    onSuccess: () => qc.invalidateQueries({ queryKey: key(filters) }),
  });
}

export function useDeleteTercero(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTercero,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key(filters) });
      const prev = qc.getQueryData(key(filters));
      qc.setQueryData(key(filters), (old) => old?.filter?.(x => x.id !== id) || []);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key(filters), ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(filters) }),
  });
}
