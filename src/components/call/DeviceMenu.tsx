"use client";
import {
  Button,
  ButtonGroup,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  DropdownSection,
  Header,
} from "@heroui/react";
import { Check, ChevronUp } from "lucide-react";
import type { DeviceInfo } from "@/lib/webrtc/devices";
import Tip from "@/components/ui/Tip";

export type DeviceKind = "audio" | "video" | "speaker";
export type DeviceSection = { title: string; kind: DeviceKind; devices: DeviceInfo[]; activeId: string | null };

/** Chevron half of a toolbar ButtonGroup (split button; separator lives inside, per HeroUI docs); one menu can list several device kinds (mic + speaker, like Meet). */
export default function DeviceMenu({
  label,
  sections,
  onPick,
}: {
  label: string;
  sections: DeviceSection[];
  onPick: (kind: DeviceKind, deviceId: string) => void;
}) {
  return (
    <DropdownRoot>
      <Tip label={label}>
        <Button isIconOnly variant="ghost" className="h-12 w-9 min-w-0 bg-foreground/10 text-foreground" aria-label={label}>
          <ButtonGroup.Separator />
          <ChevronUp size={16} />
        </Button>
      </Tip>
      <DropdownPopover>
        <DropdownMenu
          onAction={(key) => {
            // keys are "<kind>:<deviceId>": Chrome reuses "default" across input and output lists
            const [kind, ...rest] = String(key).split(":");
            if (rest.length) onPick(kind as DeviceKind, rest.join(":"));
          }}
        >
          {sections.map((s) => (
            <DropdownSection key={s.kind}>
              <Header>{s.title}</Header>
              {s.devices.length === 0 ? (
                <DropdownItem id={`${s.kind}-none`} textValue="No devices">
                  No devices found
                </DropdownItem>
              ) : (
                s.devices.map((d) => (
                  <DropdownItem key={d.deviceId} id={`${s.kind}:${d.deviceId}`} textValue={d.label || d.deviceId}>
                    {d.deviceId === s.activeId ? <Check size={14} /> : null} {d.label || d.deviceId}
                  </DropdownItem>
                ))
              )}
            </DropdownSection>
          ))}
        </DropdownMenu>
      </DropdownPopover>
    </DropdownRoot>
  );
}
