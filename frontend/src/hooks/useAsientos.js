// frontend/src/hooks/useAsientos.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAsientos, createAsiento } from "../services/api";
import { annulAsiento } from "../services/api";

const key = (filters) => ["asientos", filters];

export function useAsientos(filters = {}) {
  return useQuery({
    queryKey: key(filters),
    queryFn: () => getAsientos(filters),
    select: (data) => ({
      items: data?.results ?? data ?? [],
      count: data?.count ?? (Array.isArray(data) ? data.length : 0),
    }),
    staleTime: 60_000,
  });
}

export function useCreateAsiento(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAsiento,
    onSuccess: () => qc.invalidateQueries({ queryKey: key(filters) }),
  });
}

export function useAnularAsiento(filters = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: annulAsiento,
    onSuccess: () => qc.invalidateQueries({ queryKey: key(filters) }),
  });
}
