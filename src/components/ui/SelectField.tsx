"use client";
import type { ReactNode } from "react";
import { Label, ListBox, Select } from "@heroui/react";

export type SelectOption = { id: string; label: string };

/** HeroUI Select; `value` is the selected option id. `icon` + `hideLabel` = compact pill (label stays for screen readers). */
export default function SelectField({
  label,
  value,
  options,
  onChange,
  className,
  icon,
  hideLabel,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (id: string) => void;
  className?: string;
  icon?: ReactNode;
  hideLabel?: boolean;
}) {
  return (
    <Select
      className={className ?? "w-full"}
      value={value}
      onChange={(key) => key !== null && onChange(String(key))}
    >
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      <Select.Trigger className={`min-h-11 ${icon ? "flex items-center gap-2 rounded-full" : ""}`}>
        {icon ? <span className="flex shrink-0 items-center text-muted">{icon}</span> : null}
        <Select.Value className="truncate" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
