import { expect, test } from "@playwright/test";
import { createPeer, handleSignal, type ManagedPeer } from "../../src/lib/webrtc/peer";

type FakeDesc = { type: RTCSdpType; sdp?: string; toJSON(): RTCSessionDescriptionInit };

function fakeDesc(type: RTCSdpType): FakeDesc {
  return { type, sdp: "v=0", toJSON: () => ({ type, sdp: "v=0" }) };
}

function fakePc() {
  const tracks: { kind: string }[] = [];
  const pc = {
    signalingState: "stable",
    localDescription: null as FakeDesc | null,
    remoteDescription: null as FakeDesc | null,
    closed: false,
    addedTracks: 0,
    candidates: [] as unknown[],
    setLocalDescriptionThrows: false,
    onnegotiationneeded: null as (() => void) | null,
    onicecandidate: null as ((e: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null,
    ontrack: null as ((e: { streams: MediaStream[] }) => void) | null,
    onsignalingstatechange: null as (() => void) | null,
    getSenders: () => tracks.map((t) => ({
      track: { kind: t.kind, applyConstraints: async () => undefined },
      getParameters: () => ({ encodings: [{}] as RTCRtpEncodingParameters[] }),
      setParameters: async () => undefined,
      replaceTrack: async (track: unknown) => {
        tracks.push({ kind: (track as { kind: string } | null)?.kind ?? "gone" });
      },
    })),
    addTrack: () => {
      pc.addedTracks += 1;
    },
    setLocalDescription: async (desc?: RTCSessionDescriptionInit) => {
      if (pc.setLocalDescriptionThrows) throw new Error("closed");
      pc.localDescription = desc ? fakeDesc(desc.type) : fakeDesc("offer");
    },
    setRemoteDescription: async (desc: RTCSessionDescriptionInit) => {
      pc.remoteDescription = fakeDesc(desc.type);
    },
    addIceCandidate: async (c: unknown) => {
      if (c === "boom") throw new Error("bad");
      pc.candidates.push(c);
    },
    close: () => {
      pc.closed = true;
    },
  };
  return pc;
}

function stream() {
  return { getTracks: () => [{ kind: "audio" }, { kind: "video" }] } as unknown as MediaStream;
}

test("U8 @regression polite rolls back on collision, impolite ignores", async () => {
  const signals: unknown[] = [];
  const politePc = fakePc();
  const polite = createPeer([], {
    polite: true,
    stream: stream(),
    onSignal: (d) => signals.push(d),
    onTrack: () => undefined,
    factory: () => politePc as unknown as RTCPeerConnection,
  });
  polite.makingOffer = true;
  await handleSignal(polite, { description: { type: "offer", sdp: "v=0" } });
  expect(polite.ignoreOffer).toBe(false);
  expect(politePc.remoteDescription?.type).toBe("offer");

  const rudePc = fakePc();
  const rude = createPeer([], {
    polite: false,
    stream: stream(),
    onSignal: () => undefined,
    onTrack: () => undefined,
    factory: () => rudePc as unknown as RTCPeerConnection,
  });
  rude.makingOffer = true;
  await handleSignal(rude, { description: { type: "offer", sdp: "v=0" } });
  expect(rude.ignoreOffer).toBe(true);
  expect(rudePc.remoteDescription).toBeNull();
});

test("U8 @regression addIceCandidate error swallowed only when ignoring", async () => {
  const pc = fakePc();
  const peer = createPeer([], {
    polite: false,
    stream: stream(),
    onSignal: () => undefined,
    onTrack: () => undefined,
    factory: () => pc as unknown as RTCPeerConnection,
  });
  peer.ignoreOffer = true;
  await handleSignal(peer, { candidate: "boom" as unknown as RTCIceCandidateInit });
  expect(pc.candidates).toHaveLength(0);

  peer.ignoreOffer = false;
  await handleSignal(peer, { candidate: "boom" as unknown as RTCIceCandidateInit });
  expect(pc.candidates).toHaveLength(0);
});

test("U8 @regression close is idempotent, tracks added", async () => {
  const pc = fakePc();
  const peer: ManagedPeer = createPeer([], {
    polite: true,
    stream: stream(),
    onSignal: () => undefined,
    onTrack: () => undefined,
    factory: () => pc as unknown as RTCPeerConnection,
  });
  expect(pc.addedTracks).toBe(2);
  peer.close();
  peer.close();
  expect(pc.closed).toBe(true);
});
