// frontend/src/hooks/useInvoices.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInvoices, createInvoice, updateInvoice, deleteInvoice } from "../services/api";

const key = (filters) => ["invoices", filters];

export function useInvoices(filters = {}) {
  return useQuery({
    queryKey: key(filters),
    queryFn: () => getInvoices(filters),
    select: (data) => {
      const arr = Array.isArray(data) ? data : (data?.results ?? []);
      return arr.map(x => ({
        id: x.id,
        // si no tienes 'numero' aún, mostramos el id formateado como #0001
        numero: x.numero ?? x.id,
        // tu backend hoy expone cliente_nombre:
        tercero_nombre: x.cliente_nombre ?? x.tercero_nombre ?? "",
        fecha: x.fecha_emision ?? x.fecha ?? x.created_at ?? null,
        total: Number(x.total ?? x.total_bruto ?? 0),
        estado: x.estado ?? "borrador",
      }));
    },
    staleTime: 30_000,
  });
}

export function useCreateInvoice(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: key(filters) }),
  });
}

export function useUpdateInvoice(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: key(filters) }),
  });
}

export function useDeleteInvoice(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteInvoice,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key(filters) });
      const prev = qc.getQueryData(key(filters));
      qc.setQueryData(key(filters), (old) => old?.filter?.(f => f.id !== id) || []);
      return { prev };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(key(filters), ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key(filters) }),
  });
}
