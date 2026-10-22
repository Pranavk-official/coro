"use client";
import { EXPIRY_PRESETS, type ExpiryKey } from "@/lib/utils/expiry";
import SelectField from "@/components/ui/SelectField";
import OptionSheet from "@/components/ui/OptionSheet";
import DateTimeField, { InlineDateTime } from "@/components/ui/DateTimeField";

export type LengthValue = { key: ExpiryKey; custom: string };

const OPTIONS = [
  ...EXPIRY_PRESETS.map((p) => ({ id: p.key, label: p.label })),
  { id: "custom", label: "Custom end time" },
];

const when = (custom: string) =>
  custom
    ? `Until ${new Date(custom).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
    : "Custom end time";

/** Meeting length picker for a meeting that is about to be created (applied on Join now / Create). `phone`: drawer, not dropdown. */
export default function MeetingLength({
  value,
  onChange,
  phone = false,
}: {
  value: LengthValue;
  onChange: (v: LengthValue) => void;
  phone?: boolean;
}) {
  const setKey = (id: string) => onChange({ ...value, key: id as ExpiryKey });
  const setCustom = (custom: string) => onChange({ ...value, custom });
  if (phone) {
    return (
      <OptionSheet
        label="Meeting length"
        value={value.key}
        options={OPTIONS}
        onChange={setKey}
        keepOpen={["custom"]}
        summary={value.key === "custom" ? when(value.custom) : undefined}
        extra={<InlineDateTime label="Custom end time" value={value.custom} onChange={setCustom} />}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <SelectField label="Meeting length" value={value.key} options={OPTIONS} onChange={setKey} />
      {value.key === "custom" ? <DateTimeField label="Custom end time" value={value.custom} onChange={setCustom} /> : null}
    </div>
  );
}
