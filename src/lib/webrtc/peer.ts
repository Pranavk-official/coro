export type PeerConnectionFactory = (config: RTCConfiguration) => RTCPeerConnection;

export type ManagedPeer = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** Inbound signals applied one at a time (see handleSignal). */
  chain: Promise<void>;
  onSignal: (data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null }) => void;
  onTrack: (stream: MediaStream) => void;
  close: () => void;
  replaceVideoTrack: (track: MediaStreamTrack | null) => Promise<void>;
  replaceAudioTrack: (track: MediaStreamTrack | null) => Promise<void>;
  /**
   * Screen share on its own senders (spec 007): first call adds them under `carrier`'s stream id,
   * later calls swap tracks in place (`null` = stop, no renegotiation).
   */
  setScreen: (video: MediaStreamTrack | null, audio: MediaStreamTrack | null, carrier: MediaStream) => Promise<void>;
  applyCaps: (opts: { width: number; height: number; frameRate: number; bitrate: number }) => Promise<void>;
};

export function createPeer(
  iceServers: RTCIceServer[],
  opts: {
    polite: boolean;
    stream: MediaStream | null;
    onSignal: ManagedPeer["onSignal"];
    onTrack: ManagedPeer["onTrack"];
    factory?: PeerConnectionFactory;
  },
): ManagedPeer {
  const pc = (opts.factory ?? ((config) => new RTCPeerConnection(config)))({ iceServers });
  const screen: { video?: RTCRtpSender; audio?: RTCRtpSender } = {};
  const isScreen = (s: RTCRtpSender) => s === screen.video || s === screen.audio;
  // Camera/mic slots by transceiver kind, so a slot with no track yet (or a stopped one) can still be filled.
  const sendersOf = (kind: "audio" | "video") =>
    (typeof pc.getTransceivers === "function"
      ? pc.getTransceivers().filter((t) => t.receiver.track?.kind === kind).map((t) => t.sender)
      : pc.getSenders().filter((x) => x.track?.kind === kind)
    ).filter((s) => !isScreen(s));
  const peer: ManagedPeer = {
    pc,
    polite: opts.polite,
    makingOffer: false,
    ignoreOffer: false,
    chain: Promise.resolve(),
    onSignal: opts.onSignal,
    onTrack: opts.onTrack,
    close: () => {
      try {
        pc.close();
      } catch {
        /* idempotent */
      }
    },
    replaceVideoTrack: async (track) => {
      await Promise.all(sendersOf("video").map((s) => s.replaceTrack(track)));
    },
    replaceAudioTrack: async (track) => {
      await Promise.all(sendersOf("audio").map((s) => s.replaceTrack(track)));
    },
    setScreen: async (video, audio, carrier) => {
      for (const [kind, track] of [["video", video], ["audio", audio]] as const) {
        const sender = screen[kind];
        try {
          if (sender) await sender.replaceTrack(track);
          else if (track) screen[kind] = pc.addTrack(track, carrier); // renegotiates once
        } catch {
          /* closed connection: nothing to send to */
        }
      }
    },
    applyCaps: async ({ width, height, frameRate, bitrate }) => {
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind !== "video" || isScreen(sender)) continue; // a screen needs its resolution
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0]!.maxBitrate = bitrate;
        await sender.setParameters(params).catch(() => undefined);
        await sender.track
          .applyConstraints({ width, height, frameRate })
          .catch(() => undefined);
      }
    },
  };

  if (opts.stream) {
    for (const track of opts.stream.getTracks()) pc.addTrack(track, opts.stream);
  } else {
    // No camera/mic (blocked or screen-share-only): still receive, and keep slots to send a track later.
    pc.addTransceiver("audio", { direction: "sendrecv" });
    pc.addTransceiver("video", { direction: "sendrecv" });
  }

  pc.onnegotiationneeded = async () => {
    // First offer comes from the impolite side only: both offering at once forces the polite side to roll
    // back mid-gathering, and Chromium then never gathers a candidate on that connection (ICE stuck at
    // "new", no media, ~1 call in 3). Our tracks still go out: their transceivers pair with the offer's.
    if (peer.polite && !pc.remoteDescription) return;
    try {
      peer.makingOffer = true;
      await pc.setLocalDescription();
      if (pc.localDescription) {
        opts.onSignal({ description: pc.localDescription.toJSON() });
      }
    } catch {
      /* rollback handled on next cycle */
    } finally {
      peer.makingOffer = false;
    }
  };

  pc.onicecandidate = (event) => {
    opts.onSignal({ candidate: event.candidate?.toJSON() ?? null });
  };

  pc.ontrack = (event) => {
    if (event.streams[0]) opts.onTrack(event.streams[0]);
  };

  pc.onsignalingstatechange = async () => {
    // perfect negotiation is driven by inbound signal() below
  };

  return peer;
}

/**
 * Signals arrive back-to-back (answer, then a renegotiation offer, then ICE). Applied concurrently, the
 * offer would see a non-stable state and be dropped as a collision, and candidates would hit a missing
 * remote description — the call (or a new screen share, spec 007) then never connects. So: one at a time.
 */
export function handleSignal(
  peer: ManagedPeer,
  data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null },
): Promise<void> {
  peer.chain = peer.chain.then(() => applySignal(peer, data));
  return peer.chain;
}

async function applySignal(
  peer: ManagedPeer,
  data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null },
): Promise<void> {
  const { pc } = peer;
  try {
    if (data.description) {
      const collision = data.description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
      peer.ignoreOffer = !peer.polite && collision;
      if (peer.ignoreOffer) return;
      if (collision) {
        await Promise.all([
          pc.setLocalDescription({ type: "rollback" }),
          pc.setRemoteDescription(data.description),
        ]);
      } else {
        await pc.setRemoteDescription(data.description);
      }
      if (data.description.type === "offer") {
        await pc.setLocalDescription();
        if (pc.localDescription) {
          peer.onSignal({ description: pc.localDescription.toJSON() });
        }
      }
    } else if (data.candidate) {
      try {
        await pc.addIceCandidate(data.candidate);
      } catch {
        if (!peer.ignoreOffer) throw new Error("ice-candidate-failed");
      }
    } else if (data.candidate === null) {
      await pc.addIceCandidate(null as unknown as RTCIceCandidateInit).catch(() => undefined);
    }
  } catch {
    /* negotiation recovers on the next offer cycle */
  }
}
