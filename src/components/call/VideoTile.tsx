"use client";
import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage, Badge, Chip } from "@heroui/react";
import { Crown, MicOff, MonitorUp, VideoOff } from "lucide-react";
import type { RemotePeer } from "@/hooks/use-call";
import { layoutTiles, tileId, type TileKey } from "@/lib/webrtc/screen";

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

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Badges({ mic, cam }: { mic: boolean; cam: boolean }) {
  return (
    <div className="flex gap-1">
      {!mic && (
        <Badge aria-label="Microphone off">
          <MicOff size={14} />
        </Badge>
      )}
      {!cam && (
        <Badge aria-label="Camera off">
          <VideoOff size={14} />
        </Badge>
      )}
    </div>
  );
}

export default function VideoTile({
  peer,
  pinned,
  speaking,
  onPin,
}: {
  peer: RemotePeer;
  pinned?: boolean;
  speaking?: boolean;
  onPin?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = peer.stream;
  }, [peer.stream]);
  const { info } = peer;
  const camOff = !info.state.cam; // the screen has its own tile (spec 007)
  return (
    <div
      className={`relative h-full min-h-0 overflow-hidden rounded-card bg-surface ${speaking ? "ring-2 ring-link" : ""}`}
      onClick={onPin}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onPin) {
          e.preventDefault();
          onPin();
        }
      }}
      role={onPin ? "button" : undefined}
      tabIndex={onPin ? 0 : undefined}
      aria-label={onPin ? `Pin ${info.name}` : undefined}
    >
      {camOff || !peer.stream ? (
        <div className="flex h-full items-center justify-center">
          <Avatar size="lg">
            <AvatarImage src={info.image ?? undefined} />
            <AvatarFallback>{initials(info.name)}</AvatarFallback>
          </Avatar>
        </div>
      ) : (
        <video
          ref={ref}
          autoPlay
          playsInline
          aria-label={`${info.name}'s video`}
          className="h-full w-full object-cover"
        />
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        <span className="glass rounded-full px-2.5 py-1 text-sm font-semibold text-white">
          {info.name}
        </span>
        {info.isHost && <Crown size={14} className="text-warning" aria-label="Host" />}
        {info.isGuest && (
          <Chip size="sm" className="glass text-white">
            guest
          </Chip>
        )}
        {pinned && (
          <Chip size="sm" className="glass text-white">
            pinned
          </Chip>
        )}
      </div>
      <div className="absolute right-2 top-2">
        <Badges mic={info.state.mic} cam={info.state.cam} />
      </div>
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
    <div
      className="relative h-full min-h-0 overflow-hidden rounded-card bg-black"
      onClick={onPin}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onPin) {
          e.preventDefault();
          onPin();
        }
      }}
      role={onPin ? "button" : undefined}
      tabIndex={onPin ? 0 : undefined}
      aria-label={onPin ? `Spotlight ${name}'s presentation` : undefined}
    >
      {peer.screenStream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          aria-label={`${name}'s screen`}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/70">Loading presentation…</div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1">
        <span className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-white">
          <MonitorUp size={14} aria-hidden /> {name} is presenting
        </span>
        {pinned && (
          <Chip size="sm" className="glass text-white">
            pinned
          </Chip>
        )}
      </div>
    </div>
  );
}

export function VideoGrid({
  peers,
  presenterId,
  pinnedId,
  speakingId,
  followedId,
  onPin,
}: {
  peers: RemotePeer[];
  presenterId?: string | null;
  pinnedId?: string | null;
  speakingId?: string | null;
  followedId?: string | null;
  onPin?: (id: string) => void;
}) {
  const byId = new Map(peers.map((p) => [p.info.id, p]));
  const { main, rail } = layoutTiles({
    ids: peers.map((p) => p.info.id),
    presenterId: presenterId ?? null,
    pinnedId: pinnedId ?? null,
    followedId: followedId ?? null,
  });
  const tile = (t: TileKey) => {
    const peer = byId.get(t.id);
    if (!peer) return null;
    const key = tileId(t);
    const pin = onPin ? () => onPin(key) : undefined;
    return t.kind === "screen" ? (
      <ScreenTile key={key} peer={peer} pinned={pinnedId === key} onPin={pin} />
    ) : (
      <VideoTile key={key} peer={peer} pinned={pinnedId === key} speaking={speakingId === t.id} onPin={pin} />
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
                {tile(t)}
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
  return <div className={`grid min-h-0 flex-1 auto-rows-fr gap-2 ${cols}`}>{rail.map(tile)}</div>;
}
