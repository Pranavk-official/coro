"use client";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Circle, Square } from "lucide-react";

function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Idle: opens the record dialog. Recording: stop + elapsed (spec 003 design §2). */
export default function RecordButton({
  startedAt,
  saving,
  onPress,
}: {
  startedAt: number | null;
  saving: boolean;
  onPress: () => void;
}) {
  const s = useElapsed(startedAt);
  if (startedAt !== null) {
    return (
      <Button
        variant="danger"
        className="h-12 px-4 tabular-nums"
        aria-pressed
        aria-label={`Stop recording, ${s} seconds`}
        onPress={onPress}
      >
        <Square size={14} fill="currentColor" /> {mmss(s)}
      </Button>
    );
  }
  return (
    <Button
      isIconOnly
      variant="ghost"
      className="size-12 bg-white/15 text-white"
      aria-label={saving ? "Saving recording" : "Record"}
      aria-pressed={false}
      isPending={saving}
      onPress={onPress}
    >
      <Circle size={18} />
    </Button>
  );
}
