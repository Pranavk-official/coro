"use client";
import { useEffect } from "react";

/** OAuth popup landing (Drive connect): close and hand control back to the call tab. */
export default function Page() {
  useEffect(() => window.close(), []);
  return <p className="p-6 text-center text-muted">Connected. You can close this window.</p>;
}
