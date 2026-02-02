import { useQuery } from "@tanstack/react-query";
import { getCuentas } from "../services/api";

const key = (filters) => ["cuentas", filters];

const normalize = (data) => {
  const arr = Array.isArray(data) ? data : (data?.results ?? []);
  return arr.map(c => ({
    id: c.id ?? c.codigo,             // por si tu modelo usa código como pk
    codigo: c.codigo ?? "",
    nombre: c.nombre ?? "",
    naturaleza: c.naturaleza ?? "",   // si lo expones
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
