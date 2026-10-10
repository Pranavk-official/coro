"use client";
import { useState } from "react";
import {
  Button,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalHeading,
} from "@heroui/react";
import { CalendarPlus, Check, Copy, Mail, Share2 } from "lucide-react";
import { googleCalendarUrl } from "@/lib/calendar/google";
import type { PublicRoom } from "@/types/rooms/room";

export default function ShareDialog({
  room,
  open,
  onClose,
}: {
  room: PublicRoom | null;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!room) return null;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${base}/rooms/${room.code}`;
  const google = googleCalendarUrl(
    { code: room.code, name: room.name, startsAt: room.startsAt, expiresAt: room.expiresAt },
    base,
  );
  const mailto = `mailto:?subject=${encodeURIComponent(`Join my meeting: ${room.name}`)}&body=${encodeURIComponent(`Join here: ${link}`)}`;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — link is selectable above */
    }
  }

  return (
    <Modal isOpen={open} onOpenChange={(v) => !v && onClose()}>
      <ModalBackdrop>
        <ModalContainer>
          <ModalDialog>
              <ModalHeader>
                <ModalHeading>Your meeting&apos;s ready</ModalHeading>
              </ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-full bg-surface-secondary px-4 py-2 text-sm">
                    {link}
                  </code>
                  <Button variant="primary" onPress={() => void copy()}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-sm text-muted">
                  Code: <code>{room.code}</code>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => window.open(google, "_blank", "noopener")}
                  >
                    <CalendarPlus size={16} /> Google Calendar
                  </Button>
                  <a href={`/api/rooms/${room.code}/calendar.ics`} download={`${room.code}.ics`}>
                    <Button variant="ghost" size="sm">
                      <CalendarPlus size={16} /> .ics file
                    </Button>
                  </a>
                  <a href={mailto}>
                    <Button variant="ghost" size="sm">
                      <Mail size={16} /> Email invite
                    </Button>
                  </a>
                  {canShare ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() =>
                        void navigator.share({ title: room.name, url: link }).catch(() => undefined)
                      }
                    >
                      <Share2 size={16} /> Share…
                    </Button>
                  ) : null}
                </div>
                <p className="text-sm text-muted">
                  Anyone with this link can ask to join. You&apos;ll admit them.
                </p>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="primary" onPress={onClose}>
                Done
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
