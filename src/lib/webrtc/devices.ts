export type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

export type DeviceInfo = {
  deviceId: string;
  label: string;
  kind: DeviceKind;
};

export type MediaDeps = {
  media?: {
    enumerateDevices(): Promise<MediaDeviceInfo[]>;
    getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  } | null;
};

function depsMedia(deps?: MediaDeps) {
  if (deps && "media" in deps) return deps.media;
  const nav = globalThis.navigator as Navigator | undefined;
  return nav?.mediaDevices ?? null;
}

export async function listDevices(deps?: MediaDeps): Promise<DeviceInfo[]> {
  const media = depsMedia(deps);
  if (!media) return [];
  const all = await media.enumerateDevices();
  return all
    .filter((d) => d.kind === "audioinput" || d.kind === "videoinput" || d.kind === "audiooutput")
    .map((d) => ({ deviceId: d.deviceId, label: d.label, kind: d.kind as DeviceKind }));
}

export function pickDevice(devices: DeviceInfo[], kind: DeviceKind, savedId: string | null): string | null {
  if (savedId && devices.some((d) => d.kind === kind && d.deviceId === savedId)) return savedId;
  return devices.find((d) => d.kind === kind)?.deviceId ?? null;
}

export async function getStream(
  opts: { mic: boolean; cam: boolean; micId?: string | null; camId?: string | null },
  deps?: MediaDeps,
): Promise<MediaStream | null> {
  const media = depsMedia(deps);
  if (!media || (!opts.mic && !opts.cam)) return null;
  // Saved device gone (OverconstrainedError) or one kind missing (NotFoundError) → defaults, then whichever kind exists (FR24).
  const tries: MediaStreamConstraints[] = [
    {
      audio: opts.mic ? (opts.micId ? { deviceId: { exact: opts.micId } } : true) : false,
      video: opts.cam ? (opts.camId ? { deviceId: { exact: opts.camId } } : true) : false,
    },
    { audio: opts.mic, video: opts.cam },
    ...(opts.mic && opts.cam ? [{ video: true }, { audio: true }] : []),
  ];
  for (const [i, c] of tries.entries()) {
    try {
      return await media.getUserMedia(c);
    } catch (e) {
      const name = (e as Error).name;
      if (i === tries.length - 1 || (name !== "OverconstrainedError" && name !== "NotFoundError")) throw e;
    }
  }
  return null;
}

export async function switchTrack(
  stream: MediaStream,
  kind: "audio" | "video",
  deviceId: string,
  deps?: MediaDeps,
): Promise<MediaStreamTrack | null> {
  const media = depsMedia(deps);
  if (!media) return null;
  const next = await media.getUserMedia({
    [kind === "audio" ? "audio" : "video"]: { deviceId: { exact: deviceId } },
  });
  const [track] = next.getTracks();
  if (!track) return null;
  for (const old of stream.getTracks().filter((t) => t.kind === track.kind)) {
    old.stop();
    stream.removeTrack(old);
  }
  stream.addTrack(track);
  return track;
}

export function setSpeaker(el: HTMLMediaElement, deviceId: string): void {
  const withSink = el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
  if (typeof withSink.setSinkId === "function") {
    void withSink.setSinkId(deviceId).catch(() => undefined);
  }
}

export function onDeviceChange(cb: () => void): () => void {
  const nav = globalThis.navigator as Navigator | undefined;
  const target = nav?.mediaDevices;
  if (!target?.addEventListener) return () => undefined;
  target.addEventListener("devicechange", cb);
  return () => target.removeEventListener("devicechange", cb);
}
