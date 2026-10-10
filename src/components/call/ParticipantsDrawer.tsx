"use client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Chip,
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerDialog,
  DrawerHeader,
  DrawerHeading,
  DrawerHandle,
  type useOverlayState,
} from "@heroui/react";
import { Crown, MicOff, MonitorUp } from "lucide-react";
import type { Peer } from "@/lib/socket.io/events";
import type { RemotePeer } from "@/hooks/use-call";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ParticipantsDrawer({
  state,
  waiting,
  peers,
  canAdmit,
  isHost,
  selfId,
  maxPeers,
  side = false,
  onAdmit,
  onDeny,
  onMute,
  onRemove,
  onStopShare,
}: {
  state: ReturnType<typeof useOverlayState>;
  waiting: Peer[];
  peers: RemotePeer[];
  canAdmit: boolean;
  isHost: boolean;
  selfId: string | null;
  maxPeers: number;
  /** Wide screens: dock on the right instead of a bottom sheet. */
  side?: boolean;
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onMute: (id: string) => void;
  onRemove: (id: string) => void;
  onStopShare: (id: string) => void;
}) {
  return (
    <Drawer state={state}>
      {/* Transparent backdrop: the call stays fully visible behind the glass panel. */}
      <DrawerBackdrop variant="transparent">
        <DrawerContent placement={side ? "right" : "bottom"}>
          <DrawerDialog className="glass">
            {side ? null : <DrawerHandle />}
            <DrawerCloseTrigger />
            <DrawerHeader>
              <DrawerHeading>Participants</DrawerHeading>
            </DrawerHeader>
            <DrawerBody>
        <div className="flex flex-col gap-4 p-4" aria-live="polite">
          {canAdmit ? (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold">Waiting ({waiting.length})</h2>
              {waiting.length === 0 ? (
                <p className="text-sm text-muted">Nobody waiting.</p>
              ) : (
                waiting.map((w) => (
                  <div key={w.id} className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage src={w.image ?? undefined} />
                      <AvatarFallback>{initials(w.name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">
                      {w.name} (guest)
                    </span>
                    <Button size="sm" variant="primary" onPress={() => onAdmit(w.id)}>
                      Admit
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => onDeny(w.id)}>
                      Deny
                    </Button>
                  </div>
                ))
              )}
            </section>
          ) : null}
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">
              In call ({peers.length + 1}/{maxPeers})
            </h2>
            {peers.map((p) => (
              <div key={p.info.id} className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarImage src={p.info.image ?? undefined} />
                  <AvatarFallback>{initials(p.info.name)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm">
                  {p.info.id === selfId ? "You" : p.info.name}
                  {p.info.isHost ? " 👑" : ""}
                  {p.info.isGuest ? " (guest)" : ""}
                </span>
                {!p.info.state.mic && <MicOff size={14} aria-label="Muted" />}
                {p.info.state.screen && <MonitorUp size={14} aria-label="Presenting" />}
                {isHost && p.info.id !== selfId ? (
                  <>
                    {p.info.state.screen ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Stop ${p.info.name}'s presentation`}
                        onPress={() => onStopShare(p.info.id)}
                      >
                        Stop presenting
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onPress={() => onMute(p.info.id)}>
                      Mute
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => onRemove(p.info.id)}>
                      Remove
                    </Button>
                  </>
                ) : null}
                {p.info.isHost && <Crown size={14} className="text-warning" aria-label="Host" />}
              </div>
            ))}
          </section>
          <Chip size="sm">{peers.length + 1} in call</Chip>
        </div>
            </DrawerBody>
          </DrawerDialog>
        </DrawerContent>
      </DrawerBackdrop>
    </Drawer>
  );
}
