"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button, Spinner, useOverlayState } from "@heroui/react";
import DeviceDrawer from "@/components/call/DeviceDrawer";
import MeetingLength, { type LengthValue } from "@/components/call/MeetingLength";
import SelectField from "@/components/ui/SelectField";
import OptionSheet from "@/components/ui/OptionSheet";
import { usePresence } from "@/hooks/use-presence";
import { presenceLabel } from "@/lib/utils/presence";
import TextInput from "@/components/ui/TextInput";
import { ArrowLeft, Copy, EllipsisVertical, Link2, Mic, MicOff, Share2, Video, VideoOff, Volume2 } from "lucide-react";
import type { MediaState } from "@/lib/socket.io/events";
import { usePrejoin } from "@/lib/webrtc/use-prejoin";
import { getDisplayStream } from "@/lib/webrtc/screen";
import { PersonAvatar } from "@/components/call/VideoTile";
import { authClient, useSession } from "@/lib/better-auth/client";
import { toApiError } from "@/lib/hono/client";
import { errorCopy } from "@/lib/utils/error-copy";

// react-aria keys can't be empty, so "browser default" gets a sentinel id
const SYSTEM = "system-default";
const deviceOptions = (list: { deviceId: string; label: string }[]) => [
  { id: SYSTEM, label: "Default" },
  ...list.filter((d) => d.deviceId && d.deviceId !== "default").map((d) => ({ id: d.deviceId, label: d.label || d.deviceId })),
];
/** Saved id may be "" (picked Default) or a device that is gone / not listed yet (no permission): show Default. */
const deviceValue = (id: string | null | undefined, opts: { id: string }[]) =>
  opts.some((o) => o.id === id) ? (id as string) : SYSTEM;

export type JoinArgs = { stream: MediaStream | null; state: MediaState; screen?: MediaStream | null };

type JoinMode = "av" | "audio" | "video" | "none" | "share";
const JOIN_MODES: { id: JoinMode; label: string }[] = [
  { id: "av", label: "Audio + video" },
  { id: "audio", label: "Audio only (turn video on anytime)" },
  { id: "video", label: "Video only (turn mic on anytime)" },
  { id: "none", label: "Mic and camera off" },
  { id: "share", label: "Screen share only" },
];
// [mic, cam] each mode starts with; the toolbar can change them after joining
const MODE_MEDIA: Record<JoinMode, [boolean, boolean]> = {
  av: [true, true],
  audio: [true, false],
  video: [false, true],
  none: [false, false],
  share: [false, false],
};
const modeOf = (mic: boolean, cam: boolean): JoinMode =>
  mic && cam ? "av" : mic ? "audio" : cam ? "video" : "none";

function LevelMeter({ level }: { level: number }) {
  const bars = [0.2, 0.4, 0.6, 0.8, 1];
  return (
    <div className="flex items-end gap-0.5" aria-label={`Microphone level ${Math.round(level * 100)} percent`}>
      {bars.map((b) => (
        <span
          key={b}
          className={`w-1 rounded-full ${level >= b ? "bg-success" : "bg-white/30"}`}
          style={{ height: `${6 + b * 14}px` }}
        />
      ))}
    </div>
  );
}

// Phone layout swaps blocks (not just styles), so each text exists once in the page.
const PHONE = "(max-width: 639px)";
const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const usePhone = () => useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);

export default function PreJoin({
  roomName,
  code,
  isGuest,
  askToJoin,
  onJoin,
  onSignIn,
  length,
}: {
  roomName: string;
  code: string;
  isGuest: boolean;
  askToJoin: boolean;
  onJoin: (args: JoinArgs) => void | Promise<void>;
  onSignIn: () => void;
  /** New instant meeting only: how long it lasts once created. */
  length?: { value: LengthValue; onChange: (v: LengthValue) => void };
}) {
  const pre = usePrejoin();
  const { data: session } = useSession();
  const peek = usePresence(code || null);
  const [name, setName] = useState(pre.prefs.guestName);
  const [error, setError] = useState<string | null>(null);
  const [shareOnly, setShareOnly] = useState(false);
  const [joining, setJoining] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
  const mode: JoinMode = shareOnly ? "share" : modeOf(pre.prefs.mic, pre.prefs.cam);

  function pickMode(next: JoinMode) {
    setShareOnly(next === "share");
    const [mic, cam] = MODE_MEDIA[next];
    pre.setMic(mic);
    pre.setCam(cam);
  }
  const joinRef = useRef<HTMLButtonElement>(null);

  // Deps are the stream + stable callback, not `pre`: the mic level re-renders 10×/s and re-setting
  // srcObject restarts the video (visible flicker whenever the mic is on).
  const { stream: preStream, previewSpeaker } = pre;
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== preStream) el.srcObject = preStream;
    previewSpeaker(el);
  }, [preStream, previewSpeaker]);

  useEffect(() => {
    if (pre.ready) joinRef.current?.focus(); // disabled (unfocusable) until media is ready
  }, [pre.ready]);

  async function join() {
    setError(null);
    // Ask for the screen first: browsers only allow it right after the click.
    let screen: MediaStream | null = null;
    if (shareOnly) {
      screen = await getDisplayStream(navigator.mediaDevices); // + tab audio where offered (spec 007)
      if (!screen?.getVideoTracks()[0]) {
        setError("Screen sharing was cancelled. Pick a screen or choose another way to join.");
        return;
      }
    }
    if (isGuest && !name.trim()) {
      setError("Enter your name to join.");
      return;
    }
    try {
      if (isGuest && name.trim() !== pre.prefs.guestName) {
        await authClient.updateUser({ name: name.trim() });
      }
    } catch (e) {
      setError(errorCopy(toApiError(e).code));
      return;
    }
    setJoining(true);
    try {
      const base = pre.join();
      await onJoin(screen ? { ...base, state: { ...base.state, screen: true }, screen } : base);
    } catch (e) {
      setError(errorCopy(toApiError(e).code));
      setJoining(false); // success unmounts PreJoin, so only reset on failure
      pre.joinFailed();
    }
  }

  const mics = pre.devices.filter((d) => d.kind === "audioinput");
  const cams = pre.devices.filter((d) => d.kind === "videoinput");
  const speakers = pre.devices.filter((d) => d.kind === "audiooutput");
  const displayName = (isGuest ? name.trim() : session?.user.name) || "You";
  const sinkSupported =
    typeof HTMLMediaElement !== "undefined" &&
    typeof (HTMLVideoElement.prototype as { setSinkId?: unknown }).setSinkId === "function";

  const phone = usePhone();
  const deviceSheet = useOverlayState();
  const link = code && typeof window !== "undefined" ? `${window.location.origin}/rooms/${code}` : "";
  async function copyLink() {
    await navigator.clipboard.writeText(link).catch(() => undefined);
  }

  return (
    <main className="mx-auto grid flex-1 w-full max-w-6xl grid-cols-[minmax(0,1fr)] content-start items-center gap-6 px-4 pb-10 pt-[max(env(safe-area-inset-top),1rem)] max-sm:grid-rows-[auto_auto_1fr] max-sm:gap-4 max-sm:pb-0 lg:grid-cols-[minmax(0,1fr)_22rem] lg:content-center lg:gap-12 lg:px-8">
      {/* Phones, Meet-style: back arrow + meeting name on top, a portrait preview, then a bottom sheet. */}
      {phone ? (
        <header className="flex items-center gap-1 pr-12">
          <Link href="/" aria-label="Back to home" className="flex size-11 shrink-0 items-center justify-center rounded-full">
            <ArrowLeft size={22} />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-[21px] font-semibold">{roomName}</h1>
            <p role="status" className="text-sm text-muted">
              {peek ? presenceLabel(peek) : "Ready to join?"}
            </p>
          </div>
          <Button isIconOnly variant="ghost" className="size-11" aria-label="Audio and video settings" onPress={deviceSheet.open}>
            <EllipsisVertical size={22} />
          </Button>
          <DeviceDrawer
            state={deviceSheet}
            sections={[
              { title: "Microphone", kind: "audio", devices: mics, activeId: pre.prefs.micId },
              ...(sinkSupported
                ? [{ title: "Speaker", kind: "speaker" as const, devices: speakers, activeId: pre.prefs.speakerId }]
                : []),
              { title: "Camera", kind: "video", devices: cams, activeId: pre.prefs.camId },
            ]}
            onPick={(kind, id) => void pre.selectDevice(kind, id)}
          />
        </header>
      ) : null}
      {/* Left (top on phones): preview + device pills, like Meet. */}
      <section className="flex min-w-0 flex-col gap-3">
        <div className="dark relative mx-auto aspect-[3/4] w-[72%] max-w-xs overflow-hidden rounded-[2rem] bg-surface shadow-product sm:aspect-video sm:w-full sm:max-w-none sm:rounded-card">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Your camera preview"
            className={`h-full w-full object-cover [transform:scaleX(-1)] ${pre.prefs.cam ? "" : "invisible"}`}
          />
          {/* Camera off: always the mascot here (not the profile photo), even before media settles. */}
          {!pre.prefs.cam ? (
            <PersonAvatar seed={session?.user.id ?? "you"} name={displayName} />
          ) : !pre.ready ? (
            <p className="absolute inset-0 flex items-center justify-center text-[21px] text-white/90">Camera is starting</p>
          ) : null}
          <p
            className={`absolute font-semibold text-white drop-shadow ${phone ? "inset-x-0 bottom-1 text-center text-[13px]" : "left-4 top-3 text-[15px]"}`}
          >
            {displayName}
          </p>
          {pre.prefs.mic ? (
            <div className="glass absolute right-3 top-3 flex h-10 items-center rounded-full px-3 sm:right-auto sm:top-auto sm:bottom-4 sm:left-4">
              <LevelMeter level={pre.level} />
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-4">
            <Button
              isIconOnly
              variant={pre.prefs.mic ? "ghost" : "danger"}
              className={`size-14 text-white ${pre.prefs.mic ? "glass" : ""}`}
              aria-label={pre.prefs.mic ? "Mute microphone" : "Unmute microphone"}
              aria-pressed={pre.prefs.mic}
              onPress={() => pre.setMic(!pre.prefs.mic)}
            >
              {pre.prefs.mic ? <Mic size={22} /> : <MicOff size={22} />}
            </Button>
            <Button
              isIconOnly
              variant={pre.prefs.cam ? "ghost" : "danger"}
              className={`size-14 text-white ${pre.prefs.cam ? "glass" : ""}`}
              aria-label={pre.prefs.cam ? "Turn camera off" : "Turn camera on"}
              aria-pressed={pre.prefs.cam}
              onPress={() => pre.setCam(!pre.prefs.cam)}
            >
              {pre.prefs.cam ? <Video size={22} /> : <VideoOff size={22} />}
            </Button>
          </div>
        </div>
        {/* Device pills: one row from sm up; phones pick devices from the header's ⋯ sheet. */}
        <div className={phone ? "hidden" : "grid grid-cols-3 gap-2"}>
          <SelectField
            label="Microphone"
            hideLabel
            icon={<Mic size={16} />}
            value={deviceValue(pre.prefs.micId, deviceOptions(mics))}
            options={deviceOptions(mics)}
            onChange={(id) => void pre.selectDevice("audio", id === SYSTEM ? "" : id)}
          />
          {sinkSupported ? (
            <SelectField
              label="Speaker"
              hideLabel
              icon={<Volume2 size={16} />}
                value={deviceValue(pre.prefs.speakerId, deviceOptions(speakers))}
              options={deviceOptions(speakers)}
              onChange={(id) => void pre.selectDevice("speaker", id === SYSTEM ? "" : id)}
            />
          ) : null}
          <SelectField
            label="Camera"
            hideLabel
            icon={<Video size={16} />}
            value={deviceValue(pre.prefs.camId, deviceOptions(cams))}
            options={deviceOptions(cams)}
            onChange={(id) => void pre.selectDevice("video", id === SYSTEM ? "" : id)}
          />
        </div>
        {pre.error ? (
          <p role="alert" className="text-sm text-warning">
            {pre.error} You can still join.
          </p>
        ) : null}
      </section>

      {/* Right (a bottom sheet on phones): one clear action, Meet-style. */}
      <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 text-center max-sm:-mx-4 max-sm:self-stretch max-sm:w-auto max-sm:max-w-none max-sm:rounded-t-[2rem] max-sm:glass max-sm:px-5 max-sm:pt-3 max-sm:pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {phone ? (
          <span aria-hidden className="h-1 w-10 rounded-full bg-muted/40" />
        ) : (
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] leading-[1.14] font-semibold break-words sm:text-[34px]">{roomName}</h1>
            <p className="text-[17px] text-muted">Ready to join?</p>
            {peek ? (
              <p role="status" className="text-[15px] text-muted">
                {presenceLabel(peek)}
              </p>
            ) : null}
          </div>
        )}
        {isGuest ? (
          <div className="w-full text-left">
            <TextInput label="Your name" value={name} onChange={setName} placeholder="Dana" />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button
          ref={joinRef}
          variant="primary"
          size="lg"
          className={`w-full ${phone ? "h-16 rounded-full text-[21px]" : "h-14 text-[17px]"}`}
          isDisabled={!pre.ready}
          isPending={joining}
          onPress={() => void join()}
        >
          {joining ? (
            <>
              <Spinner size="sm" color="current" />
              Joining…
            </>
          ) : (
            <>
              {phone ? <Video size={22} aria-hidden /> : null}
              {askToJoin ? "Ask to join" : "Join now"}
            </>
          )}
        </Button>
        <div className="flex w-full flex-col gap-3 text-left">
          {/* Phones pick from bottom drawers (like the device sheet); desktop keeps dropdowns. */}
          {phone ? (
            <OptionSheet
              label="Join with"
              value={mode}
              options={JOIN_MODES.filter((m) => m.id !== "share" || canShare)}
              onChange={(id) => pickMode(id as JoinMode)}
            />
          ) : (
            <SelectField
              label="Join with"
              value={mode}
              options={JOIN_MODES.filter((m) => m.id !== "share" || canShare)}
              onChange={(id) => pickMode(id as JoinMode)}
            />
          )}
          {length ? <MeetingLength value={length.value} onChange={length.onChange} phone={phone} /> : null}
        </div>
        {isGuest ? (
          <Button variant="secondary" className="w-full" onPress={onSignIn}>
            Sign in instead
          </Button>
        ) : null}
        {link && phone ? (
          <div className="flex w-full flex-col gap-2 text-left">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Joining information</h2>
              {"share" in navigator ? (
                <Button
                  isIconOnly
                  variant="ghost"
                  className="size-11"
                  aria-label="Share invite"
                  onPress={() => void navigator.share({ url: link }).catch(() => undefined)}
                >
                  <Share2 size={18} />
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-3 rounded-3xl bg-surface-secondary py-3 pl-4 pr-2">
              <Link2 size={20} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Meeting link</p>
                <p className="truncate text-sm text-muted">{link.replace(/^https?:\/\//, "")}</p>
              </div>
              <Button isIconOnly variant="ghost" className="size-11" aria-label="Copy meeting link" onPress={() => void copyLink()}>
                <Copy size={18} />
              </Button>
            </div>
          </div>
        ) : null}
        {phone ? null : (
          <Link href="/" className="text-[17px] text-link">
            Back to home
          </Link>
        )}
      </section>
    </main>
  );
}
