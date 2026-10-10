// Meeting length presets shared by the schedule dialog and the host's pre-join screen.
export const EXPIRY_PRESETS = [
  { key: "5m", label: "5 min", minutes: 5 },
  { key: "10m", label: "10 min", minutes: 10 },
  { key: "15m", label: "15 min", minutes: 15 },
  { key: "30m", label: "30 min", minutes: 30 },
  { key: "1h", label: "1 hr", minutes: 60 },
] as const;

export type ExpiryKey = (typeof EXPIRY_PRESETS)[number]["key"] | "custom";

/** ISO end time for a preset counted from `base`, or the custom `datetime-local` value; null if custom is empty. */
export function expiryFrom(base: Date, key: ExpiryKey, custom = ""): string | null {
  if (key === "custom") return custom ? new Date(custom).toISOString() : null;
  const preset = EXPIRY_PRESETS.find((p) => p.key === key)!;
  return new Date(base.getTime() + preset.minutes * 60_000).toISOString();
}
