"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  Chip,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalHeading,
  Skeleton,
} from "@heroui/react";
import { Check, Copy, Lock, MoreHorizontal } from "lucide-react";
import { useDeleteRoom, useEndRoom, useRooms } from "@/hooks/use-rooms";
import { googleCalendarUrl } from "@/lib/calendar/google";
import type { PublicRoom } from "@/types/rooms/room";
import CreateRoomModal from "./CreateRoomModal";

function StatusChip({ status }: { status: PublicRoom["status"] }) {
  if (status === "live") return <Chip color="success">live</Chip>;
  if (status === "scheduled") return <Chip color="default">scheduled</Chip>;
  return <Chip color="default">{status}</Chip>;
}

function RoomRow({ room }: { room: PublicRoom }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"end" | "delete" | null>(null);
  const endRoom = useEndRoom();
  const deleteRoom = useDeleteRoom();
  const router = useRouter();

  const link = `/rooms/${room.code}`;

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}${link}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function runConfirm() {
    if (confirm === "end") await endRoom.mutateAsync(room.code);
    if (confirm === "delete") await deleteRoom.mutateAsync(room.code);
    setConfirm(null);
  }

  return (
    <Card className="rounded-card border border-hairline p-0 shadow-none">
      <CardContent className="flex flex-row flex-wrap items-center gap-x-3 gap-y-2 p-4 sm:flex-nowrap sm:p-5">
        <StatusChip status={room.status} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-semibold">{room.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <code className="whitespace-nowrap">{room.code}</code>
            {room.hasPassword ? <Lock size={14} aria-label="Password protected" /> : null}
            {!room.allowGuests ? <span>guests off</span> : null}
            {room.startsAt && room.status === "scheduled" ? (
              <span>{new Date(room.startsAt).toLocaleString()}</span>
            ) : null}
          </span>
        </div>
        <Button isIconOnly variant="ghost" aria-label="Copy room link" onPress={() => void copy()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </Button>
        <Button variant="primary" size="sm" onPress={() => router.push(link)}>
          Open
        </Button>
        <DropdownRoot>
          <Button isIconOnly variant="ghost" aria-label={`Actions for ${room.name}`}>
            <MoreHorizontal size={16} />
          </Button>
          <DropdownPopover>
            <DropdownMenu
              onAction={(key) => {
                if (key === "edit") setEditing(true);
                if (key === "end") setConfirm("end");
                if (key === "delete") setConfirm("delete");
                if (key === "google") {
                  const base = window.location.origin;
                  window.open(
                    googleCalendarUrl(
                      {
                        code: room.code,
                        name: room.name,
                        startsAt: room.startsAt,
                        expiresAt: room.expiresAt,
                      },
                      base,
                    ),
                    "_blank",
                    "noopener",
                  );
                }
              }}
            >
              <DropdownItem id="google">Add to Google Calendar</DropdownItem>
              <DropdownItem id="ics">
                <a href={`/api/rooms/${room.code}/calendar.ics`} download={`${room.code}.ics`}>
                  Download .ics
                </a>
              </DropdownItem>
              <DropdownItem id="edit">Edit</DropdownItem>
              <DropdownItem id="end">End meeting</DropdownItem>
              <DropdownItem id="delete">Delete</DropdownItem>
            </DropdownMenu>
          </DropdownPopover>
        </DropdownRoot>
        <CreateRoomModal room={room} open={editing} onClose={() => setEditing(false)} />
        <Modal isOpen={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
          <ModalBackdrop>
            <ModalContainer>
              <ModalDialog>
                <ModalHeader>
                  <ModalHeading>
                    {confirm === "end" ? "End the meeting for everyone?" : "Delete this room?"}
                  </ModalHeading>
                </ModalHeader>
                <ModalBody>
                  {confirm === "end"
                    ? "Participants will be disconnected."
                    : "This can't be undone."}
                </ModalBody>
                <ModalFooter>
                  <Button variant="ghost" onPress={() => setConfirm(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onPress={() => void runConfirm()}>
                    Confirm
                  </Button>
                </ModalFooter>
              </ModalDialog>
            </ModalContainer>
          </ModalBackdrop>
        </Modal>
      </CardContent>
    </Card>
  );
}

export default function RoomList() {
  const { data: rooms, isPending } = useRooms();

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-20 rounded-card" />
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <p className="rounded-[22px] border border-dashed border-hairline bg-surface/60 p-8 text-center text-muted">
        No rooms yet — start an instant meeting or schedule one.
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rooms.map((room) => (
        <RoomRow key={room.code} room={room} />
      ))}
    </div>
  );
}
