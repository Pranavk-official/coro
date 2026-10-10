import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["instant", "scheduled", "later"]),
  startsAt: z.iso.datetime().optional(),
  expiresAt: z.iso.datetime().optional(),
  password: z.string().min(1).max(200).optional(),
  allowGuests: z.boolean().optional(),
});

export const patchRoomSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
  password: z.string().min(1).max(200).nullable().optional(),
  allowGuests: z.boolean().optional(),
});

export const verifyRoomSchema = z.object({ password: z.string() });

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type PatchRoomInput = z.infer<typeof patchRoomSchema>;
