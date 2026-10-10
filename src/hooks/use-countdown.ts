"use client";
import { useCallback, useEffect, useState } from "react";

/** Seconds left until a deadline; `start(n)` (re)arms it. 0 = not counting (spec 002 design §1.3). */
export function useCountdown(): [left: number, start: (seconds: number | undefined) => void] {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  const start = useCallback((seconds: number | undefined) => {
    const t = Date.now();
    setNow(t);
    setDeadline(t + Math.max(1, seconds ?? 30) * 1000);
  }, []);
  return [Math.max(0, Math.ceil((deadline - now) / 1000)), start];
}

/** `m:ss` for the password gate copy. */
export const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
