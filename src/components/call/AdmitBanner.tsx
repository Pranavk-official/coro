"use client";
import { Button } from "@heroui/react";
import type { Peer } from "@/lib/socket.io/events";

export default function AdmitBanner({
  waiting,
  onAdmit,
  onDeny,
  onAdmitAll,
  onView,
}: {
  waiting: Peer[];
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onAdmitAll: () => void;
  onView: () => void;
}) {
  if (waiting.length === 0) return null;
  if (waiting.length === 1) {
    const w = waiting[0]!;
    return (
      <div
        role="status"
        aria-live="polite"
        className="glass absolute left-1/2 top-[calc(env(safe-area-inset-top)+4rem)] z-30 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5"
      >
        <span className="text-sm text-white">{w.name} wants to join</span>
        <Button size="sm" variant="ghost" onPress={() => onDeny(w.id)}>
          Deny
        </Button>
        <Button size="sm" variant="primary" onPress={() => onAdmit(w.id)}>
          Admit
        </Button>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="glass absolute left-1/2 top-[calc(env(safe-area-inset-top)+4rem)] z-30 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5"
    >
      <span className="text-sm text-white">{waiting.length} people want to join</span>
      <Button size="sm" variant="ghost" onPress={onView}>
        View
      </Button>
      <Button size="sm" variant="primary" onPress={onAdmitAll}>
        Admit all
      </Button>
    </div>
  );
}
