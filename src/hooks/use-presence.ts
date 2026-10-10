"use client";
import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket.io/client";
import type { RoomPeek } from "@/lib/socket.io/events";

/** Who's in the room before joining. Polls over the call's socket (connected early; the call reuses it). */
export function usePresence(code: string | null, everyMs = 5000): RoomPeek | null {
  const [peek, setPeek] = useState<RoomPeek | null>(null);
  useEffect(() => {
    if (!code) return;
    const socket = getSocket();
    let stopped = false;
    const ask = () => socket.emit("room:peek", code, (r) => !stopped && setPeek(r));
    socket.on("connect", ask);
    if (socket.connected) ask();
    else if (!socket.active) socket.connect();
    const timer = setInterval(() => socket.connected && ask(), everyMs);
    return () => {
      stopped = true;
      clearInterval(timer);
      socket.off("connect", ask);
    };
  }, [code, everyMs]);
  return peek;
}
