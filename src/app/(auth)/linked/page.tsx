"use client";
import { useEffect } from "react";
import { LINKED_CHANNEL } from "@/lib/google-drive/client";

/** OAuth popup landing (Drive connect): tell the opener tab we're done, then close. */
export default function Page() {
  useEffect(() => {
    const channel = new BroadcastChannel(LINKED_CHANNEL);
    channel.postMessage("linked");
    channel.close();
    window.close();
  }, []);
  return <p className="p-6 text-center text-muted">Connected. You can close this window.</p>;
}
