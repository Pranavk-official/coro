"use client";
import {
  Button,
  Kbd,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
} from "@heroui/react";

const SHORTCUTS: [string, string][] = [
  ["M", "Mute / unmute microphone"],
  ["V", "Camera on / off"],
  ["S", "Share / stop sharing screen"],
  ["P", "Open participants"],
  ["C", "Copy meeting link"],
  ["L", "Lock / unlock room (host)"],
  ["R", "Start / stop recording"],
  ["?", "This sheet"],
];

export default function ShortcutsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={open} onOpenChange={(v) => !v && onClose()}>
      <ModalBackdrop>
        <ModalContainer>
          <ModalDialog>
            <ModalHeader>
              <ModalHeading>Keyboard shortcuts</ModalHeading>
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
                {SHORTCUTS.map(([key, label]) => (
                  <div key={key} className="contents">
                    <Kbd>{key}</Kbd>
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
              <Button variant="ghost" onPress={onClose}>
                Close
              </Button>
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
