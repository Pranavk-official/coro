"use client";
import { useEffect, useState } from "react";
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
import RecordButton from "@/components/call/RecordButton";
import { RecordPopover, RecordSheet } from "@/components/call/RecordSheet";
import type { RecordOptions } from "@/hooks/use-recorder";
import Tip from "@/components/ui/Tip";

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
  record,
  moreSheet,
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
  /** Phone: another sheet stacked on More (participants); `open` brings More up first. */
  moreSheet?: { node: React.ReactNode; open: boolean };
  /** Absent for guests / browsers that can't record (spec 003 FR10). */
  record?: {
    startedAt: number | null;
    saving: boolean;
    /** Stop while recording, else open the sheet. */
    onPress: () => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onStart: (opts: RecordOptions) => void;
  };
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const more = useOverlayState();
  const deviceSheet = useOverlayState();
  const byKind = (k: DeviceInfo["kind"]) => devices.filter((d) => d.kind === k);
  const stackedOpen = (record?.open ?? false) || (moreSheet?.open ?? false);
  // Phone: record + participants sheets stack on More, so opening one without it (R / P key, admit banner) brings More up first.
  useEffect(() => {
    if (compact && stackedOpen) more.open();
  }, [compact, stackedOpen, more]);
  const button = record ? { startedAt: record.startedAt, saving: record.saving, onPress: record.onPress } : null;
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
  // Host: Leave asks "Leave / End for everyone" on every screen size (phones too, not only under ⋯).
  const leaveButton = isHost ? (
    <DropdownRoot>
      <Tip label="Leave or end for everyone">
        <Button variant="danger" className="h-12 px-5" aria-label="Leave options">
          <PhoneOff size={18} /> Leave
        </Button>
      </Tip>
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
  );
  if (compact) {
    return (
      <div className="glass flex items-center gap-2 rounded-full p-2">
        <Button
          isIconOnly
          variant={state.mic ? "ghost" : "danger"}
          className={`size-12 ${state.mic ? "bg-foreground/10 text-foreground" : "text-white"}`}
          aria-label={state.mic ? "Mute microphone" : "Unmute microphone"}
          aria-pressed={state.mic}
          onPress={() => onToggle({ mic: !state.mic })}
        >
          {state.mic ? <Mic size={18} /> : <MicOff size={18} />}
        </Button>
        <Button
          isIconOnly
          variant={state.cam ? "ghost" : "danger"}
          className={`size-12 ${state.cam ? "bg-foreground/10 text-foreground" : "text-white"}`}
          aria-label={state.cam ? "Turn camera off" : "Turn camera on"}
          aria-pressed={state.cam}
          onPress={() => onToggle({ cam: !state.cam })}
        >
          {state.cam ? <Video size={18} /> : <VideoOff size={18} />}
        </Button>
        {button && button.startedAt !== null ? <RecordButton {...button} /> : null}
        {leaveButton}
        <Button isIconOnly variant="ghost" className="size-12 bg-foreground/10 text-foreground" aria-label="More options" onPress={more.open}>
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
          onRecord={record && record.startedAt === null ? record.onPress : undefined}
        >
          {moreSheet?.node}
          {record ? (
            <RecordSheet
              open={record.open}
              onOpenChange={record.onOpenChange}
              onStart={(opts) => {
                more.close();
                record.onStart(opts);
              }}
            />
          ) : null}
          <DeviceDrawer
            state={deviceSheet}
            sections={[
              { title: "Microphone", kind: "audio", devices: byKind("audioinput"), activeId: micId },
              ...(showSpeaker ? [{ title: "Speaker", kind: "speaker" as const, devices: byKind("audiooutput"), activeId: speakerId }] : []),
              { title: "Camera", kind: "video", devices: byKind("videoinput"), activeId: camId },
            ]}
            onPick={onPickDevice}
          />
        </MoreDrawer>
        {endDialog}
      </div>
    );
  }
  return (
    <div className="glass flex items-center gap-2 rounded-full p-2">
      <ButtonGroup>
        <Tip label={state.mic ? "Mute microphone" : "Unmute microphone"}>
          <Button
            isIconOnly
            variant={state.mic ? "ghost" : "danger"}
            className={`size-12 ${state.mic ? "bg-foreground/10 text-foreground" : "text-white"}`}
            aria-label={state.mic ? "Mute microphone" : "Unmute microphone"}
            aria-pressed={state.mic}
            onPress={() => onToggle({ mic: !state.mic })}
          >
            {state.mic ? <Mic size={18} /> : <MicOff size={18} />}
          </Button>
        </Tip>
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
        <Tip label={state.cam ? "Turn camera off" : "Turn camera on"}>
          <Button
            isIconOnly
            variant={state.cam ? "ghost" : "danger"}
            className={`size-12 ${state.cam ? "bg-foreground/10 text-foreground" : "text-white"}`}
            aria-label={state.cam ? "Turn camera off" : "Turn camera on"}
            aria-pressed={state.cam}
            onPress={() => onToggle({ cam: !state.cam })}
          >
            {state.cam ? <Video size={18} /> : <VideoOff size={18} />}
          </Button>
        </Tip>
        <DeviceMenu
          label="Choose camera"
          sections={[{ title: "Camera", kind: "video", devices: devices.filter((d) => d.kind === "videoinput"), activeId: camId }]}
          onPick={onPickDevice}
        />
      </ButtonGroup>
      {shareSupported ? (
        <Tip label={sharing ? "Stop sharing" : "Share screen"}>
          <Button
            isIconOnly
            variant="ghost"
            className={`size-12 ${sharing ? "bg-foreground text-background" : "bg-foreground/10 text-foreground"}`}
            aria-label={sharing ? "Stop sharing" : "Share screen"}
            aria-pressed={sharing}
            onPress={onShare}
          >
            <MonitorUp size={18} />
          </Button>
        </Tip>
      ) : null}
      {record && button ? (
        <RecordPopover open={record.open} onOpenChange={record.onOpenChange} onStart={record.onStart}>
          <Tip label={button.startedAt !== null ? "Stop recording" : button.saving ? "Saving recording" : "Record"}>
            <RecordButton {...button} />
          </Tip>
        </RecordPopover>
      ) : null}
      <Tip label={waitingCount > 0 && canAdmit ? `Participants · ${waitingCount} waiting` : "Participants"}>
        <Button
          isIconOnly
          variant="ghost"
          className="relative size-12 bg-foreground/10 text-foreground"
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
      </Tip>
      {leaveButton}
      {isHost ? (
        <>
          <Tip label={locked ? "Unlock room" : "Lock room"}>
            <Button
              isIconOnly
              variant="ghost"
              className={`size-12 ${locked ? "bg-foreground text-background" : "bg-foreground/10 text-foreground"}`}
              aria-label={locked ? "Unlock room" : "Lock room"}
              aria-pressed={locked}
              onPress={() => onLock(!locked)}
            >
              {locked ? <Lock size={18} /> : <LockOpen size={18} />}
            </Button>
          </Tip>
          {endDialog}
        </>
      ) : null}
    </div>
  );
}
