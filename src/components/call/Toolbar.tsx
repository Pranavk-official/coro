"use client";
import { useState } from "react";
import {
  Button,
  ButtonGroup,
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
  useOverlayState,
} from "@heroui/react";
import {
  Lock,
  LockOpen,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import type { MediaState } from "@/lib/socket.io/events";
import type { DeviceInfo } from "@/lib/webrtc/devices";
import DeviceMenu from "@/components/call/DeviceMenu";
import MoreDrawer from "@/components/call/MoreDrawer";
import DeviceDrawer from "@/components/call/DeviceDrawer";

export default function Toolbar({
  state,
  onToggle,
  onShare,
  sharing,
  shareSupported,
  waitingCount,
  canAdmit,
  onParticipants,
  onLeave,
  isHost,
  locked,
  onLock,
  onEnd,
  devices,
  micId,
  camId,
  speakerId,
  showSpeaker,
  onPickDevice,
  compact,
  onCopyLink,
  code,
}: {
  state: MediaState;
  onToggle: (patch: Partial<MediaState>) => void;
  onShare: () => void;
  sharing: boolean;
  shareSupported: boolean;
  waitingCount: number;
  canAdmit: boolean;
  onParticipants: () => void;
  onLeave: () => void;
  isHost: boolean;
  locked: boolean;
  onLock: (v: boolean) => void;
  onEnd: () => void;
  devices: DeviceInfo[];
  micId: string | null;
  camId: string | null;
  speakerId: string | null;
  showSpeaker: boolean;
  onPickDevice: (kind: "audio" | "video" | "speaker", deviceId: string) => void;
  compact: boolean;
  onCopyLink: () => void;
  /** Meeting code: the phone More sheet shows the link. */
  code: string;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const more = useOverlayState();
  const deviceSheet = useOverlayState();
  const byKind = (k: DeviceInfo["kind"]) => devices.filter((d) => d.kind === k);
  const endDialog = (
    <Modal isOpen={confirmEnd} onOpenChange={(v) => !v && setConfirmEnd(false)}>
      <ModalBackdrop>
        <ModalContainer>
          <ModalDialog>
            <ModalHeader>
              <ModalHeading>End the meeting for everyone?</ModalHeading>
            </ModalHeader>
            <ModalBody>Participants will be disconnected.</ModalBody>
            <ModalFooter>
              <Button variant="ghost" onPress={() => setConfirmEnd(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  setConfirmEnd(false);
                  onEnd();
                }}
              >
                End meeting
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
  if (compact) {
    return (
      <div className="glass flex items-center gap-2 rounded-full p-2">
        <Button
          isIconOnly
          variant={state.mic ? "ghost" : "danger"}
          className={`size-12 text-white ${state.mic ? "bg-white/15" : ""}`}
          aria-label={state.mic ? "Mute microphone" : "Unmute microphone"}
          aria-pressed={state.mic}
          onPress={() => onToggle({ mic: !state.mic })}
        >
          {state.mic ? <Mic size={18} /> : <MicOff size={18} />}
        </Button>
        <Button
          isIconOnly
          variant={state.cam ? "ghost" : "danger"}
          className={`size-12 text-white ${state.cam ? "bg-white/15" : ""}`}
          aria-label={state.cam ? "Turn camera off" : "Turn camera on"}
          aria-pressed={state.cam}
          onPress={() => onToggle({ cam: !state.cam })}
        >
          {state.cam ? <Video size={18} /> : <VideoOff size={18} />}
        </Button>
        <Button variant="danger" className="h-12 px-5" aria-label="Leave" onPress={onLeave}>
          <PhoneOff size={18} /> Leave
        </Button>
        <Button isIconOnly variant="ghost" className="size-12 bg-white/15 text-white" aria-label="More options" onPress={more.open}>
          <MoreHorizontal size={18} />
        </Button>
        <MoreDrawer
          state={more}
          code={code}
          shareSupported={shareSupported}
          sharing={sharing}
          waitingCount={canAdmit ? waitingCount : 0}
          isHost={isHost}
          locked={locked}
          onShare={onShare}
          onParticipants={onParticipants}
          onCopyLink={onCopyLink}
          onLock={onLock}
          onEnd={() => setConfirmEnd(true)}
          onDevices={deviceSheet.open}
        />
        <DeviceDrawer
          state={deviceSheet}
          sections={[
            { title: "Microphone", kind: "audio", devices: byKind("audioinput"), activeId: micId },
            ...(showSpeaker ? [{ title: "Speaker", kind: "speaker" as const, devices: byKind("audiooutput"), activeId: speakerId }] : []),
            { title: "Camera", kind: "video", devices: byKind("videoinput"), activeId: camId },
          ]}
          onPick={onPickDevice}
        />
        {endDialog}
      </div>
    );
  }
  return (
    <div className="glass flex items-center gap-2 rounded-full p-2">
      <ButtonGroup>
        <Button
          isIconOnly
          variant={state.mic ? "ghost" : "danger"}
          className={`size-12 text-white ${state.mic ? "bg-white/15" : ""}`}
          aria-label={state.mic ? "Mute microphone" : "Unmute microphone"}
          aria-pressed={state.mic}
          onPress={() => onToggle({ mic: !state.mic })}
        >
          {state.mic ? <Mic size={18} /> : <MicOff size={18} />}
        </Button>
        <DeviceMenu
          label="Choose microphone"
          sections={[
            { title: "Microphone", kind: "audio", devices: devices.filter((d) => d.kind === "audioinput"), activeId: micId },
            ...(showSpeaker
              ? [{ title: "Speaker", kind: "speaker" as const, devices: devices.filter((d) => d.kind === "audiooutput"), activeId: speakerId }]
              : []),
          ]}
          onPick={onPickDevice}
        />
      </ButtonGroup>
      <ButtonGroup>
        <Button
          isIconOnly
          variant={state.cam ? "ghost" : "danger"}
          className={`size-12 text-white ${state.cam ? "bg-white/15" : ""}`}
          aria-label={state.cam ? "Turn camera off" : "Turn camera on"}
          aria-pressed={state.cam}
          onPress={() => onToggle({ cam: !state.cam })}
        >
          {state.cam ? <Video size={18} /> : <VideoOff size={18} />}
        </Button>
        <DeviceMenu
          label="Choose camera"
          sections={[{ title: "Camera", kind: "video", devices: devices.filter((d) => d.kind === "videoinput"), activeId: camId }]}
          onPick={onPickDevice}
        />
      </ButtonGroup>
      {shareSupported ? (
        <Button
          isIconOnly
          variant="ghost"
          className={`size-12 ${sharing ? "bg-white text-black" : "bg-white/15 text-white"}`}
          aria-label={sharing ? "Stop sharing" : "Share screen"}
          aria-pressed={sharing}
          onPress={onShare}
        >
          <MonitorUp size={18} />
        </Button>
      ) : null}
      <Button
        isIconOnly
        variant="ghost"
        className="relative size-12 bg-white/15 text-white"
        aria-label={`Participants${waitingCount > 0 ? `, ${waitingCount} waiting` : ""}`}
        onPress={onParticipants}
      >
        <Users size={18} />
        {canAdmit && waitingCount > 0 ? (
          <span aria-hidden className="absolute -right-1 -top-1 rounded-full bg-danger px-1.5 text-xs text-white">
            {waitingCount}
          </span>
        ) : null}
      </Button>
      {isHost ? (
        <DropdownRoot>
          <Button variant="danger" className="h-12 px-5" aria-label="Leave options">
            <PhoneOff size={18} /> Leave
          </Button>
          <DropdownPopover>
            <DropdownMenu
              onAction={(key) => {
                if (key === "leave") onLeave();
                if (key === "end") setConfirmEnd(true);
              }}
            >
              <DropdownItem id="leave">Leave</DropdownItem>
              <DropdownItem id="end">End for everyone</DropdownItem>
            </DropdownMenu>
          </DropdownPopover>
        </DropdownRoot>
      ) : (
        <Button variant="danger" className="h-12 px-5" aria-label="Leave" onPress={onLeave}>
          <PhoneOff size={18} /> Leave
        </Button>
      )}
      {isHost ? (
        <>
          <Button
            isIconOnly
            variant="ghost"
            className={`size-12 ${locked ? "bg-white text-black" : "bg-white/15 text-white"}`}
            aria-label={locked ? "Unlock room" : "Lock room"}
            aria-pressed={locked}
            onPress={() => onLock(!locked)}
          >
            {locked ? <Lock size={18} /> : <LockOpen size={18} />}
          </Button>
          {endDialog}
        </>
      ) : null}
    </div>
  );
}
