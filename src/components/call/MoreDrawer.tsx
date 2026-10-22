"use client";
import type { ReactNode } from "react";
import { Button, type useOverlayState } from "@heroui/react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Circle, Copy, Link2, Lock, LockOpen, MonitorUp, PhoneOff, Settings2, Share2, Users } from "lucide-react";

/** Phone "More" sheet, Meet-style: big tiles, then the meeting link (replaces the post-join share modal). */
export default function MoreDrawer({
  state,
  code,
  shareSupported,
  sharing,
  waitingCount,
  isHost,
  locked,
  onShare,
  onParticipants,
  onCopyLink,
  onLock,
  onEnd,
  onDevices,
  onRecord,
  children,
}: {
  state: ReturnType<typeof useOverlayState>;
  code: string;
  shareSupported: boolean;
  sharing: boolean;
  waitingCount: number;
  isHost: boolean;
  locked: boolean;
  onShare: () => void;
  onParticipants: () => void;
  onCopyLink: () => void;
  onLock: (v: boolean) => void;
  onEnd: () => void;
  /** Opens the stacked microphone / speaker / camera picker. */
  onDevices: () => void;
  /** Opens the stacked record sheet; absent for guests or while one runs (stop lives in the bar). */
  onRecord?: () => void;
  /** Sheets that stack on top of this one (`DrawerNested`, e.g. the device picker). */
  children?: ReactNode;
}) {
  const link = typeof window !== "undefined" ? `${window.location.origin}/rooms/${code}` : `/rooms/${code}`;
  // Most tiles close the sheet first: the action it starts (picker, drawer, dialog) needs the screen.
  const run = (fn: () => void) => () => {
    state.close();
    fn();
  };
  const tile = "h-20 w-full flex-col gap-1 rounded-3xl bg-foreground/10";
  return (
    <Drawer open={state.isOpen} onOpenChange={state.setOpen}>
      <DrawerContent className="glass">
        <DrawerTitle className="sr-only">More options</DrawerTitle>
        <div className="flex flex-col gap-3 overflow-y-auto p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" className={`${tile} col-span-2 text-foreground`} onPress={onDevices}>
              <Settings2 size={20} /> Audio & video
            </Button>
            {shareSupported ? (
              <Button variant="ghost" className={`${tile} text-foreground`} onPress={run(onShare)}>
                <MonitorUp size={20} /> {sharing ? "Stop sharing" : "Share screen"}
              </Button>
            ) : null}
            <Button variant="ghost" className={`${tile} text-foreground ${shareSupported ? "" : "col-span-2"}`} onPress={onParticipants}>
              <Users size={20} /> {waitingCount > 0 ? `Participants (${waitingCount} waiting)` : "Participants"}
            </Button>
            {onRecord ? (
              <Button variant="ghost" className={`${tile} col-span-2 text-foreground`} onPress={onRecord}>
                <Circle size={20} /> Record
              </Button>
            ) : null}
            {isHost ? (
              <>
                <Button variant="ghost" className={`${tile} text-foreground`} aria-pressed={locked} onPress={() => onLock(!locked)}>
                  {locked ? <Lock size={20} /> : <LockOpen size={20} />} {locked ? "Unlock room" : "Lock room"}
                </Button>
                <Button variant="ghost" className={`${tile} text-danger`} onPress={run(onEnd)}>
                  <PhoneOff size={20} /> End for everyone
                </Button>
              </>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <h2 className="font-semibold">Joining information</h2>
            {typeof navigator !== "undefined" && "share" in navigator ? (
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
          <div className="flex items-center gap-3 rounded-3xl bg-foreground/10 py-3 pl-4 pr-2">
            <Link2 size={20} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Meeting link</p>
              <p className="truncate text-sm text-muted">{link.replace(/^https?:\/\//, "")}</p>
            </div>
            <Button isIconOnly variant="ghost" className="size-11" aria-label="Copy meeting link" onPress={onCopyLink}>
              <Copy size={18} />
            </Button>
          </div>
        </div>
        {children}
      </DrawerContent>
    </Drawer>
  );
}
