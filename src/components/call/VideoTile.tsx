"use client";
import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage, Button, Chip } from "@heroui/react";
import { Crown, MicOff, MonitorUp, Pin, PinOff, VideoOff } from "lucide-react";
import { Mascot } from "page-mascot";
import type { RemotePeer } from "@/hooks/use-call";
import { layoutTiles, tileId, type TileKey } from "@/lib/webrtc/screen";
import PresentingBanner from "@/components/call/PresentingBanner";
import { setSpeaker } from "@/lib/webrtc/devices";
import { getPrefs } from "@/lib/utils/prefs";
import { initials } from "@/lib/utils/initials";
import Tip from "@/components/ui/Tip";

/** Speaking highlight: its own top layer, so the avatar overlay can't paint over it. Render it last. */
export function SpeakingRing() {
  return <div data-speaking aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-[3px] border-link" />;
}

export function LocalPreview({ stream, mirrored = true }: { stream: MediaStream | null; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      aria-label="Your preview"
      className={`block aspect-[3/4] w-full bg-surface object-cover sm:aspect-video ${mirrored ? "[transform:scaleX(-1)]" : ""}`}
    />
  );
}


// Sprite sheets in public/mascots (page-mascot); one per person, picked from a stable seed.
const MASCOTS = ["fox", "bunny", "cat", "panda", "owl", "otter", "koala", "penguin"];

function mascotFor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return MASCOTS[Math.abs(h) % MASCOTS.length]!;
}

/** Shown instead of the picture whenever the camera is off: profile photo, else the person's mascot. */
export function PersonAvatar({
  seed,
  name,
  image,
  size = 140,
}: {
  seed: string;
  name: string;
  image?: string | null;
  size?: number;
}) {
  const m = mascotFor(seed);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface">
      {image ? (
        <Avatar size="lg">
          <AvatarImage src={image} />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
      ) : (
        <Mascot
          directions={`/mascots/${m}-directions.webp`}
          reactions={`/mascots/${m}-reactions.webp`}
          size={size}
          label={`${name}'s avatar`}
        />
      )}
    </div>
  );
}

/**
 * Pin control for a tile's top-right corner (bottom-right is under the floating self-view), Meet-style:
 * shows on hover / keyboard focus with a mouse, always on touch screens, and stays up while pinned.
 */
function PinButton({ label, pinned, onPin }: { label: string; pinned: boolean; onPin: () => void }) {
  const text = pinned ? `Unpin ${label}` : `Pin ${label}`;
  return (
    <div
      className={`transition-opacity duration-200 ${
        pinned ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 [@media(hover:none)]:opacity-100"
      }`}
    >
      <Tip label={text}>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={text}
          aria-pressed={pinned}
          className={`glass size-9 min-w-0 ${pinned ? "bg-foreground text-background" : "text-foreground"}`}
          onPress={onPin}
        >
          {pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </Button>
      </Tip>
    </div>
  );
}

/** Mic/camera-off markers. Plain inline pills (HeroUI Badge positions itself absolutely and would sit on the pin button). */
function Badges({ mic, cam }: { mic: boolean; cam: boolean }) {
  const pill = "glass flex size-9 items-center justify-center rounded-full text-foreground";
  return (
    <div className="flex gap-1">
      {!mic && (
        <span role="img" aria-label="Microphone off" className={pill}>
          <MicOff size={15} aria-hidden />
        </span>
      )}
      {!cam && (
        <span role="img" aria-label="Camera off" className={pill}>
          <VideoOff size={15} aria-hidden />
        </span>
      )}
    </div>
  );
}

export default function VideoTile({
  peer,
  pinned,
  speaking,
  compact,
  onPin,
}: {
  peer: RemotePeer;
  pinned?: boolean;
  speaking?: boolean;
  /** Small rail tile: smaller avatar. */
  compact?: boolean;
  onPin?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = peer.stream;
    const sink = getPrefs().speakerId; // tiles mounted after a speaker pick need it too
    if (sink) setSpeaker(el, sink);
  }, [peer.stream]);
  const { info } = peer;
  const camOff = !info.state.cam; // the screen has its own tile (spec 007)
  return (
    <div role="group" aria-label={`${info.name}'s tile`} className="group/tile relative h-full min-h-0 overflow-hidden rounded-card bg-surface">
      {/* Always mounted: this element also plays the peer's audio (and feeds speaker detection). */}
      <video
        ref={ref}
        autoPlay
        playsInline
        aria-label={`${info.name}'s video`}
        className={`h-full w-full object-cover [transform:scaleX(-1)] ${camOff ? "invisible" : ""}`}
      />
      {camOff ? <PersonAvatar seed={info.userId} name={info.name} image={info.image} size={compact ? 72 : 140} /> : null}
      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        <span className="glass rounded-full px-2.5 py-1 text-sm font-semibold text-foreground">
          {info.name}
        </span>
        {info.isHost && <Crown size={14} className="text-warning" aria-label="Host" />}
        {info.isGuest && (
          <Chip size="sm" className="glass text-foreground">
            guest
          </Chip>
        )}
        {pinned && (
          <Chip size="sm" className="glass text-foreground">
            pinned
          </Chip>
        )}
      </div>
      {info.state.recording ? (
        <span aria-label={`${info.name} is recording`} className="absolute left-2 top-2 rounded-full bg-danger/80 px-2 py-0.5 text-xs font-semibold text-white">
          ● REC
        </span>
      ) : null}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        <Badges mic={info.state.mic} cam={info.state.cam} />
        {onPin ? <PinButton label={info.name} pinned={!!pinned} onPin={onPin} /> : null}
      </div>
      {speaking ? <SpeakingRing /> : null}
    </div>
  );
}

/** A presentation: letterboxed on black, never cropped; plays the share's tab audio. */
export function ScreenTile({
  peer,
  pinned,
  onPin,
}: {
  peer: RemotePeer;
  pinned?: boolean;
  onPin?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = peer.screenStream;
  }, [peer.screenStream]);
  const { name } = peer.info;
  return (
    <div role="group" aria-label={`${name}'s presentation`} className="group/tile relative h-full min-h-0 overflow-hidden rounded-card bg-black">
      {peer.screenStream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          aria-label={`${name}'s screen`}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">Loading presentation…</div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        <span className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-foreground">
          <MonitorUp size={14} aria-hidden /> {name} is presenting
        </span>
        {pinned && (
          <Chip size="sm" className="glass text-foreground">
            pinned
          </Chip>
        )}
      </div>
      {onPin ? (
        <div className="absolute right-2 top-2">
          <PinButton label={`${name}'s presentation`} pinned={!!pinned} onPin={onPin} />
        </div>
      ) : null}
    </div>
  );
}

/** Layout id for our own screen tile; never a socket id. */
const SELF = "self";

export function VideoGrid({
  peers,
  presenterId,
  pinnedId,
  speakingId,
  followedId,
  onPin,
  localScreen,
  onStopShare,
}: {
  peers: RemotePeer[];
  presenterId?: string | null;
  pinnedId?: string | null;
  speakingId?: string | null;
  followedId?: string | null;
  onPin?: (id: string) => void;
  /** Our own share: takes the presenter slot so it fills the stage (spec 007 FR9). */
  localScreen?: MediaStream | null;
  onStopShare?: () => void;
}) {
  const byId = new Map(peers.map((p) => [p.info.id, p]));
  const { main, rail } = layoutTiles({
    ids: peers.map((p) => p.info.id),
    presenterId: localScreen ? SELF : (presenterId ?? null),
    pinnedId: pinnedId ?? null,
    followedId: followedId ?? null,
  });
  const tile = (t: TileKey, compact = false) => {
    if (t.kind === "screen" && t.id === SELF) {
      return <PresentingBanner key={SELF} stream={localScreen ?? null} onStop={() => onStopShare?.()} stage={compact ? "rail" : "main"} />;
    }
    const peer = byId.get(t.id);
    if (!peer) return null;
    const key = tileId(t);
    const pin = onPin ? () => onPin(key) : undefined;
    return t.kind === "screen" ? (
      <ScreenTile key={key} peer={peer} pinned={pinnedId === key} onPin={pin} />
    ) : (
      <VideoTile key={key} peer={peer} pinned={pinnedId === key} speaking={speakingId === t.id} compact={compact} onPin={pin} />
    );
  };
  if (main) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="min-h-0 flex-1">{tile(main)}</div>
        {rail.length > 0 ? (
          <div className="flex h-24 shrink-0 gap-2 overflow-x-auto sm:h-28">
            {rail.map((t) => (
              <div key={tileId(t)} className="aspect-video h-full shrink-0">
                {tile(t, true)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  const n = rail.length;
  // phone portrait: stack 1–2 people full width; then 2 columns; 3 on wide screens
  const cols = n <= 1 ? "grid-cols-1" : n === 2 ? "grid-cols-1 sm:grid-cols-2" : n <= 4 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3";
  return <div className={`grid min-h-0 flex-1 auto-rows-fr gap-2 ${cols}`}>{rail.map((t) => tile(t))}</div>;
}
