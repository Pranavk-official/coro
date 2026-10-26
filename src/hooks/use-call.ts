"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket.io/client";
import {
  MAX_PEERS,
  type JoinError,
  type MediaState,
  type Peer,
} from "@/lib/socket.io/events";
import { createPeer, handleSignal, type ManagedPeer } from "@/lib/webrtc/peer";
import { capsFor } from "@/lib/webrtc/caps";
import { createAutoFollow, createSpeakerDetector } from "@/lib/webrtc/speaker";
import { getDisplayStream, splitStreams } from "@/lib/webrtc/screen";
import { useIceServers } from "@/hooks/use-ice-servers";
import { notify } from "@/lib/toast";
import { getPrefs } from "@/lib/utils/prefs";
import { openTrack, releaseKind } from "@/lib/webrtc/devices";

export type CallStatus =
  | { kind: "joining" }
  | { kind: "waiting" }
  | { kind: "in-call" }
  | { kind: "other-tab" } // same account already in the call elsewhere: ask Switch here / Join here too
  | { kind: "failed"; error: JoinError | "denied" | "kicked" | "moved" };

export type RemotePeer = {
  info: Peer;
  /** Camera + mic stream. */
  stream: MediaStream | null;
  /** Presentation (video + optional tab audio) while `info.state.screen`, else null (spec 007). */
  screenStream: MediaStream | null;
  /** Every stream received from this peer; split into the two above by `info.state.screenId`. */
  streams: MediaStream[];
  pc: ManagedPeer;
};

function withMedia(p: RemotePeer): RemotePeer {
  const { camera, screen } = splitStreams(p.streams, p.info.state.screenId);
  return { ...p, stream: camera, screenStream: p.info.state.screen ? screen : null };
}

const FALLBACK_ICE: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export function useCall(opts: {
  code: string;
  joinToken: string | null;
  initialStream: MediaStream | null;
  initialState: MediaState;
  /** Screen-share-only join: picked in pre-join (getDisplayMedia needs that click). */
  initialScreen?: MediaStream | null;
}) {
  const { code, joinToken } = opts;
  const [status, setStatus] = useState<CallStatus>({ kind: "joining" });
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map());
  const [waiting, setWaiting] = useState<Peer[]>([]);
  const [locked, setLocked] = useState(false);
  const [canAdmit, setCanAdmit] = useState(false);
  const [isHost, setIsHost] = useState(false);
  // Only its id matters: the msid peers use to tell our screen from our camera (spec 007 FR3).
  const [carrier] = useState(() => (typeof MediaStream === "undefined" ? null : new MediaStream()));
  const [initialState] = useState<MediaState>(() =>
    opts.initialScreen && carrier ? { ...opts.initialState, screen: true, screenId: carrier.id } : opts.initialState,
  );
  const [localState, setLocalState] = useState<MediaState>(initialState);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(opts.initialScreen ?? null);
  const [localStream] = useState<MediaStream | null>(opts.initialStream);
  // Bumped when a device is released or reopened: the tile and speaking detection re-read the stream.
  const [micTrackId, setMicTrackId] = useState<string | null>(opts.initialStream?.getAudioTracks()[0]?.id ?? null);
  const [camTrackId, setCamTrackId] = useState<string | null>(opts.initialStream?.getVideoTracks()[0]?.id ?? null);
  const { data: iceServers } = useIceServers();
  // Ref, not a dep: ICE servers arriving must not re-run the join effect (leave + rejoin mid-handshake).
  const iceRef = useRef(iceServers);
  useEffect(() => {
    iceRef.current = iceServers;
  }, [iceServers]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [followedId, setFollowedId] = useState<string | null>(null);
  const detectorRef = useRef<ReturnType<typeof createSpeakerDetector> | null>(null);
  const followRef = useRef<ReturnType<typeof createAutoFollow> | null>(null);
  const detectorStreams = useRef(new Map<string, MediaStream | null>());
  const localMicRef = useRef<string | null>(null);

  const pcs = useRef(new Map<string, ManagedPeer>());
  const infos = useRef(new Map<string, Peer>());
  const streamRef = useRef<MediaStream | null>(opts.initialStream);
  const screenRef = useRef<MediaStream | null>(opts.initialScreen ?? null);
  const hereRef = useRef<"switch" | "also" | undefined>(undefined);
  const joinNowRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<MediaState>(initialState);
  const joinedRef = useRef(false);
  const liveRef = useRef(false);
  const peerCountRef = useRef(1);

  const dropPeer = useCallback((id: string) => {
    pcs.current.get(id)?.close();
    pcs.current.delete(id);
    infos.current.delete(id);
    peerCountRef.current = pcs.current.size + 1;
    setPeers((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const patchPeerState = useCallback((id: string, state: MediaState) => {
    const info = infos.current.get(id);
    if (!info) return;
    const next = { ...info, state };
    infos.current.set(id, next);
    setPeers((prev) => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const updated = new Map(prev);
      updated.set(id, withMedia({ ...existing, info: next }));
      return updated;
    });
  }, []);

  const applyAllCaps = useCallback(async () => {
    const caps = capsFor(pcs.current.size + 1);
    await Promise.all([...pcs.current.values()].map((pc) => pc.applyCaps(caps)));
  }, []);

  const addPeerConnection = useCallback(
    (info: Peer, polite: boolean) => {
      const socket = getSocket();
      const stream = streamRef.current;
      if (pcs.current.has(info.id)) return;
      const entry: RemotePeer = {
        info,
        stream: null,
        screenStream: null,
        streams: [],
        pc: createPeer(iceRef.current ?? FALLBACK_ICE, {
          polite,
          stream,
          onSignal: (data) => socket.emit("signal", info.id, data),
          onTrack: (remote) =>
            setPeers((prev) => {
              const existing = prev.get(info.id);
              if (!existing) return prev;
              if (existing.streams.includes(remote)) return prev; // 2nd track of a known stream
              const next = new Map(prev);
              next.set(info.id, withMedia({ ...existing, streams: [...existing.streams, remote] }));
              return next;
            }),
        }),
      };
      // Presenting already: late joiners get the screen too (in the first offer).
      const shared = screenRef.current;
      if (shared && carrier) {
        void entry.pc.setScreen(shared.getVideoTracks()[0] ?? null, shared.getAudioTracks()[0] ?? null, carrier);
      }
      pcs.current.set(info.id, entry.pc);
      infos.current.set(info.id, info);
      const n = pcs.current.size + 1;
      const crossed = (peerCountRef.current <= 4 && n > 4) || (peerCountRef.current > 4 && n <= 4);
      peerCountRef.current = n;
      setPeers((prev) => new Map(prev).set(info.id, entry));
      if (crossed) void applyAllCaps();
    },
    [applyAllCaps, carrier],
  );

  // Off releases the device (camera light and mic indicator go out); on opens it again and swaps it into
  // every peer's sender. `opening` drops a device that arrives after it was switched off again.
  const opening = useRef({ audio: 0, video: 0 });
  const swapTrack = useCallback((kind: "audio" | "video", track: MediaStreamTrack | null) => {
    void Promise.all(
      [...pcs.current.values()].map((pc) => (kind === "video" ? pc.replaceVideoTrack(track) : pc.replaceAudioTrack(track))),
    );
    if (kind === "audio") setMicTrackId(track?.id ?? null);
    else setCamTrackId(track?.id ?? null);
  }, []);
  const setMedia = useCallback(
    (patch: Partial<MediaState>) => {
      const next = { ...stateRef.current, ...patch };
      stateRef.current = next;
      setLocalState(next);
      getSocket().emit("state", next);
      const stream = streamRef.current;
      if (!stream) return; // blocked devices: nothing to open or release
      for (const kind of ["audio", "video"] as const) {
        const on = kind === "audio" ? next.mic : next.cam; // camera runs alongside a share
        const has = (kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks()).length > 0;
        if (!on && has) {
          opening.current[kind]++;
          releaseKind(stream, kind);
          swapTrack(kind, null);
        } else if (on && !has) {
          const ticket = ++opening.current[kind];
          const prefs = getPrefs();
          void openTrack(kind, kind === "audio" ? prefs.micId : prefs.camId)
            .catch(() => null)
            .then((track) => {
              if (ticket !== opening.current[kind] || !liveRef.current) return void track?.stop();
              if (!track) {
                notify("device-error", { title: `Couldn't turn on your ${kind === "audio" ? "microphone" : "camera"}`, variant: "danger" });
                const off = { ...stateRef.current, [kind === "audio" ? "mic" : "cam"]: false };
                stateRef.current = off;
                setLocalState(off);
                getSocket().emit("state", off);
                return;
              }
              stream.addTrack(track);
              swapTrack(kind, track);
              if (kind === "video") void applyAllCaps();
            });
        }
      }
    },
    [swapTrack, applyAllCaps],
  );
  const stopShare = useCallback(async () => {
    const shared = screenRef.current;
    screenRef.current = null;
    shared?.getTracks().forEach((t) => t.stop()); // ends the browser's "sharing" indicator too
    setLocalScreen(null);
    if (stateRef.current.screen) setMedia({ screen: false });
    if (carrier) await Promise.all([...pcs.current.values()].map((pc) => pc.setScreen(null, null, carrier)));
  }, [setMedia, carrier]);

  const switchDevice = useCallback(
    async (kind: "audio" | "video", deviceId: string): Promise<boolean> => {
      // Off: just remember the choice (the caller saves it); turning on opens this device.
      if (!(kind === "audio" ? stateRef.current.mic : stateRef.current.cam)) return true;
      try {
        const next = await navigator.mediaDevices.getUserMedia({
          [kind]: { deviceId: { exact: deviceId } },
        });
        const [track] = next.getTracks();
        if (!track) return false;
        const stream = streamRef.current;
        if (stream) {
          for (const old of stream.getTracks().filter((t) => t.kind === track.kind)) {
            old.stop();
            stream.removeTrack(old);
          }
          stream.addTrack(track);
        }
        swapTrack(kind, track);
        return true;
      } catch {
        return false;
      }
    },
    [swapTrack],
  );

  const startShare = useCallback(async (): Promise<boolean> => {
    if (!carrier) return false;
    const shared = await getDisplayStream(navigator.mediaDevices);
    const video = shared?.getVideoTracks()[0];
    if (!shared || !video) {
      shared?.getTracks().forEach((t) => t.stop());
      return false;
    }
    screenRef.current?.getTracks().forEach((t) => t.stop()); // re-share replaces the old capture
    video.contentHint = "detail"; // text stays sharp; the encoder drops frames rather than resolution
    screenRef.current = shared;
    setLocalScreen(shared);
    // Browser "Stop sharing" bar / closed window. track.stop() from our side never fires this.
    video.addEventListener("ended", () => {
      if (screenRef.current === shared) void stopShare();
    });
    setMedia({ screen: true, screenId: carrier.id }); // before the tracks, so peers classify them on arrival
    const audio = shared.getAudioTracks()[0] ?? null;
    await Promise.all([...pcs.current.values()].map((pc) => pc.setScreen(video, audio, carrier)));
    return true;
  }, [setMedia, stopShare, carrier]);

  // Screen-share-only join: same `ended` handling as a share started in the call.
  useEffect(() => {
    const shared = opts.initialScreen;
    const video = shared?.getVideoTracks()[0];
    if (!shared || !video) return;
    video.contentHint = "detail";
    const onEnded = () => {
      if (screenRef.current === shared) void stopShare();
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [opts.initialScreen, stopShare]);

  useEffect(() => {
    const socket = getSocket();
    let disposed = false;
    liveRef.current = true;

    function stopScreen() {
      screenRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
    }

    // Leaving unmounts the call: release the camera and mic too, or the browser keeps them on.
    function stopLocal() {
      stopScreen();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }

    function cleanupMedia() {
      for (const [, pc] of pcs.current) pc.close();
      pcs.current.clear();
      infos.current.clear();
      peerCountRef.current = 1;
      setPeers(new Map());
    }

    function enterAdmitted(result: {
      peers: Peer[];
      locked: boolean;
      canAdmit: boolean;
      isHost: boolean;
    }) {
      setLocked(result.locked);
      setCanAdmit(result.canAdmit);
      setIsHost(result.isHost);
      for (const peer of result.peers) addPeerConnection(peer, true);
      setStatus({ kind: "in-call" });
      socket.emit("state", stateRef.current);
    }

    function onConnect() {
      if (joinedRef.current) {
        cleanupMedia();
        joinedRef.current = false;
      }
      const here = hereRef.current;
      socket.emit("room:join", code, { ...(joinToken ? { joinToken } : {}), ...(here ? { here } : {}) }, (result) => {
        if (disposed) return;
        if (!result.ok && result.error === "rate_limited") {
          // Stay on "joining"; one retry per window, never a tight loop (spec 002 T17).
          const wait = result.retryAfter ?? 5;
          notify("rate-limited", { title: `Slow down — reconnecting in ${wait} s`, variant: "warning" }, wait * 1000);
          setTimeout(() => {
            if (!disposed && !joinedRef.current) onConnect();
          }, wait * 1000);
          return;
        }
        if (!result.ok) {
          setStatus(result.error === "in_other_tab" ? { kind: "other-tab" } : { kind: "failed", error: result.error });
          return;
        }
        joinedRef.current = true;
        if (result.status === "waiting") {
          setStatus({ kind: "waiting" });
          return;
        }
        enterAdmitted(result);
      });
    }

    joinNowRef.current = onConnect;
    socket.on("connect", onConnect);
    socket.on("moved", () => {
      joinedRef.current = false;
      stopScreen();
      cleanupMedia();
      setStatus({ kind: "failed", error: "moved" });
    });
    if (socket.connected) onConnect();
    // `active` = connect already in flight; a second connect() sends another CONNECT packet and the
    // server creates a second socket for this tab (a duplicate "you" for everyone else).
    else if (!socket.active) socket.connect();

    socket.on("peer:joined", (peer: Peer) => addPeerConnection(peer, false));
    socket.on("peer:left", (id: string) => dropPeer(id));
    socket.on("peer:state", (id: string, state: MediaState) => patchPeerState(id, state));
    socket.on("signal", (from: string, data) => {
      const pc = pcs.current.get(from);
      if (pc) void handleSignal(pc, data);
    });
    socket.on("waiting:update", (list: Peer[]) => setWaiting(list));
    socket.on("admitted", (result) => enterAdmitted(result));
    socket.on("denied", () => setStatus({ kind: "failed", error: "denied" }));
    socket.on("kicked", () => {
      stopScreen();
      cleanupMedia();
      setStatus({ kind: "failed", error: "kicked" });
    });
    const onHostMuted = () => setMedia({ mic: false });
    socket.on("host:muted", onHostMuted);
    const onShareStop = () => void stopShare(); // takeover or host; Call.tsx toasts
    socket.on("share:stop", onShareStop);
    socket.on("room:locked", (v: boolean) => setLocked(v));
    // Limiter feedback (spec 002 design §2 "In call"): dropped `state` is silent, host actions toast.
    const onRateLimited = (event: string) => {
      if (event.startsWith("host:")) notify("rate-limited", { title: "Slow down — too many host actions", variant: "warning" });
    };
    socket.on("rate_limited", onRateLimited);
    const onDisconnect = (reason: string) => {
      if (reason === "io server disconnect") {
        notify("strike", { title: "Connection paused for flooding the server. Reload to rejoin.", variant: "danger" }, 15_000);
      }
    };
    socket.on("disconnect", onDisconnect);
    const onConnectError = (err: Error) => {
      if (err.message !== "rate_limited") return;
      notify("rate-limited", { title: "Slow down — reconnecting in 30 s", variant: "warning" }, 30_000);
      setTimeout(() => {
        if (!disposed && !socket.active) socket.connect();
      }, 30_000);
    };
    socket.on("connect_error", onConnectError);
    socket.on("room:ended", () => {
      stopScreen();
      cleanupMedia();
      setStatus({ kind: "failed", error: "ended" });
    });

    return () => {
      disposed = true;
      socket.off("connect", onConnect);
      socket.off("peer:joined");
      socket.off("peer:left");
      socket.off("peer:state");
      socket.off("signal");
      socket.off("waiting:update");
      socket.off("admitted");
      socket.off("denied");
      socket.off("kicked");
      socket.off("moved");
      joinNowRef.current = null;
      socket.off("host:muted", onHostMuted); // by ref: Call.tsx has its own toast listener
      socket.off("share:stop", onShareStop);
      socket.off("room:locked");
      socket.off("rate_limited", onRateLimited);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("room:ended");
      if (joinedRef.current) socket.emit("room:leave");
      // Dev strict mode re-runs this effect at once; stopping then would kill a share-only join's capture.
      liveRef.current = false;
      setTimeout(() => {
        if (!liveRef.current) stopLocal();
      }, 0);
      cleanupMedia();
    };
  }, [code, joinToken, addPeerConnection, dropPeer, patchPeerState, setMedia, stopShare]);

  useEffect(() => {
    const detector = createSpeakerDetector();
    const follow = createAutoFollow((id) => setFollowedId(id));
    detectorRef.current = detector;
    followRef.current = follow;
    const off = detector.onSpeaking((id) => {
      setSpeakingId(id);
      follow.push(id);
    });
    const stop = detector.start();
    return () => {
      off();
      stop();
      follow.cancel();
      detectorRef.current = null;
      followRef.current = null;
      detectorStreams.current.clear(); // the next detector starts empty (StrictMode remount)
    };
  }, []);

  useEffect(() => {
    const detector = detectorRef.current;
    if (!detector) return;
    const seen = new Set<string>();
    if (localStream) {
      seen.add("local");
      if (detectorStreams.current.get("local") !== localStream || localMicRef.current !== micTrackId) {
        detector.remove("local");
        detector.add("local", localStream);
        detectorStreams.current.set("local", localStream);
        localMicRef.current = micTrackId;
      }
    }
    for (const [id, peer] of peers) {
      if (!peer.stream) continue;
      seen.add(id);
      if (detectorStreams.current.get(id) !== peer.stream) {
        detector.remove(id);
        detector.add(id, peer.stream);
        detectorStreams.current.set(id, peer.stream);
      }
    }
    for (const id of [...detectorStreams.current.keys()]) {
      if (!seen.has(id)) {
        detector.remove(id);
        detectorStreams.current.delete(id);
      }
    }
  }, [peers, localStream, micTrackId]);

  const presenterId = [...peers.values()].find((p) => p.info.state.screen)?.info.id ?? null;

  const togglePin = useCallback((id: string) => {
    setPinnedId((prev) => (prev === id ? null : id));
  }, []);

  return {
    status,
    peers,
    waiting,
    locked,
    canAdmit,
    isHost,
    localState,
    localStream,
    /** Changes when the camera is released or reopened: remount the local preview so it shows the new track. */
    camTrackId,
    /** Our own presentation (preview only; never played with sound). */
    localScreen,
    /** Remote peer currently presenting (one at a time, spec 007 FR6). */
    presenterId,
    maxPeers: MAX_PEERS,
    pinnedId,
    speakingId,
    followedId,
    togglePin,
    setMedia,
    startShare,
    stopShare,
    switchDevice,
    admit: (id: string) => getSocket().emit("host:admit", id),
    deny: (id: string) => getSocket().emit("host:deny", id),
    mute: (id: string) => getSocket().emit("host:mute", id),
    kick: (id: string) => getSocket().emit("host:kick", id),
    stopPeerShare: (id: string) => getSocket().emit("host:stop-share", id),
    setLock: (v: boolean) => getSocket().emit("host:lock", v),
    endMeeting: () => getSocket().emit("host:end"),
    leave: () => getSocket().emit("room:leave"),
    /** Answer to `other-tab`: "switch" takes the call over here, "also" keeps both sessions. */
    joinHere: (here: "switch" | "also") => {
      hereRef.current = here;
      setStatus({ kind: "joining" });
      joinNowRef.current?.();
    },
  };
}
