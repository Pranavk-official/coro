"use client";
import { useState } from "react";
import type { useOverlayState } from "@heroui/react";
import { Check, ChevronRight, Mic, Video, Volume2, X } from "lucide-react";
import type { DeviceKind, DeviceSection } from "@/components/call/DeviceMenu";
import { Drawer, DrawerContent, DrawerNested, DrawerTitle } from "@/components/ui/drawer";

const ICON = { audio: Mic, speaker: Volume2, video: Video } as const;
const row = "flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left hover:bg-white/10";
const list = "flex flex-col gap-1 overflow-y-auto p-2 pb-[max(env(safe-area-inset-bottom),1rem)]";

/** The device that is actually in use: the saved one, else the browser default, else the first listed. */
const active = (s: DeviceSection) =>
  s.devices.find((d) => d.deviceId === s.activeId) ?? s.devices.find((d) => d.deviceId === "default") ?? s.devices[0];

/** Phone device picker, Meet-style: kinds first, then a stacked drawer listing that kind's devices. */
export default function DeviceDrawer({
  state,
  sections,
  onPick,
  nested = false,
}: {
  state: ReturnType<typeof useOverlayState>;
  sections: DeviceSection[];
  onPick: (kind: DeviceKind, deviceId: string) => void;
  /** Rendered inside another drawer (the call's More sheet): stack on top of it. */
  nested?: boolean;
}) {
  const [kind, setKind] = useState<DeviceKind | null>(null);
  // Separate from `kind` so the list keeps its rows while the stacked sheet animates out.
  const [listOpen, setListOpen] = useState(false);
  const open = sections.find((s) => s.kind === kind);
  const Root = nested ? DrawerNested : Drawer;
  return (
    <Root open={state.isOpen} onOpenChange={state.setOpen}>
      <DrawerContent className="glass">
        <DrawerTitle className="px-4 pt-2 text-[17px]">Audio & video</DrawerTitle>
        <div className={list}>
          {sections.map((s) => {
            const Icon = ICON[s.kind];
            return (
              <button
                key={s.kind}
                type="button"
                className={row}
                onClick={() => {
                  setKind(s.kind);
                  setListOpen(true);
                }}
              >
                <Icon size={22} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.title}</span>
                  <span className="block truncate text-sm text-muted">{active(s)?.label || "Default"}</span>
                </span>
                <ChevronRight size={18} aria-hidden />
              </button>
            );
          })}
        </div>
        <DrawerNested open={listOpen} onOpenChange={setListOpen}>
          <DrawerContent className="glass">
            <DrawerTitle className="sr-only">{open?.title ?? "Devices"}</DrawerTitle>
            <div className={list}>
              {open?.devices.length === 0 ? <p className="px-4 py-3 text-muted">No devices found</p> : null}
              {open?.devices.map((d) => {
                const Icon = ICON[open.kind];
                const on = d.deviceId === active(open)?.deviceId;
                return (
                  <button
                    key={d.deviceId}
                    type="button"
                    aria-pressed={on}
                    className={row}
                    onClick={() => {
                      onPick(open.kind, d.deviceId);
                      setListOpen(false);
                    }}
                  >
                    <Icon size={22} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{d.label || d.deviceId}</span>
                    {on ? <Check size={20} aria-hidden /> : null}
                  </button>
                );
              })}
              <button type="button" className={row} onClick={() => setListOpen(false)}>
                <X size={22} aria-hidden />
                <span className="flex-1">Cancel</span>
              </button>
            </div>
          </DrawerContent>
        </DrawerNested>
      </DrawerContent>
    </Root>
  );
}
