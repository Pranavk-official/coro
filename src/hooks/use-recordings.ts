import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiJson } from "@/lib/hono/client";
import { STALE } from "@/hooks/query-config";
import type { PublicRecording } from "@/types/recordings/recording";

const KEY = ["recordings"] as const;

export function useRecordings() {
  return useQuery({
    queryKey: KEY,
    staleTime: STALE.list,
    queryFn: async (): Promise<PublicRecording[]> => apiJson(await api.api.recordings.$get()),
  });
}

/** Recorder side: one call on stop, one more once the Drive upload lands. Both refresh the profile list. */
export function useSaveRecording() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: KEY });
  const create = useMutation({
    mutationFn: async (body: {
      roomCode: string;
      roomName: string;
      name: string;
      mimeType: string;
      bytes: number;
      durationMs: number;
    }): Promise<PublicRecording> => apiJson(await api.api.recordings.$post({ json: body })),
    onSuccess: done,
  });
  const attachDrive = useMutation({
    mutationFn: async (v: { id: string; driveFileId: string }): Promise<PublicRecording> =>
      apiJson(await api.api.recordings[":id"].drive.$patch({ param: { id: v.id }, json: { driveFileId: v.driveFileId } })),
    onSuccess: done,
  });
  return { create, attachDrive };
}

/** Forgets a recording; the file itself stays wherever it was saved. */
export function useDeleteRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await api.api.recordings[":id"].$delete({ param: { id } });
      if (!res.ok) await apiJson(res); // throws ApiError
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
