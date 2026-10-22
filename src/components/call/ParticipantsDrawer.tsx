"use client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent as SideContent,
  DrawerDialog,
  DrawerHeader,
  DrawerHeading,
  type useOverlayState,
} from "@heroui/react";
import { Check, Crown, MicOff, MonitorUp, MonitorX, Pin, PinOff, UserX, X } from "lucide-react";
import type { Peer } from "@/lib/socket.io/events";
import type { RemotePeer } from "@/hooks/use-call";
import { initials } from "@/lib/utils/initials";
import { Drawer as Sheet, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

type Props = {
  state: ReturnType<typeof useOverlayState>;
  waiting: Peer[];
  peers: RemotePeer[];
  /** You: the list starts with your own row. */
  self: { name: string; image: string | null };
  canAdmit: boolean;
  isHost: boolean;
  maxPeers: number;
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onMute: (id: string) => void;
  onRemove: (id: string) => void;
  onStopShare: (id: string) => void;
  /** Tile id as the grid uses it (a peer id for a camera). Presentations pin from their own tile. */
  pinnedId: string | null;
  onPin: (tileId: string) => void;
};

const icon = "size-9 min-w-0 text-foreground/80 hover:text-foreground";

function Person({
  name,
  image,
  sub,
  host,
  children,
}: {
  name: string;
  image: string | null;
  sub?: string;
  host?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-2xl px-2 hover:bg-foreground/5">
      <Avatar size="sm">
        <AvatarImage src={image ?? undefined} />
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[15px] font-medium text-foreground">
          {name}
          {host ? <Crown size={14} className="shrink-0 text-warning" aria-label="Host" /> : null}
        </span>
        {sub ? <span className="block truncate text-[13px] text-muted">{sub}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">{children}</span>
    </li>
  );
}

function Heading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2">
      <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{children}</h3>
      {action}
    </div>
  );
}

/** Waiting room first (admit / deny), then everyone in the call; host controls per person. */
function ParticipantsBody(p: Omit<Props, "state">) {
  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-3 pb-[max(env(safe-area-inset-bottom),1rem)]" aria-live="polite">
      {p.canAdmit && p.waiting.length > 0 ? (
        <section className="flex flex-col gap-1">
          <Heading
            action={
              p.waiting.length > 1 ? (
                <Button size="sm" variant="secondary" className="h-7 px-3 text-[13px]" onPress={() => p.waiting.forEach((w) => p.onAdmit(w.id))}>
                  Admit all
                </Button>
              ) : null
            }
          >
            Waiting to join · {p.waiting.length}
          </Heading>
          <ul className="flex flex-col">
            {p.waiting.map((w) => (
              <Person key={w.id} name={w.name} image={w.image} sub="Guest">
                <Button isIconOnly size="sm" variant="ghost" className={`${icon} size-8`} aria-label={`Deny ${w.name}`} onPress={() => p.onDeny(w.id)}>
                  <X size={16} />
                </Button>
                <Button isIconOnly size="sm" variant="primary" className="size-8 min-w-0" aria-label={`Admit ${w.name}`} onPress={() => p.onAdmit(w.id)}>
                  <Check size={16} />
                </Button>
              </Person>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="flex flex-col gap-1">
        <Heading>
          In call · {p.peers.length + 1}/{p.maxPeers}
        </Heading>
        <ul className="flex flex-col">
          <Person name={p.self.name} image={p.self.image} sub="You" host={p.isHost} />
          {p.peers.map(({ info }) => (
            <Person
              key={info.id}
              name={info.name}
              image={info.image}
              host={info.isHost}
              sub={[info.isGuest ? "Guest" : null, info.state.screen ? "Presenting" : null, info.state.recording ? "Recording" : null]
                .filter(Boolean)
                .join(" · ")}
            >
              {info.state.screen && !p.isHost ? <MonitorUp size={16} className="mx-2 text-muted" aria-label="Presenting" /> : null}
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className={`${icon} ${p.pinnedId === info.id ? "text-accent" : ""}`}
                aria-label={p.pinnedId === info.id ? `Unpin ${info.name}` : `Pin ${info.name}`}
                aria-pressed={p.pinnedId === info.id}
                onPress={() => p.onPin(info.id)}
              >
                {p.pinnedId === info.id ? <PinOff size={18} /> : <Pin size={18} />}
              </Button>
              {p.isHost ? (
                <>
                  {info.state.screen ? (
                    <Button isIconOnly size="sm" variant="ghost" className={icon} aria-label={`Stop ${info.name}'s presentation`} onPress={() => p.onStopShare(info.id)}>
                      <MonitorX size={18} />
                    </Button>
                  ) : null}
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className={icon}
                    aria-label={info.state.mic ? `Mute ${info.name}` : `${info.name} is muted`}
                    isDisabled={!info.state.mic}
                    onPress={() => p.onMute(info.id)}
                  >
                    <MicOff size={18} />
                  </Button>
                  <Button isIconOnly size="sm" variant="ghost" className={`${icon} hover:text-danger`} aria-label={`Remove ${info.name}`} onPress={() => p.onRemove(info.id)}>
                    <UserX size={18} />
                  </Button>
                </>
              ) : !info.state.mic ? (
                <MicOff size={16} className="mx-2 text-muted" aria-label="Muted" />
              ) : null}
            </Person>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Phone (`nested`): a sheet rendered inside More, so it stacks on it. Desktop: docked on the right. */
export default function ParticipantsDrawer({ state, nested = false, ...body }: Props & { nested?: boolean }) {
  if (nested) {
    return (
      <Sheet open={state.isOpen} onOpenChange={(v) => state.setOpen(v)}>
        <DrawerContent className="glass">
          <DrawerTitle className="px-5 pt-3 text-[17px]">Participants</DrawerTitle>
          <ParticipantsBody {...body} />
        </DrawerContent>
      </Sheet>
    );
  }
  return (
    <Drawer state={state}>
      {/* Transparent backdrop: the call stays fully visible behind the glass panel. */}
      <DrawerBackdrop variant="transparent">
        <SideContent placement="right">
          <DrawerDialog className="glass w-[min(24rem,100vw)]">
            <DrawerCloseTrigger />
            <DrawerHeader>
              <DrawerHeading>Participants</DrawerHeading>
            </DrawerHeader>
            <DrawerBody className="p-0">
              <ParticipantsBody {...body} />
            </DrawerBody>
          </DrawerDialog>
        </SideContent>
      </DrawerBackdrop>
    </Drawer>
  );
}
