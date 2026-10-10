"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
} from "@heroui/react";
import { CalendarPlus, Link2, Plus, Video } from "lucide-react";
import { useCreateRoom } from "@/hooks/use-rooms";
import { toApiError } from "@/lib/hono/client";
import { errorCopy } from "@/lib/utils/error-copy";
import type { PublicRoom } from "@/types/rooms/room";
import CreateRoomModal from "@/components/lobby/CreateRoomModal";
import ShareDialog from "@/components/lobby/ShareDialog";

export default function NewMeetingMenu() {
  const router = useRouter();
  const create = useCreateRoom();
  const [scheduling, setScheduling] = useState(false);
  const [shared, setShared] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function later() {
    setError(null);
    try {
      const room = await create.mutateAsync({ name: "Meeting link", kind: "later" });
      setShared(room);
    } catch (e) {
      setError(errorCopy(toApiError(e).code));
    }
  }

  return (
    <div className="flex flex-col gap-1 sm:mt-[26px]">
      <DropdownRoot>
        <Button variant="primary" size="lg" className="w-full sm:w-auto">
          <Plus size={16} /> New meeting
        </Button>
        <DropdownPopover>
          <DropdownMenu
            onAction={(key) => {
              if (key === "instant") router.push("/new");
              if (key === "later") void later();
              if (key === "schedule") setScheduling(true);
            }}
          >
            <DropdownItem id="instant">
              <Video size={16} /> Start an instant meeting
            </DropdownItem>
            <DropdownItem id="later">
              <Link2 size={16} /> Create a meeting link for later
            </DropdownItem>
            <DropdownItem id="schedule">
              <CalendarPlus size={16} /> Schedule in calendar
            </DropdownItem>
          </DropdownMenu>
        </DropdownPopover>
      </DropdownRoot>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <CreateRoomModal open={scheduling} onClose={() => setScheduling(false)} />
      <ShareDialog room={shared} open={shared !== null} onClose={() => setShared(null)} />
    </div>
  );
}
