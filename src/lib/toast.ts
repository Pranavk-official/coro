"use client";
import type { ReactNode } from "react";
import { ToastQueue } from "@heroui/react";

export const toastQueue = new ToastQueue();

const keys = new Map<string, string>();

export type ToastVariant = "default" | "accent" | "success" | "warning" | "danger";

export function notify(
  dedupeKey: string,
  content: { title: ReactNode; description?: ReactNode; variant?: ToastVariant },
  timeout = 4000,
): void {
  const existing = keys.get(dedupeKey);
  if (existing) toastQueue.close(existing);
  const key = toastQueue.add(content, { timeout });
  keys.set(dedupeKey, key);
}

export function dismissToast(dedupeKey: string): void {
  const existing = keys.get(dedupeKey);
  if (existing) {
    toastQueue.close(existing);
    keys.delete(dedupeKey);
  }
}
