import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCuentas, createCuenta, updateCuenta } from "../services/api";

const key = (filters) => ["cuentas", filters];

const normalize = (data) => {
  const arr = Array.isArray(data) ? data : (data?.results ?? []);
  return arr.map(c => ({
    id: c.id ?? c.codigo,
    codigo: c.codigo ?? "",
    nombre: c.nombre ?? "",
    naturaleza: c.naturaleza ?? "",
    tipo: c.tipo ?? "",
    activa: c.activa ?? true,
    padre: c.padre ?? null,
    empresa: c.empresa ?? null,
  }));
};

export function useCuentas(filters = {}) {
  return useQuery({
    queryKey: key(filters),
    queryFn: () => getCuentas(filters),
    select: normalize,
    staleTime: 5 * 60_000,
  });
}

export function useCreateCuenta(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCuenta,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cuentas"] }),
  });
}

export function useUpdateCuenta(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateCuenta,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cuentas"] }),
  });
}
