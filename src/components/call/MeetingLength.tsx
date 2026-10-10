"use client";
import { EXPIRY_PRESETS, type ExpiryKey } from "@/lib/utils/expiry";
import SelectField from "@/components/ui/SelectField";
import TextInput from "@/components/ui/TextInput";

export type LengthValue = { key: ExpiryKey; custom: string };

const OPTIONS = [
  ...EXPIRY_PRESETS.map((p) => ({ id: p.key, label: p.label })),
  { id: "custom", label: "Custom end time" },
];

/** Meeting length picker for a meeting that is about to be created (applied on Join now / Create). */
export default function MeetingLength({
  value,
  onChange,
}: {
  value: LengthValue;
  onChange: (v: LengthValue) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SelectField
        label="Meeting length"
        value={value.key}
        options={OPTIONS}
        onChange={(id) => onChange({ ...value, key: id as ExpiryKey })}
      />
      {value.key === "custom" ? (
        <TextInput
          label="Custom end time"
          type="datetime-local"
          value={value.custom}
          onChange={(custom) => onChange({ ...value, custom })}
        />
      ) : null}
    </div>
  );
}
