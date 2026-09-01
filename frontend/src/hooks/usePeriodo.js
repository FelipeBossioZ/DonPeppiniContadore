import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api"; // el mismo que ya usas

export function usePeriodo(anio) {
  return useQuery({
    queryKey: ["periodo", anio],
    queryFn: async () => {
      const { data } = await api.get(`/contabilidad/periodo/?anio=${anio}`);
      return data;
    },
    enabled: !!anio,
    staleTime: 60_000,
  });
}
