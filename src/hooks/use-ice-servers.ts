import { useQuery } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/hono/client";
import { STALE } from "@/hooks/query-config";

export function useIceServers() {
  return useQuery({
    queryKey: ["ice-servers"],
    queryFn: async (): Promise<RTCIceServer[]> =>
      apiJson(await api.api["ice-servers"].$get()),
    staleTime: STALE.ice,
  });
}
