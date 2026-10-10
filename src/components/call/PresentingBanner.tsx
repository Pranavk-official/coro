"use client";
import { useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { MonitorX } from "lucide-react";

/** Presenter's own view (spec 007 FR9): what you're sharing, muted (no echo), and one way to stop. */
export default function PresentingBanner({ stream, onStop }: { stream: MediaStream | null; onStop: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <section
      aria-label="You are presenting"
      className="glass flex items-center gap-3 self-center rounded-2xl p-2 pr-3"
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        aria-label="Your screen preview"
        className="aspect-video w-28 rounded-xl bg-black object-contain sm:w-40"
      />
      <p className="text-sm font-semibold text-white" role="status">
        You are presenting
      </p>
      <Button variant="danger" className="h-11" onPress={onStop}>
        <MonitorX size={18} aria-hidden /> Stop presenting
      </Button>
    </section>
  );
}
