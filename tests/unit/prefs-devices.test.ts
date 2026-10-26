import { expect, test } from "@playwright/test";
import { getPrefs, setPrefs } from "../../src/lib/utils/prefs";
import { getStream, openTrack, pickDevice, releaseKind, type DeviceInfo } from "../../src/lib/webrtc/devices";

test("U12 @regression prefs survive missing/broken storage", async () => {
  const defaults = getPrefs();
  expect(defaults.mic).toBe(true);
  expect(defaults.cam).toBe(true);
  expect(defaults.guestName).toBe("");

  const next = setPrefs({ mic: false, guestName: "Dana" });
  expect(next.mic).toBe(false);
  expect(next.guestName).toBe("Dana");
  // no localStorage in node → getPrefs still returns defaults, never throws
  expect(getPrefs().mic).toBe(true);
});

test("U12 @regression device fallback + getStream honours toggles", async () => {
  const devices: DeviceInfo[] = [
    { deviceId: "mic-1", label: "Mic", kind: "audioinput" },
    { deviceId: "cam-1", label: "Cam", kind: "videoinput" },
  ];
  expect(pickDevice(devices, "audioinput", "gone")).toBe("mic-1");
  expect(pickDevice(devices, "audioinput", "mic-1")).toBe("mic-1");
  expect(pickDevice([], "videoinput", null)).toBeNull();

  const calls: MediaStreamConstraints[] = [];
  const fake = {
    enumerateDevices: async () => [],
    getUserMedia: async (c: MediaStreamConstraints) => {
      calls.push(c);
      return {} as MediaStream;
    },
  };
  expect(await getStream({ mic: false, cam: false }, { media: fake })).toBeNull();
  await getStream({ mic: true, cam: false }, { media: fake });
  expect(calls[0]).toEqual({ audio: true, video: false });
  expect(await getStream({ mic: true, cam: true }, { media: null })).toBeNull();
});

test("U12b @regression getStream falls back when the saved device is gone or a kind is missing", async () => {
  const calls: MediaStreamConstraints[] = [];
  const fail = (name: string) => Object.assign(new Error(name), { name });
  const fake = {
    enumerateDevices: async () => [],
    getUserMedia: async (c: MediaStreamConstraints) => {
      calls.push(c);
      if (typeof c.audio === "object") throw fail("OverconstrainedError"); // saved mic unplugged
      if (c.audio) throw fail("NotFoundError"); // no mic at all
      return {} as MediaStream;
    },
  };
  expect(await getStream({ mic: true, cam: true, micId: "gone", camId: null }, { media: fake })).not.toBeNull();
  expect(calls.slice(1)).toEqual([{ audio: true, video: true }, { video: true }]);

  const denied = { ...fake, getUserMedia: async () => { throw fail("NotAllowedError"); } };
  await expect(getStream({ mic: true, cam: true }, { media: denied })).rejects.toThrow("NotAllowedError");
});

test("U22 @regression releaseKind stops + removes one kind; openTrack reopens it (saved device, else default)", async () => {
  type T = { kind: string; stopped: boolean; stop(): void };
  const track = (kind: string): T => ({ kind, stopped: false, stop() { this.stopped = true; } });
  const mic = track("audio");
  const cam = track("video");
  const removed: T[] = [];
  const stream = {
    getAudioTracks: () => [mic].filter((t) => !removed.includes(t)),
    getVideoTracks: () => [cam].filter((t) => !removed.includes(t)),
    removeTrack: (t: T) => removed.push(t),
  } as unknown as MediaStream;
  releaseKind(stream, "video");
  expect(cam.stopped).toBe(true);
  expect(mic.stopped).toBe(false);
  expect(stream.getVideoTracks()).toHaveLength(0);

  const asked: MediaStreamConstraints[] = [];
  const media = {
    enumerateDevices: async () => [],
    getUserMedia: async (c: MediaStreamConstraints) => {
      asked.push(c);
      if (typeof c.video === "object") throw Object.assign(new Error("gone"), { name: "OverconstrainedError" });
      const t = track("video");
      return { getAudioTracks: () => [], getVideoTracks: () => [t] } as unknown as MediaStream;
    },
  };
  const reopened = await openTrack("video", "cam-unplugged", { media });
  expect(reopened?.kind).toBe("video");
  expect(asked[0]).toEqual({ audio: false, video: { deviceId: { exact: "cam-unplugged" } } }); // saved device first
  expect(asked[1]).toEqual({ audio: false, video: true }); // then the default
  expect(await openTrack("audio", null, { media: null })).toBeNull();
});
