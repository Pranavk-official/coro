"use client";
import { useState } from "react";
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerDialog,
  DrawerHandle,
  DrawerHeading,
  useOverlayState,
} from "@heroui/react";
import { Check, ChevronRight, Mic, Video, Volume2, X } from "lucide-react";
import type { DeviceKind, DeviceSection } from "@/components/call/DeviceMenu";

const ICON = { audio: Mic, speaker: Volume2, video: Video } as const;
const row = "flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left hover:bg-white/10";

/** The device that is actually in use: the saved one, else the browser default, else the first listed. */
const active = (s: DeviceSection) =>
  s.devices.find((d) => d.deviceId === s.activeId) ?? s.devices.find((d) => d.deviceId === "default") ?? s.devices[0];

/** Phone device picker, Meet-style: kinds first, then a stacked drawer listing that kind's devices. */
export default function DeviceDrawer({
  state,
  sections,
  onPick,
}: {
  state: ReturnType<typeof useOverlayState>;
  sections: DeviceSection[];
  onPick: (kind: DeviceKind, deviceId: string) => void;
}) {
  const list = useOverlayState();
  const [kind, setKind] = useState<DeviceKind | null>(null);
  const open = sections.find((s) => s.kind === kind);
  return (
    <Drawer state={state}>
      <DrawerBackdrop>
        <DrawerContent placement="bottom">
          <DrawerDialog>
            <DrawerHandle />
            <DrawerHeading className="px-4 pt-2 text-[17px]">Audio & video</DrawerHeading>
            <DrawerBody>
              <div className="flex flex-col gap-1 p-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
                {sections.map((s) => {
                  const Icon = ICON[s.kind];
                  return (
                    <button
                      key={s.kind}
                      type="button"
                      className={row}
                      onClick={() => {
                        setKind(s.kind);
                        list.open();
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
          {/* Inside the first drawer's tree: React Aria treats it as nested and stacks it on top. */}
          <Drawer state={list}>
            <DrawerBackdrop>
              <DrawerContent placement="bottom">
                <DrawerDialog>
                  <DrawerHeading className="sr-only">{open?.title ?? "Devices"}</DrawerHeading>
                  <DrawerBody>
                    <div className="flex flex-col gap-1 p-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
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
                              list.close();
                            }}
                          >
                            <Icon size={22} aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{d.label || d.deviceId}</span>
                            {on ? <Check size={20} aria-hidden /> : null}
                          </button>
                        );
                      })}
                      <button type="button" className={row} onClick={list.close}>
                        <X size={22} aria-hidden />
                        <span className="flex-1">Cancel</span>
                      </button>
                    </div>
                  </DrawerBody>
                </DrawerDialog>
              </DrawerContent>
            </DrawerBackdrop>
          </Drawer>
            </DrawerBody>
          </DrawerDialog>
        </DrawerContent>
      </DrawerBackdrop>
    </Drawer>
  );
}
