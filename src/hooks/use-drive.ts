"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/better-auth/client";
import { connectDrive, driveAccountId } from "@/lib/google-drive/client";

const KEY = ["drive-account"] as const;

/** better-auth account id holding the Drive scope, or null when Drive isn't connected. */
export function useDriveAccount(enabled = true) {
  return useQuery({ queryKey: KEY, queryFn: driveAccountId, enabled });
}

export function useConnectDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const id = await connectDrive();
      if (!id) throw new Error("drive_not_connected");
      return id;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Removes the Google link. better-auth refuses when it's the user's only sign-in method. */
export function useDisconnectDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await authClient.unlinkAccount({ accountId });
      if (error) throw new Error(error.code ?? "unlink_failed");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
