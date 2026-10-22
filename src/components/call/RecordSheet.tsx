"use client";
import { useState, type ReactNode } from "react";
import { Button, Label, Popover, Switch } from "@heroui/react";
import { Circle } from "lucide-react";
import { pickMime } from "@/lib/media-recorder/recorder";
import { getPrefs, setPrefs } from "@/lib/utils/prefs";
import type { RecordOptions } from "@/hooks/use-recorder";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useConnectDrive, useDriveAccount } from "@/hooks/use-drive";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (opts: RecordOptions) => void;
};

function Toggle({ value, onChange, children }: { value: boolean; onChange: (v: boolean) => void; children: string }) {
  return (
    <Switch isSelected={value} onChange={onChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>{children}</Label>
      </Switch.Content>
    </Switch>
  );
}

/** Options + Start, shared by the phone sheet and the desktop popover (spec 003 design §2). */
function RecordForm({ onOpenChange, onStart, title }: Props & { title: ReactNode }) {
  const [prefs] = useState(getPrefs);
  const [mp4, setMp4] = useState(prefs.recFormat === "mp4");
  const [compressed, setCompressed] = useState(prefs.recCompressed);
  const [drive, setDrive] = useState(prefs.recDrive);
  const driveAccount = useDriveAccount();
  const connect = useConnectDrive();
  const driveId = driveAccount.data ?? null;
  const mp4Supported = typeof MediaRecorder !== "undefined" && pickMime("mp4") !== "";

  function start() {
    const format = mp4 && mp4Supported ? "mp4" : "webm";
    setPrefs({ recFormat: format, recCompressed: compressed, recDrive: drive });
    onStart({ format, compressed, driveAccountId: drive ? driveId : null });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
          <Circle size={14} fill="currentColor" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          {title}
          <p className="text-sm leading-relaxed text-muted">
            Everyone&apos;s video and audio, plus any screen share, in one file. Keeps recording if you switch tabs.
            A copy downloads to this device when you stop.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-y border-foreground/10 py-4">
        {mp4Supported ? (
          <Toggle value={mp4} onChange={setMp4}>
            Save as MP4
          </Toggle>
        ) : null}
        <Toggle value={compressed} onChange={setCompressed}>
          Compress (720p, smaller file)
        </Toggle>
        {/* Drive: a switch once connected (profile or here); a one-tap popup connect otherwise. */}
        {driveId ? (
          <Toggle value={drive} onChange={setDrive}>
            Also save to Google Drive
          </Toggle>
        ) : (
          // Rendered while the account check loads too, so the sheet doesn't jump under the user's tap.
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{connect.isError ? "Google didn't connect. Try again." : "Also save to Google Drive"}</span>
            <Button
              size="sm"
              variant="secondary"
              isPending={connect.isPending}
              isDisabled={driveAccount.isPending}
              onPress={() => connect.mutate(undefined, { onSuccess: () => setDrive(true) })}
            >
              Connect
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-warning">Everyone in the room will see that you&apos;re recording.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onPress={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="danger" className="active:scale-[0.98]" onPress={start}>
          Start recording
        </Button>
      </div>
    </div>
  );
}

/** Phone sheet; rendered inside the More sheet, so it stacks on it. */
export function RecordSheet(props: Props) {
  return (
    <Drawer open={props.open} onOpenChange={(v) => props.onOpenChange(v)}>
      <DrawerContent className="glass">
        <div className="overflow-y-auto p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
          <RecordForm {...props} title={<DrawerTitle className="text-[17px]">Record this call</DrawerTitle>} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Desktop: anchored above the toolbar's Record button, which `children` must be (the popover trigger). */
export function RecordPopover({ children, ...props }: Props & { children: ReactNode }) {
  return (
    // Opening goes through the button's own onPress (R key too); the popover only reports dismissals.
    <Popover isOpen={props.open} onOpenChange={(v) => !v && props.onOpenChange(false)}>
      {children}
      <Popover.Content
        placement="top"
        offset={14}
        className="glass w-92 rounded-[28px] border border-foreground/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        <Popover.Dialog className="p-5 outline-none">
          <RecordForm {...props} title={<Popover.Heading className="text-[17px] font-semibold">Record this call</Popover.Heading>} />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
