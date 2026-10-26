"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, Spinner, useOverlayState } from "@heroui/react";
import { Copy, Share2 } from "lucide-react";
import { useEndRoom, useRoom } from "@/hooks/use-rooms";
import { getSocket } from "@/lib/socket.io/client";
import type { JoinError, MediaState } from "@/lib/socket.io/events";
import { getPrefs, setPrefs } from "@/lib/utils/prefs";
import { notify } from "@/lib/toast";
import {
  listDevices,
  onDeviceChange,
  setSpeaker,
  type DeviceInfo,
} from "@/lib/webrtc/devices";
import { errorCopy } from "@/lib/utils/error-copy";
import { useCall } from "@/hooks/use-call";
import { useRecorder } from "@/hooks/use-recorder";
import RoomStatus from "@/components/call/RoomStatus";
import WaitingRoom from "@/components/call/WaitingRoom";
import AdmitBanner from "@/components/call/AdmitBanner";
import MeetingChip from "@/components/call/MeetingChip";
import ShortcutsSheet from "@/components/call/ShortcutsSheet";
import { LocalPreview, PersonAvatar, SpeakingRing, VideoGrid } from "@/components/call/VideoTile";
import { useSession } from "@/lib/better-auth/client";
import Toolbar from "@/components/call/Toolbar";
import PresentingBanner from "@/components/call/PresentingBanner";
import ParticipantsDrawer from "@/components/call/ParticipantsDrawer";

function statusCopy(
  error: JoinError | "denied" | "kicked" | "moved",
): { title: string; body?: string; action: string } {
  switch (error) {
    case "denied":
      return { title: "You weren't admitted.", action: "Back" };
    case "moved":
      return { title: "You switched to another tab or device.", action: "Rejoin here" };
    case "kicked":
      return { title: "You were removed by the host.", action: "Back" };
    case "room_full":
      return { title: "Room is full (10/10). Try again in a moment.", action: "Try again" };
    case "locked":
      return { title: "This room is locked by the host.", action: "Try again" };
    case "expired":
      return { title: "This room has expired.", action: "Back to home" };
    case "ended":
      return { title: "Meeting ended.", action: "Back to home" };
    case "guests_not_allowed":
      return { title: "This room doesn't allow guests — sign in to join.", action: "Sign in" };
    default:
      return { title: "Room not found. Check the code or ask for a new link.", action: "Back to home" };
  }
}

export default function Call({
  code,
  joinToken,
  initialStream,
  initialState,
  initialScreen,
  onLeft,
}: {
  code: string;
  joinToken: string | null;
  initialStream: MediaStream | null;
  initialState: MediaState;
  initialScreen?: MediaStream | null;
  onLeft: () => void;
}) {
  const [stream] = useState<MediaStream | null>(initialStream);
  const [mediaBlocked] = useState(initialStream === null);
  const drawer = useOverlayState();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const roomInfo = useRoom(code);
  const endRoom = useEndRoom();

  function copyLink() {
    return navigator.clipboard
      .writeText(`${window.location.origin}/rooms/${code}`)
      .then(() => notify("copy-link", { title: "Link copied", variant: "success" }))
      .catch(() => undefined);
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [micId, setMicId] = useState<string | null>(getPrefs().micId);
  const [camId, setCamId] = useState<string | null>(getPrefs().camId);
  const [speakerId, setSpeakerIdState] = useState<string | null>(getPrefs().speakerId);
  const sinkSupported =
    typeof HTMLMediaElement !== "undefined" &&
    typeof (HTMLVideoElement.prototype as { setSinkId?: unknown }).setSinkId === "function";

  const { data: session } = useSession();
  const call = useCall({
    code,
    joinToken,
    initialStream,
    initialState,
    initialScreen,
  });
  const { setMedia } = call;
  const callRef = useRef<HTMLElement>(null);
  const peerKey = [...call.peers.values()].filter((p) => !p.info.isGuest).map((p) => p.info.userId).sort().join(",");
  const peerUserIds = useMemo(() => (peerKey ? peerKey.split(",") : []), [peerKey]); // stable across media-only re-renders
  const recorder = useRecorder({
    code,
    roomName: roomInfo.data?.name,
    root: useCallback(() => callRef.current, []),
    onChange: useCallback((recording: boolean) => setMedia({ recording }), [setMedia]),
    peerUserIds,
  });
  const [recordOpen, setRecordOpen] = useState(false);
  const isGuest = (session?.user as { isAnonymous?: boolean } | undefined)?.isAnonymous ?? true;
  // Silent composite: needs MediaRecorder + canvas.captureStream (phones included).
  const canRecord = !isGuest && typeof MediaRecorder !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
  const toggleRecord = () => (recorder.recording ? void recorder.stop() : setRecordOpen((o) => !o));

  async function pickDevice(kind: "audio" | "video" | "speaker", deviceId: string) {
    if (kind === "speaker") {
      setPrefs({ speakerId: deviceId });
      setSpeakerIdState(deviceId);
      document.querySelectorAll("video").forEach((el) => setSpeaker(el, deviceId));
      return;
    }
    const ok = await call.switchDevice(kind, deviceId);
    if (ok) {
      if (kind === "audio") {
        setPrefs({ micId: deviceId });
        setMicId(deviceId);
      } else {
        setPrefs({ camId: deviceId });
        setCamId(deviceId);
      }
      void listDevices().then(setDevices);
    } else {
      notify("switch-failed", { title: `Couldn't switch to that device`, variant: "warning" });
    }
  }

  useEffect(() => {
    let live = true;
    void listDevices().then((list) => {
      if (live) setDevices(list);
    });
    const off = onDeviceChange(() => {
      void listDevices().then(async (list) => {
        if (!live) return;
        setDevices(list);
        const audioGone = micId && !list.some((d) => d.kind === "audioinput" && d.deviceId === micId);
        const videoGone = camId && !list.some((d) => d.kind === "videoinput" && d.deviceId === camId);
        if (audioGone || videoGone) {
          notify("device-gone", { title: "Device unplugged, switched to default", variant: "warning" });
          if (audioGone) {
            const fallback = list.find((d) => d.kind === "audioinput")?.deviceId;
            if (fallback) await pickDevice("audio", fallback);
          }
          if (videoGone) {
            const fallback = list.find((d) => d.kind === "videoinput")?.deviceId;
            if (fallback) await pickDevice("video", fallback);
          }
        }
      });
    });
    return () => {
      live = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.isComposing || (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case "m":
          call.setMedia({ mic: !call.localState.mic });
          break;
        case "v":
          call.setMedia({ cam: !call.localState.cam });
          break;
        case "s":
          void (call.localState.screen ? call.stopShare() : call.startShare());
          break;
        case "p":
          drawer.open();
          break;
        case "c":
          void copyLink();
          break;
        case "l":
          if (call.isHost) call.setLock(!call.locked);
          break;
        case "r":
          if (canRecord) toggleRecord();
          break;
        case "?":
          setShortcutsOpen(true);
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.localState.mic, call.localState.cam, call.localState.screen, call.isHost, call.locked, canRecord, recorder.recording]);

  const prevPeers = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set(call.peers.keys());
    for (const id of ids) {
      if (!prevPeers.current.has(id)) {
        const name = call.peers.get(id)?.info.name ?? "Someone";
        notify(`join-${id}`, { title: `${name} joined`, variant: "default" });
      }
    }
    for (const id of prevPeers.current) {
      if (!ids.has(id)) notify(`leave-${id}`, { title: "Left the meeting", variant: "default" });
    }
    prevPeers.current = ids;
  }, [call.peers]);

  const prevRecording = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set([...call.peers.values()].filter((p) => p.info.state.recording).map((p) => p.info.id));
    for (const id of now) {
      if (!prevRecording.current.has(id)) {
        notify(`rec-${id}`, { title: `${call.peers.get(id)?.info.name ?? "Someone"} started recording`, variant: "warning" });
      }
    }
    for (const id of prevRecording.current) {
      if (!now.has(id) && call.peers.has(id)) {
        notify(`rec-${id}`, { title: `${call.peers.get(id)?.info.name ?? "Someone"} stopped recording`, variant: "default" });
      }
    }
    prevRecording.current = now;
  }, [call.peers]);

  const prevWaiting = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const w of call.waiting) {
      if (!prevWaiting.current.has(w.id) && call.canAdmit) {
        notify(`waiting-${w.id}`, { title: `${w.name} wants to join`, variant: "accent" });
      }
    }
    prevWaiting.current = new Set(call.waiting.map((w) => w.id));
  }, [call.waiting, call.canAdmit]);

  useEffect(() => {
    if (call.status.kind === "failed") {
      void recorder.stop(); // ended / kicked / moved: save what we have
      stream?.getTracks().forEach((t) => t.stop());
      if (call.status.error !== "denied" && call.status.error !== "kicked" && call.status.error !== "moved" && call.status.error !== "ended") {
        notify("call-error", { title: errorCopy(call.status.error), variant: "danger" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.status]);

  useEffect(() => {
    const socket = getSocket();
    const onMuted = () => notify("muted-by-host", { title: "Muted by host", variant: "warning" });
    socket.on("host:muted", onMuted);
    const onShareStop = (reason: "takeover" | "host") =>
      reason === "host"
        ? notify("share-stopped", { title: "The host stopped your presentation", variant: "warning" })
        : notify("share-stopped", { title: "Someone else is presenting now", variant: "default" });
    socket.on("share:stop", onShareStop);
    return () => {
      socket.off("host:muted", onMuted);
      socket.off("share:stop", onShareStop);
    };
  }, []);

  if (call.status.kind === "joining") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-4 text-foreground">
        <div className="w-full max-w-xl overflow-hidden rounded-card">
          <LocalPreview key={call.camTrackId ?? "off"} stream={stream} />
        </div>
        {/* Connecting can take a few seconds on mobile networks: say so instead of a frozen preview. */}
        <p role="status" className="flex items-center gap-2 text-muted">
          <Spinner size="sm" color="current" />
          Joining…
        </p>
      </main>
    );
  }

  if (call.status.kind === "other-tab") {
    return (
      <main className="flex flex-1 items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md rounded-card border border-hairline p-0 shadow-none">
          <CardContent className="flex flex-col gap-3 p-6 text-center">
            <h1 className="text-xl font-semibold">You&apos;re already in this call</h1>
            <p className="text-sm text-muted">You joined from another tab or device.</p>
            <Button variant="primary" onPress={() => call.joinHere("switch")}>
              Switch here
            </Button>
            <Button variant="secondary" onPress={() => call.joinHere("also")}>
              Join here too
            </Button>
            <Link href="/" className="text-sm text-muted text-link">
              Back to home
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (call.status.kind === "waiting") {
    return (
      <WaitingRoom
        stream={stream}
        state={call.localState}
        onToggle={(patch) => call.setMedia(patch)}
        onLeave={() => {
          call.leave();
          onLeft();
        }}
      />
    );
  }

  if (call.status.kind === "failed") {
    const copy = statusCopy(call.status.error);
    const back = copy.action === "Back to home" || copy.action === "Back" ? "/" : undefined;
    return (
      <RoomStatus
        title={copy.title}
        body={copy.body}
        actionLabel={copy.action}
        actionHref={back ?? (copy.action === "Sign in" ? "/sign-in" : undefined)}
        onAction={back || copy.action === "Sign in" ? undefined : () => window.location.reload()}
        redirectHomeIn={call.status.error === "ended" ? 5 : undefined}
      />
    );
  }

  const remotes = [...call.peers.values()];
  const participants = (nested: boolean) => (
    <ParticipantsDrawer
      nested={nested}
      state={drawer}
      waiting={call.waiting}
      peers={remotes}
      self={{ name: session?.user.name || "You", image: session?.user.image ?? null }}
      canAdmit={call.canAdmit}
      isHost={call.isHost}
      maxPeers={call.maxPeers}
      onAdmit={(id) => call.admit(id)}
      onDeny={(id) => call.deny(id)}
      onMute={(id) => call.mute(id)}
      onRemove={(id) => call.kick(id)}
      onStopShare={(id) => call.stopPeerShare(id)}
      pinnedId={call.pinnedId}
      onPin={(id) => call.togglePin(id)}
    />
  );
  const shareSupported =
    typeof navigator !== "undefined" &&
    typeof (navigator.mediaDevices as { getDisplayMedia?: unknown } | undefined)?.getDisplayMedia ===
      "function";

  return (
    <main ref={callRef} className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground">
      {call.canAdmit ? (
        <AdmitBanner
          waiting={call.waiting}
          onAdmit={(id) => call.admit(id)}
          onDeny={(id) => call.deny(id)}
          onAdmitAll={() => call.waiting.forEach((w) => call.admit(w.id))}
          onView={() => drawer.open()}
        />
      ) : null}
      <header className="absolute inset-x-3 top-[max(env(safe-area-inset-top),0.75rem)] z-20 flex items-center gap-2">
        <MeetingChip
          code={code}
          expiresAt={roomInfo.data?.expiresAt ?? null}
          count={remotes.length + 1}
          max={call.maxPeers}
        />
        {call.locked ? <span className="glass rounded-full px-3 py-1.5 text-sm text-warning">locked</span> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-[calc(env(safe-area-inset-top)+3.75rem)] sm:px-4">
        {mediaBlocked ? (
          <p role="alert" className="glass self-center rounded-full px-4 py-2 text-sm text-warning">
            Camera or microphone blocked. Allow access in your browser and reload.
          </p>
        ) : null}
        {call.localState.screen && remotes.length === 0 ? (
          <PresentingBanner stream={call.localScreen} onStop={() => void call.stopShare()} />
        ) : null}
        {remotes.length === 0 ? (
          // Meet-style empty state: the link itself, one tap to copy, one to share.
          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-2">
              <p className="text-[21px] font-semibold">You&apos;re the only one here</p>
              <p className="text-muted">Share this meeting link with others you want in the meeting.</p>
              <div className="flex items-center gap-2 rounded-full bg-surface-secondary py-1 pl-4 pr-1">
                <span className="min-w-0 flex-1 truncate text-sm" suppressHydrationWarning>
                  {typeof window !== "undefined" ? window.location.host : ""}/rooms/{code}
                </span>
                <Button isIconOnly variant="ghost" className="size-11" aria-label="Copy meeting link" onPress={() => void copyLink()}>
                  <Copy size={18} />
                </Button>
              </div>
              <Button
                variant="secondary"
                className="self-start"
                onPress={() =>
                  "share" in navigator
                    ? void navigator.share({ url: `${window.location.origin}/rooms/${code}` }).catch(() => undefined)
                    : void copyLink()
                }
              >
                <Share2 size={18} /> Share invite
              </Button>
            </div>
          </div>
        ) : (
          <VideoGrid
            peers={remotes}
            presenterId={call.presenterId}
            pinnedId={call.pinnedId}
            speakingId={call.speakingId ?? undefined}
            followedId={call.followedId}
            onPin={(id) => call.togglePin(id)}
            localScreen={call.localState.screen ? call.localScreen : null}
            onStopShare={() => void call.stopShare()}
          />
        )}
      </div>
      {/* Self-view floats like FaceTime's PiP so the people you're talking to get the screen. */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-3 z-20 w-28 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-product sm:w-56">
        <LocalPreview key={call.camTrackId ?? "off"} stream={stream} />
        {!call.localState.cam ? <PersonAvatar seed={session?.user.id ?? "you"} name={session?.user.name || "You"} image={session?.user.image} size={80} /> : null}
        <p className="absolute bottom-1 left-2 text-xs font-semibold text-white drop-shadow">You</p>
        {call.speakingId === "local" && call.localState.mic ? <SpeakingRing /> : null}
      </div>
      <div className="absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-30 flex justify-center px-2">
      <Toolbar
        code={code}
        state={call.localState}
        onToggle={(patch) => call.setMedia(patch)}
        onShare={() => void (call.localState.screen ? call.stopShare() : call.startShare())}
        sharing={call.localState.screen}
        shareSupported={shareSupported}
        waitingCount={call.waiting.length}
        canAdmit={call.canAdmit}
        onParticipants={() => drawer.open()}
        onLeave={() => {
          call.leave();
          onLeft();
        }}
        isHost={call.isHost}
        locked={call.locked}
        onLock={(v) => call.setLock(v)}
        onEnd={() => endRoom.mutate(code, { onSettled: () => call.endMeeting() })}
        devices={devices}
        micId={micId}
        camId={camId}
        speakerId={speakerId}
        showSpeaker={sinkSupported}
        onPickDevice={(kind, id) => void pickDevice(kind, id)}
        compact={narrow}
        onCopyLink={() => void copyLink()}
        moreSheet={narrow ? { node: participants(true), open: drawer.isOpen } : undefined}
        record={
          canRecord
            ? {
                startedAt: recorder.startedAt,
                saving: recorder.saving,
                onPress: toggleRecord,
                open: recordOpen,
                onOpenChange: setRecordOpen,
                onStart: (opts) => {
                  setRecordOpen(false);
                  void recorder.start(opts);
                },
              }
            : undefined
        }
      />
      </div>
      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {narrow ? null : participants(false)}
    </main>
  );
}
