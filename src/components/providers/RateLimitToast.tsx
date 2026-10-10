"use client";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/hono/client";
import { notify } from "@/lib/toast";

function Countdown({ seconds }: { seconds: number }) {
  const [deadline] = useState(() => Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return <>Too many requests — try again in {left} s</>;
}

/** Global 429 handler (spec 002 FR10): one warning toast (deduped by key), live countdown, gone when the wait is over. */
export function notifyRateLimited(err: unknown): void {
  if (!(err instanceof ApiError) || err.status !== 429) return;
  const seconds = Math.min(Math.max(err.retryAfter ?? 5, 1), 30);
  notify("rate-limited", { title: <Countdown seconds={seconds} />, variant: "warning" }, seconds * 1000);
}
