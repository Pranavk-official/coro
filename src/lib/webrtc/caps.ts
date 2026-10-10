export type Caps = { width: number; height: number; frameRate: number; bitrate: number };

export function capsFor(peerCount: number): Caps {
  if (peerCount <= 4) {
    return { width: 1280, height: 720, frameRate: 30, bitrate: 1_200_000 };
  }
  return { width: 640, height: 360, frameRate: 15, bitrate: 400_000 };
}
