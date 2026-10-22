"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { Check, ChevronRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { SelectOption } from "@/components/ui/SelectField";

const row = "flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left hover:bg-foreground/10";

/**
 * Phone stand-in for SelectField: a row showing the current choice that opens a bottom drawer of options
 * (same look as the device drawer). A `keepOpen` option stacks a second drawer on top with `extra` + Done,
 * like the device drawer's per-kind list.
 */
export default function OptionSheet({
  label,
  value,
  options,
  onChange,
  keepOpen = [],
  extra,
  summary,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (id: string) => void;
  keepOpen?: string[];
  /** Content of the stacked drawer a `keepOpen` option opens (e.g. a date-time picker). */
  extra?: ReactNode;
  /** Row text when the label alone isn't enough (e.g. the chosen custom time). */
  summary?: string;
}) {
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  const current = summary ?? options.find((o) => o.id === value)?.label ?? "";
  const nestedTitle = options.find((o) => keepOpen.includes(o.id))?.label ?? label;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${label}: ${current}`}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-default px-4 text-left"
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-muted">{label}</span>
          <span className="block truncate font-semibold">{current}</span>
        </span>
        <ChevronRight size={18} aria-hidden />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="glass">
          <DrawerTitle className="px-4 pt-2 text-[17px]">{label}</DrawerTitle>
          <div className="flex max-h-[80dvh] flex-col gap-1 overflow-y-auto p-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
            {options.map((o) => {
              const on = o.id === value;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  className={row}
                  onClick={() => {
                    onChange(o.id);
                    if (keepOpen.includes(o.id)) setNested(true);
                    else setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {on ? <Check size={20} aria-hidden /> : null}
                  {keepOpen.includes(o.id) ? <ChevronRight size={18} aria-hidden /> : null}
                </button>
              );
            })}
          </div>
          {extra ? (
            <Drawer open={nested} onOpenChange={setNested}>
              <DrawerContent className="glass">
                <DrawerTitle className="px-4 pt-2 text-[17px]">{nestedTitle}</DrawerTitle>
                <div className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
                  {extra}
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onPress={() => {
                      setNested(false);
                      setOpen(false);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </DrawerContent>
            </Drawer>
          ) : null}
        </DrawerContent>
      </Drawer>
    </>
  );
}
