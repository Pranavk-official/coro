import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/hono/client";
import { STALE } from "@/hooks/query-config";
import type { CreateRoomBody, PatchRoomBody, PublicRoom } from "@/types/rooms/room";

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    staleTime: STALE.list,
    queryFn: async (): Promise<PublicRoom[]> => apiJson(await api.api.rooms.$get()),
  });
}

export function useRoom(code: string, enabled = true) {
  return useQuery({
    queryKey: ["rooms", code],
    enabled,
    staleTime: STALE.room,
    queryFn: async (): Promise<PublicRoom> =>
      apiJson(await api.api.rooms[":code"].$get({ param: { code } })),
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRoomBody): Promise<PublicRoom> =>
      apiJson(await api.api.rooms.$post({ json: body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
}

export function useUpdateRoom(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: PatchRoomBody): Promise<PublicRoom> =>
      apiJson(await api.api.rooms[":code"].$patch({ param: { code }, json: body })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["rooms", code] });
    },
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<void> => {
      const res = await api.api.rooms[":code"].$delete({ param: { code } });
      if (!res.ok) await apiJson(res); // throws ApiError
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });
}

export function useEndRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<void> => {
      const res = await api.api.rooms[":code"].end.$post({ param: { code } });
      if (!res.ok) await apiJson(res); // throws ApiError
    },
    onSuccess: (_data, code) => {
      qc.invalidateQueries({ queryKey: ["rooms"], exact: true });
      // Not a refetch: an ended instant room is deleted, and a 404 would show "Room not found" instead of "ended".
      qc.setQueryData<PublicRoom>(["rooms", code], (r) => (r ? { ...r, status: "ended" } : r));
    },
  });
}

export function useVerifyPassword(code: string) {
  return useMutation({
    mutationFn: async (password: string): Promise<{ joinToken: string }> =>
      apiJson(await api.api.rooms[":code"].verify.$post({ param: { code }, json: { password } })),
  });
}
