"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Switch,
} from "@heroui/react";
import { useCreateRoom, useUpdateRoom } from "@/hooks/use-rooms";
import { toApiError } from "@/lib/hono/client";
import { errorCopy, fieldErrors } from "@/lib/utils/error-copy";
import { useCountdown } from "@/hooks/use-countdown";
import type { PublicRoom } from "@/types/rooms/room";
import { expiryFrom, type ExpiryKey } from "@/lib/utils/expiry";
import MeetingLength from "@/components/call/MeetingLength";
import TextInput from "@/components/ui/TextInput";
import PasswordInput from "@/components/ui/PasswordInput";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function CreateRoomModal({
  room,
  open,
  onClose,
  trigger,
}: {
  room?: PublicRoom;
  open: boolean;
  onClose: () => void;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(room);
  const router = useRouter();
  const create = useCreateRoom();
  const update = useUpdateRoom(room?.code ?? "");

  const [name, setName] = useState(room?.name ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(room?.startsAt ?? null));
  const [expiry, setExpiry] = useState<ExpiryKey>("1h");
  const [customExpiry, setCustomExpiry] = useState("");
  const [password, setPassword] = useState("");
  const [allowGuests, setAllowGuests] = useState(room?.allowGuests ?? true);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [wait, startWait] = useCountdown(); // 429: keep the modal + values, block Create until the window ends



  async function submit() {
    setError(null);
    setNameError(null);
    if (!name.trim()) {
      setNameError("Give the room a name.");
      return;
    }
    try {
      if (editing && room) {
        await update.mutateAsync({
          name: name.trim(),
          ...(password ? { password } : {}),
          allowGuests,
        });
        onClose();
      } else {
        const start = startsAt ? new Date(startsAt) : new Date();
        const expiresAt = expiryFrom(start, expiry, customExpiry);
        const created = await create.mutateAsync({
          name: name.trim(),
          kind: "scheduled",
          startsAt: start.toISOString(),
          ...(expiresAt ? { expiresAt } : {}),
          ...(password ? { password } : {}),
          allowGuests,
        });
        onClose();
        router.push(`/rooms/${created.code}`);
      }
    } catch (e) {
      const apiErr = toApiError(e);
      if (apiErr.status === 429) {
        startWait(apiErr.retryAfter);
        return; // the global toast says why
      }
      if (apiErr.code === "validation_failed") {
        const fields = fieldErrors(apiErr.details);
        if (fields["name"]) setNameError(fields["name"]);
        else setError(errorCopy(apiErr.code));
      } else {
        setError(errorCopy(apiErr.code));
      }
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <>
      {trigger}
      <Modal isOpen={open} onOpenChange={(v) => !v && onClose()}>
        <ModalBackdrop>
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>
                <ModalHeading>{editing ? "Edit room" : "Schedule a room"}</ModalHeading>
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <TextInput label="Room name" value={name} onChange={setName} placeholder="Design sync" error={nameError} />
                  {!editing && <TextInput label="Starts" type="datetime-local" value={startsAt} onChange={setStartsAt} />}
                  {!editing && (
                    <MeetingLength
                      value={{ key: expiry, custom: customExpiry }}
                      onChange={(v) => {
                        setExpiry(v.key);
                        setCustomExpiry(v.custom);
                      }}
                    />
                  )}
                  <PasswordInput
                    label={editing ? "Password (set / change / leave blank to keep)" : "Password (optional)"}
                    autoComplete="new-password"
                    value={password}
                    onChange={setPassword}
                    hint={editing ? undefined : "Host never needs it."}
                  />
                  <Switch isSelected={allowGuests} onChange={setAllowGuests}>
                    Allow guests
                  </Switch>
                  <span className="-mt-3 text-xs text-muted">
                    Guests wait until a host admits them.
                  </span>
                  {error ? (
                    <p role="alert" className="text-sm text-danger">
                      {error}
                    </p>
                  ) : null}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={() => void submit()}
                  isDisabled={pending || wait > 0}
                >
                  {wait > 0 ? `Try again in ${wait} s` : editing ? "Save" : "Create"}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </>
  );
}
