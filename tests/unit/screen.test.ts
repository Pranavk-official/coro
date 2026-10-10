import { expect, test } from "@playwright/test";
import { getDisplayStream, layoutTiles, splitStreams, tileId } from "@/lib/webrtc/screen";
import { createPeer } from "@/lib/webrtc/peer";

test("U1 @regression splitStreams picks the screen by signalled id, not by order", () => {
  const cam = { id: "cam" };
  const scr = { id: "scr" };
  expect(splitStreams([scr, cam], "scr")).toEqual({ camera: cam, screen: scr });
  expect(splitStreams([cam, scr], "scr")).toEqual({ camera: cam, screen: scr });
  expect(splitStreams([cam], undefined)).toEqual({ camera: cam, screen: null });
  expect(splitStreams([scr], "scr")).toEqual({ camera: null, screen: scr }); // camera blocked, share only
  expect(splitStreams([], "scr")).toEqual({ camera: null, screen: null });
});

test("U2 @regression layoutTiles: pinned > presenter screen > followed; presenter camera stays in the rail", () => {
  const ids = ["a", "b", "c"];
  const keys = (r: ReturnType<typeof layoutTiles>) => ({ main: r.main && tileId(r.main), rail: r.rail.map(tileId) });

  expect(keys(layoutTiles({ ids, presenterId: "b", pinnedId: null, followedId: "c" }))).toEqual({
    main: "screen:b",
    rail: ["a", "b", "c"],
  });
  expect(keys(layoutTiles({ ids, presenterId: "b", pinnedId: "a", followedId: null }))).toEqual({
    main: "a",
    rail: ["screen:b", "b", "c"],
  });
  expect(keys(layoutTiles({ ids, presenterId: null, pinnedId: null, followedId: "c" }))).toEqual({
    main: "c",
    rail: ["a", "b"],
  });
  expect(keys(layoutTiles({ ids, presenterId: null, pinnedId: null, followedId: null }))).toEqual({
    main: null,
    rail: ["a", "b", "c"],
  });
  // stale pin (peer left / share ended) falls through
  expect(keys(layoutTiles({ ids, presenterId: "b", pinnedId: "screen:x", followedId: null })).main).toBe("screen:b");
  expect(keys(layoutTiles({ ids, presenterId: null, pinnedId: "screen:b", followedId: null })).main).toBeNull();
});

test("U3 @regression getDisplayStream asks for audio, retries video-only, never re-asks after a cancel", async () => {
  const ok = { id: "s" } as unknown as MediaStream;
  const calls: DisplayMediaStreamOptions[] = [];
  const make = (fail: (c: DisplayMediaStreamOptions) => Error | null) => ({
    getDisplayMedia: async (c: DisplayMediaStreamOptions) => {
      calls.push(c);
      const err = fail(c);
      if (err) throw err;
      return ok;
    },
  });
  const named = (name: string) => Object.assign(new Error(name), { name });
  const video = { frameRate: { max: 15 } };

  expect(await getDisplayStream(make(() => null))).toBe(ok);
  expect(calls).toEqual([{ video, audio: true }]);

  calls.length = 0;
  expect(await getDisplayStream(make((c) => (c.audio ? named("NotSupportedError") : null)))).toBe(ok);
  expect(calls).toEqual([{ video, audio: true }, { video }]);

  calls.length = 0;
  expect(await getDisplayStream(make(() => named("NotAllowedError")))).toBeNull();
  expect(calls).toHaveLength(1);

  expect(await getDisplayStream(undefined)).toBeNull();
  expect(await getDisplayStream({})).toBeNull();
});

test("U4 @regression setScreen adds screen senders once, then swaps in place; camera replace skips them", async () => {
  type FakeSender = { track: { kind: string } | null; replaced: unknown[]; replaceTrack: (t: unknown) => Promise<void> };
  const sender = (track: { kind: string } | null): FakeSender => {
    const s: FakeSender = {
      track,
      replaced: [],
      replaceTrack: async (t) => {
        s.replaced.push(t);
        s.track = t as { kind: string } | null;
      },
    };
    return s;
  };
  const senders: FakeSender[] = [];
  const added: { kind: string; streamId: string }[] = [];
  const pc = {
    getSenders: () => senders,
    addTrack: (track: { kind: string }, stream: { id: string }) => {
      added.push({ kind: track.kind, streamId: stream.id });
      const s = sender(track);
      senders.push(s);
      return s;
    },
    close: () => undefined,
  };
  const cam = { getTracks: () => [{ kind: "audio" }, { kind: "video" }] } as unknown as MediaStream;
  const peer = createPeer([], {
    polite: true,
    stream: cam,
    onSignal: () => undefined,
    onTrack: () => undefined,
    factory: () => pc as unknown as RTCPeerConnection,
  });
  expect(added.map((a) => a.kind)).toEqual(["audio", "video"]);

  const carrier = { id: "carrier" } as unknown as MediaStream;
  const video = { kind: "video" } as unknown as MediaStreamTrack;
  const audio = { kind: "audio" } as unknown as MediaStreamTrack;
  await peer.setScreen(video, audio, carrier);
  expect(added.slice(2)).toEqual([
    { kind: "video", streamId: "carrier" },
    { kind: "audio", streamId: "carrier" },
  ]);
  const [, camVideo, screenVideo, screenAudio] = senders;

  await peer.setScreen(null, null, carrier); // stop: no new senders
  expect(added).toHaveLength(4);
  expect(screenVideo!.replaced).toEqual([null]);
  expect(screenAudio!.replaced).toEqual([null]);

  await peer.setScreen(video, null, carrier); // share again: reuse
  expect(added).toHaveLength(4);
  expect(screenVideo!.track).toBe(video);

  const newCam = { kind: "video" } as unknown as MediaStreamTrack;
  await peer.replaceVideoTrack(newCam);
  expect(camVideo!.replaced).toEqual([newCam]);
  expect(screenVideo!.track).toBe(video); // untouched
});
