import { useMutation, useQuery } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/hono/client";
import { STALE } from "@/hooks/query-config";

export function useStorageHealth() {
  return useQuery({
    queryKey: ["storage", "health"],
    staleTime: STALE.health,
    queryFn: async (): Promise<{ ok: boolean }> => apiJson(await api.api.storage.health.$get()),
  });
}

export function usePresign() {
  return useMutation({
    mutationFn: async (body: {
      key: string;
      contentType: string;
    }): Promise<{ url: string; expiresIn: number }> => apiJson(await api.api.storage.presign.$post({ json: body })),
  });
}
