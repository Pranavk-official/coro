import { useQuery } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/hono/client";
import type { PublicConfig } from "@/types/api/config";

/** Deployment facts (configured sign-in providers); they only change on a redeploy. */
export function usePublicConfig() {
  return useQuery({
    queryKey: ["config"],
    staleTime: Infinity,
    queryFn: async (): Promise<PublicConfig> => apiJson(await api.api.config.$get()),
  });
}
