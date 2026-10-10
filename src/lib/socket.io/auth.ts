import type { SocketUser } from "@/lib/socket.io/events";

export async function getSocketUser(
  base: string,
  cookie: string | undefined,
): Promise<SocketUser | null> {
  if (!cookie) return null;
  let res: Response;
  try {
    res = await fetch(`${base}/api/auth/get-session`, { headers: { cookie } });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const session = (await res.json()) as {
    user?: { id?: string; name?: string; image?: string | null; isAnonymous?: boolean };
  } | null;
  const user = session?.user;
  if (!user?.id) return null;
  return {
    id: user.id,
    name: user.name ?? "Guest",
    image: user.image ?? null,
    isAnonymous: user.isAnonymous ?? false,
  };
}
