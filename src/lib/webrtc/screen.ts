/** Screen share helpers (spec 007). Pure except `getDisplayStream`, which takes the media API as an argument. */

/** Split a peer's incoming streams by the signalled screen stream id (never by arrival order). */
export function splitStreams<S extends { id: string }>(
  streams: readonly S[],
  screenId: string | undefined,
): { camera: S | null; screen: S | null } {
  return {
    camera: streams.find((s) => s.id !== screenId) ?? null,
    screen: screenId ? (streams.find((s) => s.id === screenId) ?? null) : null,
  };
}

export type TileKey = { kind: "camera" | "screen"; id: string };

/** Pin/key id of a tile: a peer id for cameras, `screen:<peerId>` for a presentation. */
export const tileId = (t: TileKey): string => (t.kind === "screen" ? `screen:${t.id}` : t.id);

/** Spotlight order: pinned tile → presenter's screen → followed speaker. Everything else goes to the rail. */
export function layoutTiles(o: {
  ids: readonly string[];
  presenterId: string | null;
  pinnedId: string | null;
  followedId: string | null;
}): { main: TileKey | null; rail: TileKey[] } {
  const all: TileKey[] = [
    ...(o.presenterId ? [{ kind: "screen" as const, id: o.presenterId }] : []),
    ...o.ids.map((id) => ({ kind: "camera" as const, id })),
  ];
  const find = (key: string | null) => (key ? all.find((t) => tileId(t) === key) : undefined);
  const main =
    find(o.pinnedId) ?? find(o.presenterId ? `screen:${o.presenterId}` : null) ?? find(o.followedId) ?? null;
  return { main, rail: main ? all.filter((t) => t !== main) : all };
}

type DisplayMedia = { getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream> };

/**
 * Ask for a screen with optional tab/system audio. A user cancel returns null without asking again;
 * any other failure (e.g. a browser rejecting `audio`) retries once video-only.
 */
export async function getDisplayStream(media: DisplayMedia | undefined): Promise<MediaStream | null> {
  if (typeof media?.getDisplayMedia !== "function") return null;
  // ≤ 15 fps: slides/docs don't need more, and the mesh encodes the screen once per peer.
  const video = { frameRate: { max: 15 } };
  try {
    return await media.getDisplayMedia({ video, audio: true });
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    if (name === "NotAllowedError" || name === "AbortError") return null;
    try {
      return await media.getDisplayMedia({ video });
    } catch {
      return null;
    }
  }
}
