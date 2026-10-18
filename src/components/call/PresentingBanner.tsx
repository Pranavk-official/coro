"use client";
import { useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { MonitorX } from "lucide-react";

/**
 * Presenter's own view (spec 007 FR9): what you're sharing, muted (no echo), and one way to stop.
 * `stage`: a grid tile — "main" fills the stage with the controls on top, "rail" is the bare thumbnail
 * (another tile is pinned; stop lives in the toolbar). Unset: compact banner (alone in the call).
 */
export default function PresentingBanner({
  stream,
  onStop,
  stage,
}: {
  stream: MediaStream | null;
  onStop: () => void;
  stage?: "main" | "rail";
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  const controls = (
    <>
      <p className="text-sm font-semibold text-white" role="status">
        You are presenting
      </p>
      <Button variant="danger" className="h-11" onPress={onStop}>
        <MonitorX size={18} aria-hidden /> Stop presenting
      </Button>
    </>
  );
  const video = (className: string) => (
    <video ref={ref} autoPlay playsInline muted aria-label="Your screen preview" className={className} />
  );
  if (stage) {
    return (
      <section aria-label="You are presenting" className="relative h-full min-h-0 overflow-hidden rounded-card bg-black">
        {video("h-full w-full object-contain")}
        {stage === "rail" ? null : (
          <div className="glass absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full py-1.5 pl-4 pr-1.5">
            {controls}
          </div>
        )}
      </section>
    );
  }
  return (
    <section aria-label="You are presenting" className="glass flex items-center gap-3 self-center rounded-2xl p-2 pr-3">
      {video("aspect-video w-28 rounded-xl bg-black object-contain sm:w-40")}
      {controls}
    </section>
  );
}
